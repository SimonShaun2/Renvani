import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@fsm/config", () => ({ env: { ORIGIN_SECRET: undefined } }));

import { originSecretMatches, resolveClientIp } from "./client-ip.js";

const SECRET = "s3cr3t-value-0123456789abcdef";
const req = (headers: Record<string, string | string[]>, ip = "10.0.0.9") => ({ headers, ip });

describe("resolveClientIp", () => {
  afterEach(() => vi.restoreAllMocks());

  it("ORIGIN_SECRET unset => request.ip, forwarded headers ignored", () => {
    expect(resolveClientIp(req({ "x-vercel-forwarded-for": "1.2.3.4", "x-origin-secret": SECRET }), undefined)).toBe("10.0.0.9");
    expect(resolveClientIp(req({ "x-vercel-forwarded-for": "1.2.3.4" }), "   ")).toBe("10.0.0.9");
  });

  it("uses the env default (unset) when no secret argument is given", () => {
    expect(resolveClientIp(req({ "x-vercel-forwarded-for": "1.2.3.4", "x-origin-secret": SECRET }))).toBe("10.0.0.9");
  });

  it("matching secret => x-vercel-forwarded-for (first entry)", () => {
    expect(resolveClientIp(req({ "x-origin-secret": SECRET, "x-vercel-forwarded-for": "203.0.113.7, 10.1.1.1" }), SECRET)).toBe("203.0.113.7");
  });

  it("matching secret, no vercel header => x-real-ip (IPv6 ok)", () => {
    expect(resolveClientIp(req({ "x-origin-secret": SECRET, "x-real-ip": "2001:db8::1" }), SECRET)).toBe("2001:db8::1");
  });

  it("wrong or missing secret + spoofed headers => request.ip", () => {
    const spoof = { "x-vercel-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.6" };
    expect(resolveClientIp(req({ ...spoof, "x-origin-secret": "wrong" }), SECRET)).toBe("10.0.0.9");
    expect(resolveClientIp(req({ ...spoof, "x-origin-secret": SECRET.replace(/.$/, "X") }), SECRET)).toBe("10.0.0.9");
    expect(resolveClientIp(req(spoof), SECRET)).toBe("10.0.0.9");
  });

  it("malformed forwarded IP => falls back (x-real-ip, then request.ip)", () => {
    expect(resolveClientIp(req({ "x-origin-secret": SECRET, "x-vercel-forwarded-for": "not-an-ip", "x-real-ip": "198.51.100.2" }), SECRET)).toBe("198.51.100.2");
    expect(resolveClientIp(req({ "x-origin-secret": SECRET, "x-vercel-forwarded-for": "1.2.3.4.5", "x-real-ip": "<script>" }), SECRET)).toBe("10.0.0.9");
    expect(resolveClientIp(req({ "x-origin-secret": SECRET }), SECRET)).toBe("10.0.0.9");
  });

  it("array header values use the first value", () => {
    expect(resolveClientIp(req({ "x-origin-secret": [SECRET, "x"], "x-vercel-forwarded-for": ["192.0.2.5"] }), SECRET)).toBe("192.0.2.5");
  });

  it("never logs the secret or header values", () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    resolveClientIp(req({ "x-origin-secret": "wrong", "x-vercel-forwarded-for": "6.6.6.6" }), SECRET);
    resolveClientIp(req({ "x-origin-secret": SECRET, "x-vercel-forwarded-for": "bad" }), SECRET);
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("originSecretMatches (constant-time)", () => {
  it("equal => true; different length or content => false, without throwing", () => {
    expect(originSecretMatches(SECRET, SECRET)).toBe(true);
    expect(originSecretMatches(SECRET.slice(1), SECRET)).toBe(false);
    expect(originSecretMatches(`${SECRET}x`, SECRET)).toBe(false);
    expect(originSecretMatches("", SECRET)).toBe(false);
    expect(originSecretMatches(undefined, SECRET)).toBe(false);
    expect(originSecretMatches("é".repeat(SECRET.length / 2), SECRET)).toBe(false);
  });
});
