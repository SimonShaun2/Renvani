import pino from "pino";

import { env } from "@fsm/config";
import type { UserRole } from "@fsm/types";

const logger = pino({ name: "clerk-role-metadata" });

const CLERK_API_BASE = "https://api.clerk.com/v1";

type FetchLike = (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

export type ClerkRoleSyncResult = "synced" | "disabled" | "failed";

/**
 * Writes the Renvani staff role to the Clerk user's public_metadata.role (merge; other keys untouched).
 * The web middleware and the API read the role ONLY from the session claim metadata.role
 * (template "{{user.public_metadata}}"); without this write a newly provisioned owner has no role
 * claim and is routed to /no-access. Server-side only (CLERK_SECRET_KEY). Never throws.
 */
export async function syncClerkUserRoleMetadata(
  clerkUserId: string,
  role: UserRole,
  fetchImpl: FetchLike = fetch as unknown as FetchLike
): Promise<ClerkRoleSyncResult> {
  const secretKey = env.CLERK_SECRET_KEY.trim();
  const id = clerkUserId.trim();
  if (!secretKey || !id) return "disabled";
  try {
    const response = await fetchImpl(`${CLERK_API_BASE}/users/${encodeURIComponent(id)}/metadata`, {
      method: "PATCH",
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
      body: JSON.stringify({ public_metadata: { role } })
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, "Clerk role metadata sync failed");
      return "failed";
    }
    return "synced";
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : "unknown" }, "Clerk role metadata sync errored");
    return "failed";
  }
}
