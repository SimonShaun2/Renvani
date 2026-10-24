import { isPublicRoute } from "../route-access";

export type ClerkRouteDecision = { action: "next" } | { action: "redirect"; to: string };

export const CLERK_SIGNED_IN_HOME = "/dashboard";

/**
 * Route decision for a request with no legacy JWT cookie, given the Clerk session state.
 * Public token routes always pass through; tenant scoping and role checks stay server-side (API).
 */
export function resolveClerkRouteDecision(pathname: string, clerkUserId: string | null | undefined): ClerkRouteDecision {
  if (clerkUserId) {
    if (pathname === "/login" || pathname.startsWith("/login/") || pathname === "/signup" || pathname.startsWith("/signup/")) {
      return { action: "redirect", to: CLERK_SIGNED_IN_HOME };
    }

    return { action: "next" };
  }

  if (isPublicRoute(pathname) || pathname.startsWith("/login/") || pathname.startsWith("/signup/")) {
    return { action: "next" };
  }

  return { action: "redirect", to: "/login" };
}
