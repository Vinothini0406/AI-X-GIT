import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(({ input }) => {
      // Placeholder while there is no Post model in the live database schema.
      return {
        id: "unsupported",
        name: input.name,
      };
    }),

  getLatest: publicProcedure.query(() => {
    // Placeholder while there is no Post model in the live database schema.
    return null;
  }),
});
