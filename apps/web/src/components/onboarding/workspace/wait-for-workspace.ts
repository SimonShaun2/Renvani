import { resolveClerkRole } from "@/src/lib/clerk/route-decision";
import type { UserRole } from "@/src/lib/route-access";

import { WORKSPACE_POLL_INTERVAL_MS, WORKSPACE_POLL_TIMEOUT_MS } from "./workspace-setup.config";

export type WaitForWorkspaceResult = { ok: true; role: UserRole } | { ok: false; reason: "company" | "role" };

export interface WaitForWorkspaceDeps {
  /** Fresh Clerk session token (getToken({ skipCache: true })) so new claims appear. */
  getFreshToken: () => Promise<string | null>;
  /** GET the readiness endpoint with the bearer token; returns the HTTP status (network error → 0). */
  checkCompany: (token: string) => Promise<number>;
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const ALLOWED_SETUP_ROLES: readonly UserRole[] = ["owner", "admin"];

export function decodeTokenClaims(token: string): unknown {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=")));
  } catch {
    return null;
  }
}

/**
 * Polls until the API knows the company (2xx) AND the session claim `metadata.role` is owner/admin,
 * or the timeout passes. Role comes only from the session claim.
 */
export async function waitForWorkspace(deps: WaitForWorkspaceDeps): Promise<WaitForWorkspaceResult> {
  const timeoutMs = deps.timeoutMs ?? WORKSPACE_POLL_TIMEOUT_MS;
  const intervalMs = deps.intervalMs ?? WORKSPACE_POLL_INTERVAL_MS;
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const deadline = now() + timeoutMs;
  let companyReady = false;

  for (;;) {
    const token = await deps.getFreshToken().catch(() => null);
    if (token) {
      if (!companyReady) {
        const status = await deps.checkCompany(token).catch(() => 0);
        companyReady = status >= 200 && status < 300;
      }
      if (companyReady) {
        const role = resolveClerkRole(decodeTokenClaims(token));
        if (role && ALLOWED_SETUP_ROLES.includes(role)) return { ok: true, role };
      }
    }
    if (now() + intervalMs > deadline) return { ok: false, reason: companyReady ? "role" : "company" };
    await sleep(intervalMs);
  }
}
