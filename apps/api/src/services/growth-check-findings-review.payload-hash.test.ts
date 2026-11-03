/**
 * #376 review nit: the findings-review idempotency hash moved to the shared key-sorted canonicalJson. Review bodies
 * are flat with lowercase-ASCII-leading keys, so the new hash equals the pre-#376 hash (top-level localeCompare sort
 * + JSON.stringify); stored payload_hash values still match on replay.
 */
import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

vi.mock("@fsm/jobs", () => ({ aiQueue: { add: vi.fn() }, notificationsQueue: { add: vi.fn() } }));

const { findingReviewPayloadHash } = await import("./growth-check-findings-review.service.js");

function legacyHash(body: Record<string, unknown>): string {
  const { idempotencyKey: _ignored, ...rest } = body;
  const sorted = Object.fromEntries(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)));
  return createHash("sha256").update(JSON.stringify(sorted)).digest("hex");
}

const bodies = [
  { action: "edit", status: "confirmed", summary: "Updated copy", reason: "Copy changed", expectedRevision: 4, idempotencyKey: "edit-key-0002" },
  { action: "mark_not_applicable", reason: "No storefront", expectedRevision: 0, idempotencyKey: "na-key-0001" },
  { action: "dismiss", reason: "Not relevant", expectedRevision: 1, idempotencyKey: "dis-key-0001" },
  { action: "add_note", note: "Checked on mobile too", expectedRevision: 1, idempotencyKey: "note-key-0001" },
  { action: "request_owner_validation", expectedRevision: 2, idempotencyKey: "ask-key-0001" },
  { action: "owner_confirm", note: undefined, expectedRevision: 3, idempotencyKey: "conf-key-0002" },
  { action: "owner_reject", note: "We do take online requests", expectedRevision: 2, idempotencyKey: "rej-key-0001" },
  { action: "owner_cannot_answer", expectedRevision: 1, idempotencyKey: "cant-key-0001" }
];

describe("findings-review payloadHash (canonicalJson)", () => {
  it.each(bodies)("matches the pre-#376 stored hash for $action", (body) => {
    expect(findingReviewPayloadHash(body as never)).toBe(legacyHash(body));
  });

  it("is independent of key order and ignores the idempotency key", () => {
    const a = { action: "dismiss", reason: "Not relevant", expectedRevision: 1, idempotencyKey: "k-0000001" };
    const b = { idempotencyKey: "k-0000002", expectedRevision: 1, reason: "Not relevant", action: "dismiss" };
    expect(findingReviewPayloadHash(a as never)).toBe(findingReviewPayloadHash(b as never));
  });
});
