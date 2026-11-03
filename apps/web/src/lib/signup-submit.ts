export const SIGNUP_CHECK_EMAIL_MESSAGE = "Thanks! If this is a new account, you can sign in now.";
export const SIGNUP_GENERIC_ERROR =
  "We couldn't create your account. Check your details and try again, or sign in if you already have an account.";
export const SIGNUP_NETWORK_ERROR = "We couldn't reach Renvani. Check your connection and try again.";
export const SIGNUP_RATE_LIMIT_ERROR = "Too many attempts, try again in a few minutes.";
export const SIGNUP_SERVER_ERROR = "Something went wrong on our side. Try again.";

export type SignupOutcome = { status: "check-email" } | { status: "error"; message: string };

function errorStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null && "status" in error) {
    const status = (error as { status: unknown }).status;
    if (typeof status === "number" && Number.isFinite(status)) return status;
  }
  return undefined;
}

/** Maps a register failure to user copy. 400/409 (and other 4xx) stay generic so signup never enumerates accounts. */
export function signupErrorMessage(error: unknown): string {
  const status = errorStatus(error);
  // No HTTP status: fetch itself rejected (offline, DNS, CORS, API origin unreachable).
  if (status === undefined) return SIGNUP_NETWORK_ERROR;
  if (status === 429) return SIGNUP_RATE_LIMIT_ERROR;
  if (status >= 500) return SIGNUP_SERVER_ERROR;
  return SIGNUP_GENERIC_ERROR;
}

/**
 * POST /api/v1/auth/register answers 202 { message } with no tokens (non-enumerating).
 * Any success means "check your email"; nothing is stored.
 */
export async function submitSignup(
  post: (path: string, body: unknown) => Promise<unknown>,
  body: Record<string, unknown>
): Promise<SignupOutcome> {
  try {
    await post("/api/v1/auth/register", body);
    return { status: "check-email" };
  } catch (error) {
    return { status: "error", message: signupErrorMessage(error) };
  }
}
