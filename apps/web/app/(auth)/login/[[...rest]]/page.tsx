import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";

import { AuthShell } from "@/src/components/auth/AuthShell";
import { LegacyLoginForm } from "@/src/components/auth/LegacyLoginForm";
import { renvaniClerkSignInAppearance } from "@/src/lib/clerk/appearance";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH, isClerkEnabled } from "@/src/lib/clerk/config";

export const metadata: Metadata = {
  title: "Sign in to Renvani",
  description: "Sign in to access your Renvani business workspace."
};

export default function LoginPage() {
  if (!isClerkEnabled()) {
    return <LegacyLoginForm />;
  }

  return (
    <AuthShell variant="sign-in">
      <SignIn
        routing="path"
        path={CLERK_SIGN_IN_PATH}
        signUpUrl={CLERK_SIGN_UP_PATH}
        appearance={renvaniClerkSignInAppearance}
      />
    </AuthShell>
  );
}
