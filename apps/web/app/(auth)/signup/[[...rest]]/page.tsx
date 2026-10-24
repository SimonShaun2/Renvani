import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/src/components/auth/AuthShell";
import { LegacySignupForm } from "@/src/components/auth/LegacySignupForm";
import { renvaniClerkAppearance } from "@/src/lib/clerk/appearance";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH, isClerkEnabled } from "@/src/lib/clerk/config";

export default function SignupPage() {
  if (!isClerkEnabled()) {
    return <LegacySignupForm />;
  }

  return (
    <AuthShell>
      <SignUp
        routing="path"
        path={CLERK_SIGN_UP_PATH}
        signInUrl={CLERK_SIGN_IN_PATH}
        appearance={renvaniClerkAppearance}
      />
    </AuthShell>
  );
}
