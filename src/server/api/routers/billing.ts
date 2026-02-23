import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

const usageLimits = {
  commits: 1000,
  questions: 500,
  collaborators: 10,
} as const;

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const percentFrom = (value: number, limit: number) => {
  if (limit <= 0) {
    return 0;
  }

  return clampPercent((value / limit) * 100);
};

const projectHealthScore = ({
  commitCount,
  questionCount,
  memberCount,
  lastUpdatedAt,
}: {
  commitCount: number;
  questionCount: number;
  memberCount: number;
  lastUpdatedAt: Date;
}) => {
  const now = Date.now();
  const updatedAtMs = lastUpdatedAt.getTime();
  const daysSinceUpdate = Number.isNaN(updatedAtMs)
    ? 365
    : Math.floor((now - updatedAtMs) / (1000 * 60 * 60 * 24));

  const commitScore = Math.min(40, Math.round((commitCount / 30) * 40));
  const questionScore = Math.min(35, Math.round((questionCount / 25) * 35));
  const collaborationScore = Math.min(15, Math.round((memberCount / usageLimits.collaborators) * 15));
  const freshnessScore = daysSinceUpdate <= 3 ? 10 : daysSinceUpdate <= 10 ? 6 : 3;

  return Math.max(0, Math.min(100, commitScore + questionScore + collaborationScore + freshnessScore));
};

type UsageRiskLevel = "healthy" | "monitor" | "warning" | "critical";

const usageRiskFromProjectedPercent = (projectedPercent: number): UsageRiskLevel => {
  if (projectedPercent >= 100) {
    return "critical";
  }
  if (projectedPercent >= 80) {
    return "warning";
  }
  if (projectedPercent >= 60) {
    return "monitor";
  }
  return "healthy";
};

const planCatalog = {
  starter: {
    name: "Starter",
    amountInPaise: 149900,
  },
  pro: {
    name: "Pro Workspace",
    amountInPaise: 499900,
  },
} as const;

interface ProjectAccessDb {
  project: {
    findFirst: (args: {
      where: {
        id: string;
        User: {
          some: {
            id: string;
          };
        };
      };
      select: {
        id: true;
      };
    }) => Promise<{ id: string } | null>;
  };
}

const ensureProjectAccess = async (
  projectId: string | null,
  userId: string,
  db: ProjectAccessDb,
) => {
  if (!projectId) {
    return null;
  }

  const project = await db.project.findFirst({
    where: {
      id: projectId,
      User: {
        some: {
          id: userId,
        },
      },
    },
    select: { id: true },
  });

  if (!project) {
    throw new Error("Project not found or access denied");
  }

  return projectId;
};

