import { currentUser } from "@clerk/nextjs/server";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../trpc";

export const projectRouter = createTRPCRouter({
  createProject: protectedProcedure
    .input(
      z.object({
        repoUrl: z.string(),
        projectname: z.string(),
        githubToken: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const user = await currentUser();

      if (!user) {
        throw new Error("User not authenticated");
      }

      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
      const displayName =
        fullName.length > 0
          ? fullName
          : user.username ?? user.emailAddresses[0]?.emailAddress ?? "User";

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
});
