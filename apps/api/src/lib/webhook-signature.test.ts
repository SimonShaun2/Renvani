import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const timingSafeEqualSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    timingSafeEqual: (a: NodeJS.ArrayBufferView, b: NodeJS.ArrayBufferView) => {
      timingSafeEqualSpy.calls += 1;
      return actual.timingSafeEqual(a, b);
    }
  };
});

const { constantTimeEqual, parseSignedTimestampMs, verifySignedWebhook } = await import("./webhook-signature.js");

const secret = "unit-test-secret";
const now = Date.UTC(2026, 9, 31, 18, 0, 0);
const ts = String(Math.floor(now / 1000));
const body = '{"providerCallId":"CA-1"}';
const sign = (t: string, raw: string, key = secret, enc: "hex" | "base64" = "hex") => createHmac("sha256", key).update(`${t}.${raw}`).digest(enc);
const base = { secret, rawBody: body, timestamp: ts, toleranceMs: 300_000, nowMs: now };

afterEach(() => {
  timingSafeEqualSpy.calls = 0;
});

describe("verifySignedWebhook", () => {
  it("accepts a valid HMAC over `${timestamp}.${rawBody}` using timingSafeEqual", () => {
    expect(verifySignedWebhook({ ...base, signature: sign(ts, body) })).toEqual({ ok: true, signedAtMs: now });
    expect(timingSafeEqualSpy.calls).toBe(1);
    expect(verifySignedWebhook({ ...base, signature: sign(ts, body, secret, "base64"), encoding: "base64" }).ok).toBe(true);
  });

  it("fails closed on tampered body, wrong secret, wrong length or garbage signatures", () => {
    expect(verifySignedWebhook({ ...base, signature: sign(ts, `${body} `) })).toEqual({ ok: false, reason: "signature_mismatch" });
    expect(verifySignedWebhook({ ...base, signature: sign(ts, body, "other") }).ok).toBe(false);
    expect(verifySignedWebhook({ ...base, signature: sign(ts, body).slice(0, 10) }).ok).toBe(false);
    expect(verifySignedWebhook({ ...base, signature: "zz-not-hex" }).ok).toBe(false);
    // The signature binds the timestamp: a fresh header with an old signature fails.
    expect(verifySignedWebhook({ ...base, signature: sign(String(Number(ts) - 1), body) }).ok).toBe(false);
  });

  it("requires a secret, a signature and a signed timestamp inside the tolerance window", () => {
    expect(verifySignedWebhook({ ...base, secret: undefined, signature: sign(ts, body) })).toEqual({ ok: false, reason: "missing_secret" });
    expect(verifySignedWebhook({ ...base, signature: "" })).toEqual({ ok: false, reason: "missing_signature" });
    expect(verifySignedWebhook({ ...base, timestamp: undefined, signature: sign(ts, body) })).toEqual({ ok: false, reason: "missing_timestamp" });
    expect(verifySignedWebhook({ ...base, timestamp: "12abc", signature: sign("12abc", body) })).toEqual({ ok: false, reason: "missing_timestamp" });
    const old = String(Math.floor((now - 301_000) / 1000));
    expect(verifySignedWebhook({ ...base, timestamp: old, signature: sign(old, body) })).toEqual({ ok: false, reason: "timestamp_outside_window" });
    const future = String(Math.floor((now + 301_000) / 1000));
    expect(verifySignedWebhook({ ...base, timestamp: future, signature: sign(future, body) })).toEqual({ ok: false, reason: "timestamp_outside_window" });
    expect(timingSafeEqualSpy.calls).toBe(0);
  });

  it("parses seconds or milliseconds and rejects junk", () => {
    expect(parseSignedTimestampMs(ts)).toBe(now);
    expect(parseSignedTimestampMs(String(now))).toBe(now);
    for (const v of [undefined, null, "", "-1", "0", "1.5", "abc", "99999999999999999"]) expect(parseSignedTimestampMs(v)).toBeNull();
  });

  it("constantTimeEqual never throws on length mismatch and rejects empty buffers", () => {
    expect(constantTimeEqual(Buffer.from("ab"), Buffer.from("abc"))).toBe(false);
    expect(constantTimeEqual(Buffer.alloc(0), Buffer.alloc(0))).toBe(false);
    expect(constantTimeEqual(Buffer.from("abc"), Buffer.from("abc"))).toBe(true);
  });
});
