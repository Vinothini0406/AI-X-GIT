import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

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
