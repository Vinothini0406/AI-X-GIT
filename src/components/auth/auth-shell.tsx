import { cn } from "@/lib/utils";
import { ArrowLeft, GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { Space_Grotesk } from "next/font/google";
import Link from "next/link";
import type { ReactNode } from "react";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <main
      className={cn(
        spaceGrotesk.variable,
        "bg-background text-foreground min-h-screen font-[var(--font-space-grotesk)]",
      )}
    >
      <div className="mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-6 md:grid-cols-[1fr_0.9fr] md:px-8">
        <section className="flex flex-col justify-between border-b pb-8 md:border-r md:border-b-0 md:py-8 md:pr-10">
          <div>
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
            >
              <ArrowLeft className="size-4" />
              Back to home
            </Link>
            <p className="text-muted-foreground mt-8 inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium">
              Dionysus Platform
            </p>
            <h1 className="mt-5 max-w-xl text-3xl leading-tight font-semibold tracking-tight md:text-5xl">
              Continue to your code intelligence workspace.
            </h1>
            <p className="text-muted-foreground mt-4 max-w-xl text-sm leading-6 md:text-base">
              Secure access to project insights, commit intelligence, and team
              context. Use Google, GitHub, or email to continue.
            </p>
          </div>

          <div className="mt-8 grid gap-3 text-sm md:mt-10">
            <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
              <ShieldCheck className="size-4" />
              Protected workspace routes
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
              <GitBranch className="size-4" />
              Unified Git project visibility
            </div>
            <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2">
              <Sparkles className="size-4" />
              AI-assisted engineering insights
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="bg-background w-full rounded-lg border p-5 shadow-sm md:p-7">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
              <p className="text-muted-foreground mt-1 text-sm">{subtitle}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
