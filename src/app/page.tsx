import { auth } from "@clerk/nextjs/server";
import {
  Bot,
  Check,
  GitBranch,
  LockKeyhole,
  MessageSquareText,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AnimatedLandingBackground } from "@/components/landing/animated-background";
import { LandingOAuthButtons } from "@/components/landing/oauth-buttons";

const features = [
  {
    title: "Repository-aware answers",
    description:
      "Ask questions against synced commit context and project history.",
    icon: MessageSquareText,
  },
  {
    title: "Commit intelligence",
    description:
      "Summaries, freshness signals, and repository insights in one workspace.",
    icon: GitBranch,
  },
  {
    title: "Secure workspace",
    description:
      "Authentication-gated project pages with protected dashboard routes.",
    icon: LockKeyhole,
  },
] as const;

export default async function Home() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  }

  return (
    <main className="bg-background text-foreground min-h-svh">
      <section className="relative isolate flex min-h-[92svh] overflow-hidden border-b">
        <Image
          src="/create.png"
          alt=""
          fill
          priority
          sizes="100vw"
          aria-hidden="true"
          className="object-cover object-center opacity-[0.05] grayscale"
        />
        <AnimatedLandingBackground />
        <div className="from-background/25 via-background/80 to-background absolute inset-0 bg-gradient-to-b" />

        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-foreground text-background flex size-8 items-center justify-center rounded-md text-sm font-semibold shadow-lg shadow-black/10">
                D
              </div>
              <span className="text-sm font-semibold tracking-tight">
                Dionysus
              </span>
            </Link>

            <nav className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="text-muted-foreground hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors"
              >
                Login
              </Link>
              <Link
                href="/sign-up"
                className="bg-foreground text-background rounded-md px-3 py-2 text-sm font-medium shadow-sm transition-all hover:-translate-y-0.5 hover:opacity-90"
              >
                Sign up
              </Link>
            </nav>
          </header>

          <div className="flex flex-1 items-center justify-center py-16 text-center sm:py-20">
            <div className="mx-auto flex max-w-4xl flex-col items-center">
              <div className="bg-background/80 text-muted-foreground inline-flex items-center gap-2 rounded-full border border-black/10 px-3 py-1 text-xs font-medium shadow-sm backdrop-blur">
                <Sparkles className="size-3.5" />
                AI workspace for Git repositories
              </div>
              <h1 className="mt-6 text-5xl font-semibold tracking-tight text-balance sm:text-7xl">
                Dionysus AI Git Workspace
              </h1>
              <p className="text-muted-foreground mt-5 max-w-2xl text-base leading-7 text-balance sm:text-lg">
                Connect a repository, sync commit summaries, ask focused
                engineering questions, and keep project context clear before the
                next change lands.
              </p>

              <LandingOAuthButtons />

              <div className="text-muted-foreground mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4" />
                  Google sign-in
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4" />
                  GitHub sign-in
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4" />
                  Protected workspace
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl gap-3 px-4 py-10 sm:px-6 md:grid-cols-3 lg:px-8">
        {features.map((feature) => {
          const FeatureIcon = feature.icon;

          return (
            <article
              key={feature.title}
              className="bg-card hover:border-foreground/20 rounded-lg border p-5 transition-colors"
            >
              <div className="mb-4 flex size-9 items-center justify-center rounded-md border">
                <FeatureIcon className="size-4" />
              </div>
              <h2 className="text-sm font-semibold">{feature.title}</h2>
              <p className="text-muted-foreground mt-2 text-sm leading-6">
                {feature.description}
              </p>
            </article>
          );
        })}
      </section>

      <section className="mx-auto w-full max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
        <div className="bg-foreground text-background flex flex-col gap-4 rounded-lg border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 text-sm font-medium">
              <Bot className="size-4" />
              Ready when your repository is
            </div>
            <p className="text-background/70 mt-2 max-w-xl text-sm leading-6">
              Sign in with Google or GitHub, then continue directly into your
              dashboard.
            </p>
          </div>
          <Link
            href="/sign-up"
            className="bg-background text-foreground inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Create account
          </Link>
        </div>
      </section>
    </main>
  );
}
