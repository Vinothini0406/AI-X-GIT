import { cn } from "@/lib/utils";
import { GitBranch, ShieldCheck, Sparkles } from "lucide-react";
import { Space_Grotesk } from "next/font/google";
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
        "relative min-h-screen overflow-hidden bg-slate-950 font-[var(--font-space-grotesk)] text-slate-100",
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-teal-500/35 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-orange-400/25 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.15),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(251,146,60,0.15),transparent_45%)]" />
      </div>

      <div className="relative mx-auto grid min-h-screen w-full max-w-6xl gap-8 px-4 py-8 md:grid-cols-[1.1fr_0.9fr] md:px-8">
        <section className="flex flex-col justify-between rounded-3xl border border-white/15 bg-white/5 p-6 backdrop-blur-xl md:p-10">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-teal-200">
              Dionysus Platform
            </p>
            <h1 className="mt-6 text-3xl font-semibold leading-tight text-white md:text-5xl">
              Build better with your code intelligence workspace.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 md:text-base">
              Secure access to project insights, commit intelligence, and team
              context. Sign in to continue your workflow.
            </p>
          </div>

          <div className="mt-8 grid gap-3 text-sm text-slate-200 md:mt-10">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2">
              <ShieldCheck className="size-4 text-teal-300" />
              Enterprise-grade authentication
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2">
              <GitBranch className="size-4 text-teal-300" />
              Unified Git project visibility
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-black/20 px-3 py-2">
              <Sparkles className="size-4 text-teal-300" />
              AI-assisted engineering insights
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center">
          <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl shadow-black/30 md:p-8">
            <div className="mb-5">
              <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
