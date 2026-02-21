// // import { createTRPCRouter, protectedProcedure } from "../trpc";
// // import { z } from "zod";

// // export { createTRPCRouter } from "../trpc";

// // export const projectRouter = createTRPCRouter({
// //     createProject: protectedProcedure
// //         .input(
// //             z.object({
// //                 repoUrl: z.string(),
// //                 projectname: z.string(),
// //                 githubToken: z.string().optional(),
// //             })
// //         )
// //         .mutation(async ({ ctx, input }) => {
// //             // console.log("User:", ctx.userId);
// //             // console.log("Input:", input);

// //             const project = await ctx.db.project.create({
// //                 data: {
// //                     githubUrl: input.repoUrl,
// //                     name: input.projectname,
// //                     userToProjects: {
// //                         create: {
// //                             userId: ctx.user.userId!,
// //                         }
// //                     }
// //                 }
// //             })
// //             return project;
// //         }),
// // });



// import { createTRPCRouter, protectedProcedure } from "../trpc";
// import { z } from "zod";

// export { createTRPCRouter } from "../trpc";

// export const projectRouter = createTRPCRouter({
//     createProject: protectedProcedure
//         .input(
//             z.object({
//                 repoUrl: z.string(),
//                 projectname: z.string(),
//                 githubToken: z.string().optional(),
//             })
//         )
//         .mutation(async ({ ctx, input }) => {
//             const project = await ctx.db.project.create({
//                 data: {
//                     githubUrl: input.repoUrl,
//                     name: input.projectname,
//                     userToProjects: {
//                         create: {
//                             userId: ctx.userId!, // ✅ correct
//                         },
//                     },
//                 },
//             });

//             return project;
//         }),
// });


// import { createTRPCRouter, protectedProcedure } from "../trpc";
// import { z } from "zod";

// export { createTRPCRouter } from "../trpc";

// export const projectRouter = createTRPCRouter({
//     createProject: protectedProcedure
//         .input(
//             z.object({
//                 repoUrl: z.string(),
//                 projectname: z.string(),
//                 githubToken: z.string().optional(),
//             })
//         )
//         .mutation(async ({ ctx, input }) => {

//             // 🟢 1️⃣ Ensure the user exists in DB (prevents FK error)
//             await ctx.db.user.upsert({
//                 where: { id: ctx.userId! },
//                 update: {},
//                 create: {
//                     id: ctx.userId!,
//                     emailAddress: "placeholder@email.com",
//                     // 👉 later replace with Clerk email sync
//                 },
//             });

//             // 🟢 2️⃣ Create project + link to user
//             const project = await ctx.db.project.create({
//                 data: {
//                     githubUrl: input.repoUrl,
//                     name: input.projectname,
//                     userToProjects: {
//                         create: {
//                             userId: ctx.userId!,
//                         },
//                     },
//                 },
//             });

//             return project;
//         }),
// });


import { createTRPCRouter, protectedProcedure } from "../trpc";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";

export const projectRouter = createTRPCRouter({
    createProject: protectedProcedure
        .input(
            z.object({
                repoUrl: z.string(),
                projectname: z.string(),
                githubToken: z.string().optional(),
            })
        )
        .mutation(async ({ ctx, input }) => {

            // 🟢 get logged-in Clerk user
            const user = await currentUser();

            if (!user) {
                throw new Error("User not authenticated");
            }

            const email =
                user.emailAddresses[0]?.emailAddress ?? `${ctx.userId}@temp.com`;

            // 🟢 ensure user exists in DB
            await ctx.db.user.upsert({
                where: { id: ctx.userId! },
                update: {},
                create: {
                    id: ctx.userId!,
                    emailAddress: email,
                    firstName: user.firstName ?? "",
                    lastName: user.lastName ?? "",
                    imageUrl: user.imageUrl ?? "",
                },
            });

            // 🟢 create project
            const project = await ctx.db.project.create({
                data: {
                    githubUrl: input.repoUrl,
                    name: input.projectname,
                    userToProjects: {
                        create: {
                            userId: ctx.userId!,
                        },
                    },
                },
            });

            return project;
        }),
});