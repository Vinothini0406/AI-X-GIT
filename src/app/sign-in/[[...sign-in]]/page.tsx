import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAppearance } from "@/components/auth/clerk-appearance";

export default function Page() {
  return (
    <AuthShell
      title="Welcome Back"
      subtitle="Sign in to continue to your engineering workspace."
    >
      <SignIn
        appearance={clerkAppearance}
        forceRedirectUrl="/dashboard"
        path="/sign-in"
        routing="path"
        signUpUrl="/sign-up"
      />
    </AuthShell>
  );
}
