import { clearBrowserAuthSession } from "./auth";
import { CLERK_NO_ACCESS_ROUTE } from "./clerk/route-decision";
import { hasClerkSession, signOutClerkSession } from "./clerk/token-bridge";

export interface CompleteClientLogoutOptions {
  clearAuth: () => void;
  redirect: (path: string) => void;
}

/** Clears tenant-local state before ending either authentication provider session. */
export async function completeClientLogout(options: CompleteClientLogoutOptions): Promise<void> {
  const clerkWasActive = hasClerkSession();

  clearBrowserAuthSession();
  options.clearAuth();

  if (await signOutClerkSession("/login")) {
    return;
  }

  options.redirect(clerkWasActive ? CLERK_NO_ACCESS_ROUTE : "/login");
}
