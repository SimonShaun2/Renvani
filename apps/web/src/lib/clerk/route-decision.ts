import { canRoleAccessPath, getDefaultRouteForRole, isPublicRoute, normalizeUserRole, type UserRole } from "../route-access";

export type ClerkRouteDecision = { action: "next" } | { action: "redirect"; to: string };

/** Where a signed-in Clerk user without a resolvable role (no tenant/staff mapping) is sent. Public page. */
export const CLERK_NO_ACCESS_ROUTE = "/no-access";

/**
 * Resolves the staff role for a Clerk session from its session claims.
 * The role must be put into the session token (Clerk session-token template), e.g.
 * `{ "metadata": { "role": "{{user.public_metadata.role}}" } }` or a top-level `role` claim.
 * Anything that is not a known Renvani role resolves to null (no access to staff pages).
 */
export function resolveClerkRole(sessionClaims: unknown): UserRole | null {
  if (!sessionClaims || typeof sessionClaims !== "object") return null;
  const claims = sessionClaims as Record<string, unknown>;
  const metadata = (claims.metadata ?? claims.public_metadata ?? claims.publicMetadata) as Record<string, unknown> | undefined;
  return normalizeUserRole(claims.role) ?? normalizeUserRole(metadata && typeof metadata === "object" ? metadata.role : undefined);
}

function isAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/login/") || pathname === "/signup" || pathname.startsWith("/signup/");
}

/**
 * Route decision for a request with no legacy JWT cookie, given the Clerk session state.
 * Mirrors the legacy-cookie path: signed-in users go to their role's default route from
 * auth pages and "/", and staff pages are gated with canRoleAccessPath. A Clerk session
 * with no resolvable role can only reach public routes and the no-access page.
 */
export function resolveClerkRouteDecision(
  pathname: string,
  clerkUserId: string | null | undefined,
  role: UserRole | null = null
): ClerkRouteDecision {
  if (clerkUserId) {
    if (pathname === CLERK_NO_ACCESS_ROUTE) return { action: "next" };
    const home = role ? getDefaultRouteForRole(role) : CLERK_NO_ACCESS_ROUTE;
    if (isAuthPage(pathname) || pathname === "/") return { action: "redirect", to: home };
    if (isPublicRoute(pathname)) return { action: "next" };
    if (!role) return { action: "redirect", to: CLERK_NO_ACCESS_ROUTE };
    return canRoleAccessPath(role, pathname) ? { action: "next" } : { action: "redirect", to: home };
  }

  if (isPublicRoute(pathname) || pathname.startsWith("/login/") || pathname.startsWith("/signup/") || pathname === CLERK_NO_ACCESS_ROUTE) {
    return { action: "next" };
  }

  return { action: "redirect", to: "/login" };
}
