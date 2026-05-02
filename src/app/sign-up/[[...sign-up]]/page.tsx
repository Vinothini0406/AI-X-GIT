import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/components/auth/auth-shell";
import { clerkAppearance } from "@/components/auth/clerk-appearance";

export default function Page() {
  return (
    <AuthShell
      title="Create Your Account"
      subtitle="Sign up to start tracking projects, commits, and meetings."
    >
      <SignUp
        appearance={clerkAppearance}
        forceRedirectUrl="/sync-user"
        path="/sign-up"
        routing="path"
        signInUrl="/sign-in"
      />
    </AuthShell>
  );
}
