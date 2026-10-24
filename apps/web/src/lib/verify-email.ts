import {
  getLoginRedirectPath,
  setBrowserAuthSession,
  type AuthResponse,
  type AuthSessionSnapshot,
} from "./auth";

export const VERIFY_EMAIL_INVALID_MESSAGE = "This link is invalid or expired";

export interface VerifyEmailDeps {
  post: (path: string, body: unknown) => Promise<AuthResponse>;
  setAuth: (
    user: AuthSessionSnapshot["user"],
    company: AuthSessionSnapshot["company"],
    accessToken: string,
  ) => void;
  redirect: (path: string) => void;
  setSession?: (response: AuthResponse) => AuthSessionSnapshot;
}

/** Verifies the email token and, on success, signs the user in exactly like login does. */
export async function verifyEmailAndSignIn(
  token: string | null | undefined,
  deps: VerifyEmailDeps,
): Promise<{ status: "ok" } | { status: "invalid" }> {
  if (!token || !token.trim()) {
    return { status: "invalid" };
  }

  try {
    const response = await deps.post("/api/v1/auth/verify-email", { token });
    const session = (deps.setSession ?? setBrowserAuthSession)(response);
    deps.setAuth(session.user, session.company, response.tokens.accessToken);
    deps.redirect(getLoginRedirectPath(session.role));
    return { status: "ok" };
  } catch {
    return { status: "invalid" };
  }
}
