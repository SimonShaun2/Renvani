import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/src/components/auth/AuthShell";
import { LegacyLoginForm } from "@/src/components/auth/LegacyLoginForm";
import { renvaniClerkAppearance } from "@/src/lib/clerk/appearance";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH, isClerkEnabled } from "@/src/lib/clerk/config";

export default function LoginPage() {
  if (!isClerkEnabled()) {
    return <LegacyLoginForm />;
  }

  return (
    <AuthShell>
      <SignIn
        routing="path"
        path={CLERK_SIGN_IN_PATH}
        signUpUrl={CLERK_SIGN_UP_PATH}
        appearance={renvaniClerkAppearance}
      />
    </AuthShell>
  );
}
