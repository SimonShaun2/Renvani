
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AUTH_TOKEN_COOKIE_NAME, readServerAuthSession, type AuthSessionSnapshot } from "./auth";
import { isClerkEnabled } from "./clerk/config";
import { CLERK_NO_ACCESS_ROUTE } from "./clerk/route-decision";
import { resolveServerSession, type ServerSessionResult } from "./server-session.core";

export type { ServerSessionResult } from "./server-session.core";

/**
 * The ONE server-side session reader for (app), (mobile) and "/". Same order as middleware:
 * legacy cookie session first, then (when Clerk is enabled) the Clerk session with the role
 * read only from the `metadata.role` session claim.
 */
export async function getServerSession(): Promise<ServerSessionResult> {
  const cookieStore = await cookies();
  return resolveServerSession({
    clerkEnabled: isClerkEnabled(),
    readLegacy: () => readServerAuthSession(cookieStore),
    readLegacyToken: () => cookieStore.get(AUTH_TOKEN_COOKIE_NAME)?.value ?? null,
    readClerk: async () => {
      const state = await auth();
      return { userId: state.userId, orgId: state.orgId ?? null, sessionClaims: state.sessionClaims, getToken: () => state.getToken() };
    },
    readClerkUser: async () => {
      let user: Awaited<ReturnType<typeof currentUser>>;
      try {
        user = await currentUser();
      } catch (error) {
        throw new Error("Clerk profile lookup failed", { cause: error });
      }
      return user
        ? { email: user.primaryEmailAddress?.emailAddress ?? "", firstName: user.firstName ?? "", lastName: user.lastName ?? "" }
        : null;
    }
  });
}

/** Signed out → /login; signed in without a role → /no-access. Otherwise the session snapshot. */
export async function requireServerSession(): Promise<AuthSessionSnapshot> {
  const result = await getServerSession();
  if (result.status === "signed-out") redirect("/login");
  if (result.status === "no-role") redirect(CLERK_NO_ACCESS_ROUTE);
  return result.session;
}

/** Bearer token for server-side API calls (Clerk session token when Clerk is the source). */
export async function getServerApiToken(): Promise<string | null> {
  const result = await getServerSession();
  return result.status === "ok" ? result.getToken() : null;
}