export const billingRouter = createTRPCRouter({
  getBillingOverview: protectedProcedure
    .input(
      z.object({
        projectId: z.string().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const projectId = await ensureProjectAccess(input.projectId, ctx.userId, ctx.db);

      const invoices = await ctx.db.invoice.findMany({
        where: {
          userId: ctx.userId,
          ...(projectId ? { projectId } : {}),
          status: "PAID",
        },
        include: {
          Payment: {
            select: {
              id: true,
              planName: true,
              status: true,
              providerRef: true,
            },
          },
        },
        orderBy: {
          issuedAt: "desc",
        },
        take: 25,
      });

      const hasSuccessfulPayment =
        (await ctx.db.payment.count({
          where: {
            userId: ctx.userId,
            ...(projectId ? { projectId } : {}),
            status: "SUCCESS",
          },
        })) > 0;

      const totalSpendInPaise = invoices.reduce((acc: number, invoice: { amountInPaise: number }) => {
        return acc + invoice.amountInPaise;
      }, 0);

      return {
        hasSuccessfulPayment,
        totalSpendInPaise,
        invoices: invoices.map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          amountInPaise: invoice.amountInPaise,
          currency: invoice.currency,
          status: invoice.status,
          issuedAt: invoice.issuedAt,
          payment: {
            id: invoice.Payment.id,
            planName: invoice.Payment.planName,
            status: invoice.Payment.status,
            providerRef: invoice.Payment.providerRef,
          },
        })),
      };
    }),

  getUsageInsights: protectedProcedure
    .input(
      z.object({
        projectId: z.string().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const projectId = await ensureProjectAccess(input.projectId, ctx.userId, ctx.db);

      const projects = await ctx.db.project.findMany({
        where: {
          User: {
            some: {
              id: ctx.userId,
            },
          },
          ...(projectId ? { id: projectId } : {}),
        },
        select: {
          id: true,
          name: true,
          updatedAt: true,
          _count: {
            select: {
              Commit: true,
              Question: true,
              User: true,
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const daysElapsed = Math.max(1, now.getDate());
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      if (projects.length === 0) {
        return {
          scope: projectId ? "project" : "workspace",
          riskLevel: "healthy" as UsageRiskLevel,
          suggestedPlan: "starter" as const,
          window: {
            monthStart,
            monthEndExclusive: nextMonthStart,
            daysElapsed,
            daysInMonth,
          },
          metrics: {
            commits: {
              currentMonth: 0,
              projectedEndOfMonth: 0,
              limit: usageLimits.commits,
              currentPercent: 0,
              projectedPercent: 0,
            },
            questions: {
              currentMonth: 0,
              projectedEndOfMonth: 0,
              limit: usageLimits.questions,
              currentPercent: 0,
              projectedPercent: 0,
            },
            collaborators: {
              active: 0,
              limit: usageLimits.collaborators,
              currentPercent: 0,
            },
          },
          nudges: [
            {
              title: "Create your first project",
              description: "Usage insights will appear once a project is active.",
              tone: "info" as const,
            },
          ],
          byProject: [] as {
            projectId: string;
            name: string;
            commits: number;
            questions: number;
            collaborators: number;
            healthScore: number;
            lastUpdatedAt: Date;
          }[],
        };
      }

      const projectIds = projects.map((project) => project.id);

      const [monthlyCommitCount, monthlyQuestionCount, activeCollaborators] = await Promise.all([
        ctx.db.commit.count({
          where: {
            projectId: {
              in: projectIds,
            },
            createdAt: {
              gte: monthStart,
              lt: nextMonthStart,
            },
          },
        }),
        ctx.db.question.count({
          where: {
            projectId: {
              in: projectIds,
            },
            createdAt: {
              gte: monthStart,
              lt: nextMonthStart,
            },
          },
        }),
        ctx.db.user.count({
          where: {
            Project: {
              some: {
                id: {
                  in: projectIds,
                },
              },
            },
          },
        }),
      ]);

      const projectedCommitCount = Math.ceil((monthlyCommitCount / daysElapsed) * daysInMonth);
      const projectedQuestionCount = Math.ceil((monthlyQuestionCount / daysElapsed) * daysInMonth);

      const commitCurrentPercent = percentFrom(monthlyCommitCount, usageLimits.commits);
      const commitProjectedPercent = percentFrom(projectedCommitCount, usageLimits.commits);
      const questionCurrentPercent = percentFrom(monthlyQuestionCount, usageLimits.questions);
      const questionProjectedPercent = percentFrom(projectedQuestionCount, usageLimits.questions);
      const collaboratorPercent = percentFrom(activeCollaborators, usageLimits.collaborators);

      const projectedPeakPercent = Math.max(
        commitProjectedPercent,
        questionProjectedPercent,
        collaboratorPercent,
      );
      const riskLevel = usageRiskFromProjectedPercent(projectedPeakPercent);

      const nudges: {
        title: string;
        description: string;
        tone: "info" | "warning" | "critical";
      }[] = [];

      if (commitProjectedPercent >= 90) {
        nudges.push({
          title: "Commit summary limit risk",
          description: `Projected usage is ${commitProjectedPercent}%. Upgrade to avoid interruption.`,
          tone: commitProjectedPercent >= 100 ? "critical" : "warning",
        });
      } else if (commitCurrentPercent >= 70) {
        nudges.push({
          title: "Commit usage rising",
          description: `Current month commit usage is already at ${commitCurrentPercent}%.`,
          tone: "warning",
        });
      }

      if (questionProjectedPercent >= 90) {
        nudges.push({
          title: "Q&A message limit risk",
          description: `Projected Q&A usage is ${questionProjectedPercent}% by month end.`,
          tone: questionProjectedPercent >= 100 ? "critical" : "warning",
        });
      } else if (questionCurrentPercent >= 70) {
        nudges.push({
          title: "Q&A usage rising",
          description: `Current month Q&A usage is ${questionCurrentPercent}%.`,
          tone: "warning",
        });
      }

      if (collaboratorPercent >= 80) {
        nudges.push({
          title: "Team capacity nearly full",
          description: `${activeCollaborators}/${usageLimits.collaborators} collaborator slots are in use.`,
          tone: collaboratorPercent >= 100 ? "critical" : "warning",
        });
      }

      if (nudges.length === 0) {
        nudges.push({
          title: "Usage is healthy",
          description: "No immediate upgrade action is needed this month.",
          tone: "info",
        });
      }

      const byProject = projects
        .map((project) => ({
          projectId: project.id,
          name: project.name,
          commits: project._count.Commit,
          questions: project._count.Question,
          collaborators: project._count.User,
          healthScore: projectHealthScore({
            commitCount: project._count.Commit,
            questionCount: project._count.Question,
            memberCount: project._count.User,
            lastUpdatedAt: project.updatedAt,
          }),
          lastUpdatedAt: project.updatedAt,
        }))
        .sort((left, right) => right.healthScore - left.healthScore);

      return {
        scope: projectId ? "project" : "workspace",
        riskLevel,
        suggestedPlan: projectedPeakPercent >= 80 ? ("pro" as const) : ("starter" as const),
        window: {
          monthStart,
          monthEndExclusive: nextMonthStart,
          daysElapsed,
          daysInMonth,
        },
        metrics: {
          commits: {
            currentMonth: monthlyCommitCount,
            projectedEndOfMonth: projectedCommitCount,
            limit: usageLimits.commits,
            currentPercent: commitCurrentPercent,
            projectedPercent: commitProjectedPercent,
          },
          questions: {
            currentMonth: monthlyQuestionCount,
            projectedEndOfMonth: projectedQuestionCount,
            limit: usageLimits.questions,
            currentPercent: questionCurrentPercent,
            projectedPercent: questionProjectedPercent,
          },
          collaborators: {
            active: activeCollaborators,
            limit: usageLimits.collaborators,
            currentPercent: collaboratorPercent,
          },
        },
        nudges,
        byProject,
      };
    }),

  checkout: protectedProcedure
    .input(
      z.object({
        projectId: z.string().nullable(),
        planKey: z.enum(["starter", "pro"]),
        paymentMethodId: z.string().min(2),
        simulateFailure: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const projectId = await ensureProjectAccess(input.projectId, ctx.userId, ctx.db);
      const plan = planCatalog[input.planKey];

      const payment = await ctx.db.payment.create({
        data: {
          userId: ctx.userId,
          projectId,
          planName: plan.name,
          amountInPaise: plan.amountInPaise,
          currency: "INR",
          status: "PENDING",
          providerRef: `sim_${input.paymentMethodId}_${Date.now()}`,
        },
        select: {
          id: true,
        },
      });

      await new Promise((resolve) => setTimeout(resolve, 900));

      if (input.simulateFailure) {
        await ctx.db.payment.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });

        return {
          status: "FAILED" as const,
          paymentId: payment.id,
          message: "Payment failed. Please try another payment method.",
        };
      }

      await ctx.db.payment.update({
        where: { id: payment.id },
        data: { status: "SUCCESS" },
      });

      const invoice = await ctx.db.invoice.create({
        data: {
          invoiceNumber: `INV-INR-${new Date().getUTCFullYear()}-${payment.id.slice(-8).toUpperCase()}`,
          userId: ctx.userId,
          projectId,
          paymentId: payment.id,
          amountInPaise: plan.amountInPaise,
          currency: "INR",
          status: "PAID",
        },
        select: {
          id: true,
          invoiceNumber: true,
          amountInPaise: true,
          currency: true,
          issuedAt: true,
        },
      });

      return {
        status: "SUCCESS" as const,
        paymentId: payment.id,
        invoice,
      };
    }),
});
