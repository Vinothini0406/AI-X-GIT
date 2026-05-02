"use client";

import { useAuth } from "@clerk/nextjs";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Spinner } from "@/components/ui/spinner";

interface SyncErrorResponse {
  error?: string;
}

type SyncStatus = "checking" | "syncing" | "redirecting" | "error";

const MAX_SYNC_ATTEMPTS = 4;
const SYNC_RETRY_DELAY_MS = 650;

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function getSyncErrorMessage(response: Response) {
  const fallback =
    response.status === 401
      ? "Your secure session is still being prepared. Please try again."
      : "We could not prepare your workspace. Please try again.";
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return fallback;
  }

  const payload = (await response.json()) as SyncErrorResponse;
  return payload.error ?? fallback;
}

export function SyncUserClient() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const hasStartedSync = useRef(false);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<SyncStatus>("checking");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      setStatus("checking");
      return;
    }

    if (!isSignedIn) {
      router.replace("/");
      return;
    }

    if (hasStartedSync.current) return;

    let isCancelled = false;
    hasStartedSync.current = true;
    setStatus("syncing");
    setErrorMessage(null);

    async function syncUser() {
      try {
        for (
          let syncAttempt = 1;
          syncAttempt <= MAX_SYNC_ATTEMPTS;
          syncAttempt++
        ) {
          const response = await fetch("/api/auth/sync-user", {
            cache: "no-store",
            credentials: "include",
            method: "POST",
          });

          if (response.ok) {
            if (isCancelled) return;

            setStatus("redirecting");
            router.replace("/dashboard");
            return;
          }

          const shouldRetry =
            response.status === 401 && syncAttempt < MAX_SYNC_ATTEMPTS;

          if (shouldRetry) {
            await wait(SYNC_RETRY_DELAY_MS * syncAttempt);
            continue;
          }

          throw new Error(await getSyncErrorMessage(response));
        }

        throw new Error(
          "We could not prepare your workspace. Please try again.",
        );
      } catch (error) {
        if (isCancelled) return;

        console.error("[sync-user] Client sync failed.", error);
        hasStartedSync.current = false;
        setStatus("error");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not prepare your workspace. Please try again.",
        );
      }
    }

    void syncUser();

    return () => {
      isCancelled = true;
    };
  }, [attempt, isLoaded, isSignedIn, router]);

  const isError = status === "error";
  const title = isError ? "Sync Needs Attention" : "Preparing Your Workspace";
  const description = isError
    ? errorMessage
    : status === "redirecting"
      ? "Workspace is ready. Taking you to the dashboard now."
      : status === "syncing"
        ? "Syncing your profile and workspace access."
        : "Checking your secure session.";

  return (
    <main className="bg-background text-foreground relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgb(0_0_0_/_0.08),transparent_32%),linear-gradient(to_right,rgb(0_0_0_/_0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(0_0_0_/_0.05)_1px,transparent_1px)] bg-[size:100%_100%,44px_44px,44px_44px]"
      />
      <section className="bg-background/86 relative w-full max-w-md rounded-lg border border-black/10 p-6 text-center shadow-[0_24px_80px_rgba(0,0,0,0.08)] backdrop-blur">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
          {isError ? (
            <AlertCircle className="size-5 text-red-600" />
          ) : status === "redirecting" ? (
            <CheckCircle2 className="size-5 text-emerald-600" />
          ) : (
            <Spinner className="size-5" />
          )}
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">
          {description}
        </p>

        <div className="mt-6 space-y-2 text-left text-sm">
          <SyncStep isActive={isLoaded} label="Session verified" />
          <SyncStep
            isActive={status === "syncing" || status === "redirecting"}
            label="User profile synced"
          />
          <SyncStep
            isActive={status === "redirecting"}
            label="Dashboard redirect started"
          />
        </div>

        {isError ? (
          <button
            type="button"
            onClick={() => {
              hasStartedSync.current = false;
              setAttempt((currentAttempt) => currentAttempt + 1);
            }}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white transition-all hover:-translate-y-0.5 hover:bg-black/90"
          >
            Try again
          </button>
        ) : null}
      </section>
    </main>
  );
}

function SyncStep({ isActive, label }: { isActive: boolean; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-black/5 bg-white/70 px-3 py-2">
      <span
        className={
          isActive
            ? "size-2 rounded-full bg-black"
            : "bg-muted-foreground/20 size-2 rounded-full"
        }
      />
      <span className={isActive ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}
