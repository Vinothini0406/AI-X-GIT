import { currentUser } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { askRepoQuestion } from "@/lib/gemini";
import { pollCommits } from "@/lib/github";
import {
  getGithubRepositoryForUser,
  hasGithubRepositoryAccess,
  listGithubRepositoriesForUser,
} from "@/server/github/user-repositories";
import { createTRPCRouter, protectedProcedure } from "../trpc";

export const projectRouter = createTRPCRouter({
  createProject: protectedProcedure
    .input(
      z.object({
        repoUrl: z.string(),
        projectname: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const fullName = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const displayName =
        fullName.length > 0
          ? fullName
          : (user.username ?? user.emailAddresses[0]?.emailAddress ?? "User");

      await ctx.db.user.upsert({
        where: { id: ctx.userId },
        update: {
          name: displayName,
          updatedAt: new Date(),
        },
        create: {
          id: ctx.userId,
          name: displayName,
          updatedAt: new Date(),
        },
      });

      return await ctx.db.project.create({
        data: {
          githubUrl: input.repoUrl,
          name: input.projectname,
          User: {
            connect: {
              id: ctx.userId,
            },
          },
        },
      });
    }),

  getGithubImportStatus: protectedProcedure.query(async ({ ctx }) => {
    return {
      hasGithubAuth: await hasGithubRepositoryAccess(ctx.userId),
    };
  }),

  getGithubRepositories: protectedProcedure.query(async ({ ctx }) => {
    try {
      return await listGithubRepositoriesForUser(ctx.userId);
    } catch (error) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          error instanceof Error
            ? error.message
            : "Failed to fetch GitHub repositories.",
      });
    }
  }),

  importGithubRepository: protectedProcedure
    .input(
      z.object({
        fullName: z
          .string()
          .min(3)
          .max(160)
          .regex(
            /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/,
            "Choose a valid GitHub repository.",
          ),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      let repository: Awaited<ReturnType<typeof getGithubRepositoryForUser>>;

      try {
        repository = await getGithubRepositoryForUser(
          ctx.userId,
          input.fullName,
        );
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            error instanceof Error
              ? error.message
              : "Failed to import GitHub repository.",
        });
      }

      const user = await currentUser();

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not authenticated",
        });
      }

      const fullName = [user.firstName, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();
      const displayName =
        fullName.length > 0
          ? fullName
          : (user.username ?? user.emailAddresses[0]?.emailAddress ?? "User");

      await ctx.db.user.upsert({
        where: { id: ctx.userId },
        update: {
          name: displayName,
          updatedAt: new Date(),
        },
        create: {
          id: ctx.userId,
          name: displayName,
          updatedAt: new Date(),
        },
      });

      const existingProject = await ctx.db.project.findFirst({
        where: {
          githubUrl: {
            in: [repository.htmlUrl, `${repository.htmlUrl}.git`],
          },
          User: {
            some: {
              id: ctx.userId,
            },
          },
        },
        select: {
          githubUrl: true,
          id: true,
          name: true,
        },
      });

      if (existingProject) {
        return {
          imported: false,
          project: existingProject,
        };
      }

      const project = await ctx.db.project.create({
        data: {
          githubUrl: repository.htmlUrl,
          name: repository.fullName,
          User: {
            connect: {
              id: ctx.userId,
            },
          },
        },
        select: {
          githubUrl: true,
          id: true,
          name: true,
        },
      });

      return {
        imported: true,
        project,
      };
    }),

  getProjects: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.project.findMany({
      where: {
        User: {
          some: {
            id: ctx.userId,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }),

  getProjectDetails: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
      }),
    )
    .query(async ({ ctx, input }) => {
      return await ctx.db.project.findFirst({
        where: {
          id: input.projectId,
          User: {
            some: {
              id: ctx.userId,
            },
          },
        },
        include: {
          User: {
            select: {
              id: true,
              name: true,
            },
          },
          Commit: {
            select: {
              id: true,
              commitMessage: true,
              commitDate: true,
              commitHash: true,
            },
            orderBy: {
              commitDate: "desc",
            },
            take: 5,
          },
          Meeting: {
            select: {
              id: true,
              name: true,
              url: true,
              createdAt: true,
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 5,
          },
          _count: {
            select: {
              Commit: true,
              Meeting: true,
              Question: true,
              User: true,
            },
          },
        },
      });
    }),

  getCommits: protectedProcedure
    .input(
      z.object({
        projectId: z.string().nullable(),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (!input.projectId) {
        return [];
      }

      const hasAccess = await ctx.db.project.findFirst({
        where: {
          id: input.projectId,
          User: {
            some: {
              id: ctx.userId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!hasAccess) {
        return [];
      }

      return await ctx.db.commit.findMany({
        where: {
          projectId: input.projectId,
        },
        select: {
          id: true,
          commitMessage: true,
          commitHash: true,
          commitAuthorName: true,
          commitAuthorAvatar: true,
          commitDate: true,
          summary: true,
        },
        orderBy: {
          commitDate: "desc",
        },
        take: 50,
      });
    }),

  syncCommits: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const hasAccess = await ctx.db.project.findFirst({
        where: {
          id: input.projectId,
          User: {
            some: {
              id: ctx.userId,
            },
          },
        },
        select: {
          id: true,
        },
      });

      if (!hasAccess) {
        throw new Error("Project not found or access denied");
      }

      const commitsWithSummary = await pollCommits(input.projectId);
      if (commitsWithSummary.length === 0) {
        return { inserted: 0 };
      }

      const existing = await ctx.db.commit.findMany({
        where: {
          projectId: input.projectId,
          commitHash: {
            in: commitsWithSummary.map((commit) => commit.commitHash),
          },
        },
        select: {
          commitHash: true,
        },
      });

      const existingHashes = new Set(
        existing.map((commit) => commit.commitHash),
      );
      const toInsert = commitsWithSummary.filter(
        (commit) => !existingHashes.has(commit.commitHash),
      );

      if (toInsert.length > 0) {
        await ctx.db.commit.createMany({
          data: toInsert.map((commit) => {
            const parsedDate = new Date(commit.commitDate);
            return {
              projectId: input.projectId,
              commitHash: commit.commitHash,
              commitMessage: commit.commitMessage,
              commitAuthorName: commit.commitAuthorName,
              commitAuthorAvatar: commit.commitAuthorAvatar,
              commitDate: Number.isNaN(parsedDate.getTime())
                ? new Date()
                : parsedDate,
              summary: commit.summary,
            };
          }),
        });
      }

      return { inserted: toInsert.length };
    }),

  askRepoAi: protectedProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        question: z.string().min(3).max(2000),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const project = await ctx.db.project.findFirst({
        where: {
          id: input.projectId,
          User: {
            some: {
              id: ctx.userId,
            },
          },
        },
        select: {
          name: true,
          githubUrl: true,
        },
      });

      if (!project) {
        throw new Error("Project not found or access denied");
      }

      const commits = await ctx.db.commit.findMany({
        where: {
          projectId: input.projectId,
        },
        select: {
          commitHash: true,
          commitMessage: true,
          commitDate: true,
          summary: true,
        },
        orderBy: {
          commitDate: "desc",
        },
        take: 20,
      });

      const answer = await askRepoQuestion({
        projectName: project.name,
        githubUrl: project.githubUrl,
        question: input.question,
        commits,
      });

      return { answer };
    }),
});
