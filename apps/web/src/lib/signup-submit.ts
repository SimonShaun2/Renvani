export const SIGNUP_CHECK_EMAIL_MESSAGE = "Check your email, then sign in.";
export const SIGNUP_GENERIC_ERROR =
  "We couldn't create your account. Check your details and try again, or sign in if you already have an account.";

export type SignupOutcome = { status: "check-email" } | { status: "error" };

/**
 * POST /api/v1/auth/register answers 202 { message } with no tokens (non-enumerating).
 * Any success means "check your email"; nothing is stored. Every failure maps to one generic error.
 */
export async function submitSignup(
  post: (path: string, body: unknown) => Promise<unknown>,
  body: Record<string, unknown>
): Promise<SignupOutcome> {
  try {
    await post("/api/v1/auth/register", body);
    return { status: "check-email" };
  } catch {
    return { status: "error" };
  }
}
