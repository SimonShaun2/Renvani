import { publicPost } from "./api";
import {
  getLoginRedirectPath,
  setBrowserAuthSession,
  type AuthResponse,
  type AuthSessionSnapshot,
} from "./auth";

export const VERIFY_EMAIL_INVALID_MESSAGE = "This link is invalid or expired";

export const VERIFY_EMAIL_PATH = "/api/v1/auth/verify-email";

/** Removes `token` from the current URL (keeps other params/hash) without a navigation. */
export function stripTokenFromUrl(win: Pick<Window, "location" | "history"> = window): void {
  const url = new URL(win.location.href);
  if (!url.searchParams.has("token")) return;
  url.searchParams.delete("token");
  win.history.replaceState(win.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

export interface VerifyEmailDeps {
  /** Defaults to publicPost: no bearer token, no 401 sign-out handler. */
  post?: (path: string, body: unknown) => Promise<AuthResponse>;
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
    const post = deps.post ?? ((path: string, body: unknown) => publicPost<AuthResponse>(path, body));
    const response = await post(VERIFY_EMAIL_PATH, { token });
    const session = (deps.setSession ?? setBrowserAuthSession)(response);
    deps.setAuth(session.user, session.company, response.tokens.accessToken);
    deps.redirect(getLoginRedirectPath(session.role));
    return { status: "ok" };
  } catch {
    return { status: "invalid" };
  }
}
