import { SignUp } from "@clerk/nextjs";

import { AuthShell } from "@/src/components/auth/AuthShell";
import { LegacySignupForm } from "@/src/components/auth/LegacySignupForm";
import { WORKSPACE_SETUP_ROUTE } from "@/src/components/onboarding/workspace/workspace-setup.config";
import { renvaniClerkAppearance } from "@/src/lib/clerk/appearance";
import { CLERK_SIGN_IN_PATH, CLERK_SIGN_UP_PATH, isClerkEnabled } from "@/src/lib/clerk/config";

/**
 * Without NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY the hardened #183 legacy form is used unchanged
 * (generic failure message, 202 non-enumerating register, no session on register,
 * SIGNUP_CHECK_EMAIL_MESSAGE; rate limiting is server-side on /auth/register).
 * With Clerk enabled, sign-up runs on Clerk: enumeration protection, bot/rate limits and
 * email verification must be configured in the Clerk dashboard. /auth/register is not called.
 */
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
        fallbackRedirectUrl={WORKSPACE_SETUP_ROUTE}
        appearance={renvaniClerkAppearance}
      />
    </AuthShell>
  );
}
