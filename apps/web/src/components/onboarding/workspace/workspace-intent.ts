import { publicEnv } from "@fsm/config";

import { WORKSPACE_POLL_INTERVAL_MS, WORKSPACE_POLL_TIMEOUT_MS } from "./workspace-setup.config";

export interface WorkspaceIntent {
  id: string;
  requestedName: string;
  status: "pending" | "claimed" | "uncertain" | "reconciled";
  createdAt: string;
  organizationId?: string;
}

interface WorkspaceIntentEnvelope {
  intent: WorkspaceIntent | null;
}

const WORKSPACE_INTENT_ENDPOINT = "/api/v1/onboarding/workspace-intent";

function isWorkspaceIntent(value: unknown): value is WorkspaceIntent {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" &&
    typeof record.requestedName === "string" &&
    typeof record.createdAt === "string" &&
    (record.status === "pending" || record.status === "claimed" || record.status === "uncertain" || record.status === "reconciled") &&
    (record.organizationId === undefined || typeof record.organizationId === "string");
}

async function requestWorkspaceIntent(token: string, init?: RequestInit): Promise<WorkspaceIntent | null> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}${WORKSPACE_INTENT_ENDPOINT}`, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Workspace intent request failed (${response.status})`);
  const payload = await response.json() as WorkspaceIntentEnvelope;
  if (payload.intent === null) return null;
  if (!isWorkspaceIntent(payload.intent)) throw new Error("Workspace intent response was invalid");
  if (payload.intent.status === "reconciled" && !payload.intent.organizationId) {
    throw new Error("Reconciled workspace intent omitted its organization id");
  }
  return payload.intent;
}

export async function getWorkspaceIntent(token: string): Promise<WorkspaceIntent | null> {
  return requestWorkspaceIntent(token);
}

export async function reserveWorkspaceIntent(token: string, name: string): Promise<WorkspaceIntent> {
  const intent = await requestWorkspaceIntent(token, {
    method: "POST",
    body: JSON.stringify({ name })
  });
  if (!intent) throw new Error("Workspace reservation returned no intent");
  return intent;
}

export interface WaitForWorkspaceIntentDeps {
  name: string;
  getFreshToken: () => Promise<string | null>;
  isCurrent: () => boolean;
  timeoutMs?: number;
  intervalMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export type WaitForWorkspaceIntentResult =
  | { ok: true; organizationId: string; requestedName: string }
  | { ok: false; reason: "cancelled" | "request" | "timeout" };

/**
 * Reserves the user-scoped server intent, then polls only that authenticated record until the
 * background Clerk operation is reconciled. It never searches by company name or creates an
 * organization in the browser.
 */
export async function waitForWorkspaceIntent(deps: WaitForWorkspaceIntentDeps): Promise<WaitForWorkspaceIntentResult> {
  const now = deps.now ?? Date.now;
  const intervalMs = deps.intervalMs ?? WORKSPACE_POLL_INTERVAL_MS;
  const deadline = now() + (deps.timeoutMs ?? WORKSPACE_POLL_TIMEOUT_MS);
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  try {
    const firstToken = await deps.getFreshToken();
    if (!deps.isCurrent()) return { ok: false, reason: "cancelled" };
    if (!firstToken) return { ok: false, reason: "request" };
    let intent = await reserveWorkspaceIntent(firstToken, deps.name);

    for (;;) {
      if (!deps.isCurrent()) return { ok: false, reason: "cancelled" };
      if (intent.status === "reconciled" && intent.organizationId) {
        return { ok: true, organizationId: intent.organizationId, requestedName: intent.requestedName };
      }
      if (now() + intervalMs > deadline) return { ok: false, reason: "timeout" };
      await sleep(intervalMs);
      if (!deps.isCurrent()) return { ok: false, reason: "cancelled" };
      const token = await deps.getFreshToken();
      if (!token) continue;
      intent = await getWorkspaceIntent(token) ?? intent;
    }
  } catch {
    return deps.isCurrent() ? { ok: false, reason: "request" } : { ok: false, reason: "cancelled" };
  }
}
