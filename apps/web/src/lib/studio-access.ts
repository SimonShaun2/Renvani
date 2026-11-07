import { resolveClerkRole } from "./clerk/route-decision";
import type { UserRole } from "./route-access";

/** Owner, admin and office staff may open the embedded Sanity Studio. Sanity's own login still applies inside. */
export const STUDIO_ROLES: readonly UserRole[] = ["owner", "admin", "office"];

export type StudioAccess = "allow" | "sign-in" | "forbidden";

export function isStudioPath(pathname: string): boolean {
  return pathname === "/studio" || pathname.startsWith("/studio/");
}

/**
 * Studio access from a VERIFIED Clerk session only (userId + role from signed session claims).
 * Legacy auth cookies are never consulted: they are not signature-verified in this app.
 * No Clerk user → sign in; signed in with any other role (or none) → 403.
 */
export function decideStudioAccess(clerkUserId: string | null | undefined, role: UserRole | null | undefined): StudioAccess {
  if (!clerkUserId) return "sign-in";
  return role && STUDIO_ROLES.includes(role) ? "allow" : "forbidden";
}

export function decideStudioAccessFromClaims(clerkUserId: string | null | undefined, sessionClaims: unknown): StudioAccess {
  return decideStudioAccess(clerkUserId, clerkUserId ? resolveClerkRole(sessionClaims) : null);
}
