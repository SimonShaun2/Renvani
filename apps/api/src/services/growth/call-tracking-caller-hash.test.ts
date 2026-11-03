import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { deriveCallerHashKey, hashCallerNumber } from "./call-tracking-caller-hash.js";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const NUM = "+15125550123";

describe("FS-200 caller hash (keyed HMAC)", () => {
  it("is deterministic per tenant and differs across tenants and secrets", () => {
    expect(hashCallerNumber(A, NUM, "s1")).toBe(hashCallerNumber(A, NUM, "s1"));
    expect(hashCallerNumber(A, NUM, "s1")).not.toBe(hashCallerNumber(B, NUM, "s1"));
    expect(hashCallerNumber(A, NUM, "s1")).not.toBe(hashCallerNumber(A, NUM, "s2"));
    expect(hashCallerNumber(A, NUM, "s1")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is not the old unkeyed salted sha256 and never contains the number", () => {
    const legacy = createHash("sha256").update(`call-tracking:v1:${A}:${NUM}`).digest("hex");
    const h = hashCallerNumber(A, NUM, "s1");
    expect(h).not.toBe(legacy);
    expect(h).not.toContain("5550123");
  });

  it("falls back to a deterministic per-tenant salt without a secret (no throw)", () => {
    expect(() => deriveCallerHashKey(A, undefined)).not.toThrow();
    expect(hashCallerNumber(A, NUM, "")).toBe(hashCallerNumber(A, NUM, ""));
    expect(hashCallerNumber(A, NUM, "")).not.toBe(hashCallerNumber(B, NUM, ""));
    expect(hashCallerNumber(A, NUM, "")).not.toBe(hashCallerNumber(A, NUM, "s1"));
  });
});
