import { createHash } from "node:crypto";

/** Stable fingerprint for FS37-style idempotency replay checks on import steps (Node-only). */
export function hashImportWorkflowStepFingerprint(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
