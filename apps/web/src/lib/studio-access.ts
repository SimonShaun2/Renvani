import type { ServerSessionResult } from "./server-session.core";
import type { UserRole } from "./route-access";

/** Owner, admin and office staff may open the embedded Sanity Studio. Sanity's own login still applies inside. */
export const STUDIO_ROLES: readonly UserRole[] = ["owner", "admin", "office"];

export function canOpenStudio(result: ServerSessionResult): boolean {
  return result.status === "ok" && STUDIO_ROLES.includes(result.session.role);
}
