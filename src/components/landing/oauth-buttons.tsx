"use client";

import { useSignUp } from "@clerk/nextjs";
import { Github, Loader2 } from "lucide-react";
import { useState } from "react";

const oauthProviders = [
  {
    id: "google",
    label: "Login with Google",
    strategy: "oauth_google",
  },
  {
    id: "github",
    label: "Login with GitHub",
    strategy: "oauth_github",
  },
] as const;

type OAuthProvider = (typeof oauthProviders)[number];

export function LandingOAuthButtons() {
  const { isLoaded, signUp } = useSignUp();
  const [pendingProvider, setPendingProvider] = useState<
    OAuthProvider["id"] | null
  >(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function startOAuth(provider: OAuthProvider) {
    if (!isLoaded || !signUp || pendingProvider) return;

    setPendingProvider(provider.id);
    setErrorMessage(null);

    try {
      await signUp.authenticateWithRedirect({
        continueSignIn: true,
        continueSignUp: true,
        redirectUrl: "/sign-in/sso-callback",
        redirectUrlComplete: "/sync-user",
        strategy: provider.strategy,
      });
    } catch (error) {
      console.error(error);
      setPendingProvider(null);
      setErrorMessage("Secure login could not start. Please try again.");
    }
  }

  return (
    <div className="mt-8 w-full max-w-xl">
      <div className="grid gap-3 sm:grid-cols-2">
        {oauthProviders.map((provider) => {
          const isPending = pendingProvider === provider.id;
          const isDisabled = !isLoaded || pendingProvider !== null;
          const isGithub = provider.id === "github";

          return (
            <button
              key={provider.id}
              type="button"
              aria-busy={isPending}
              disabled={isDisabled}
              onClick={() => {
                void startOAuth(provider);
              }}
              className={
                isGithub
                  ? "inline-flex h-12 items-center justify-center gap-2 rounded-md bg-black px-4 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/90 hover:shadow-xl disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60"
                  : "inline-flex h-12 items-center justify-center gap-2 rounded-md border border-black/10 bg-white/85 px-4 text-sm font-medium text-black shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:border-black/25 hover:bg-white hover:shadow-xl disabled:pointer-events-none disabled:translate-y-0 disabled:opacity-60"
              }
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : isGithub ? (
                <Github className="size-4" />
              ) : (
                <span className="flex size-5 items-center justify-center rounded-full border border-black/15 bg-white text-[13px] leading-none font-semibold text-black">
                  G
                </span>
              )}
              <span>{provider.label}</span>
            </button>
          );
        })}
      </div>

      {errorMessage ? (
        <p className="mt-3 text-center text-sm text-red-600" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
