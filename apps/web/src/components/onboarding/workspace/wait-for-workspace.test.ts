import { describe, expect, it, vi } from "vitest";

import { decodeTokenClaims, waitForWorkspace } from "./wait-for-workspace";

function jwt(claims: unknown): string {
  const b64 = (v: unknown) => btoa(JSON.stringify(v)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${b64({ alg: "none" })}.${b64(claims)}.sig`;
}

function clock() {
  let t = 0;
  return { now: () => t, sleep: async (ms: number) => { t += ms; } };
}

describe("waitForWorkspace", () => {
  it("resolves once the company exists and the owner claim is present", async () => {
    const c = clock();
    const statuses = [401, 404, 200];
    const tokens = [jwt({}), jwt({}), jwt({}), jwt({ metadata: { role: "owner" } })];
    const result = await waitForWorkspace({
      getFreshToken: async () => tokens.shift() ?? null,
      checkCompany: async () => statuses.shift() ?? 200,
      ...c
    });
    expect(result).toEqual({ ok: true, role: "owner" });
  });

  it("times out with reason company when the API never succeeds (~30s)", async () => {
    const c = clock();
    const checkCompany = vi.fn(async () => 403);
    const result = await waitForWorkspace({ getFreshToken: async () => jwt({ metadata: { role: "owner" } }), checkCompany, ...c });
    expect(result).toEqual({ ok: false, reason: "company" });
    expect(c.now()).toBeLessThanOrEqual(30_000);
    expect(checkCompany.mock.calls.length).toBeGreaterThan(5);
  });

  it("times out with reason role when the claim never appears", async () => {
    const c = clock();
    const result = await waitForWorkspace({ getFreshToken: async () => jwt({}), checkCompany: async () => 200, ...c });
    expect(result).toEqual({ ok: false, reason: "role" });
  });

  it("treats network errors and missing tokens as not ready", async () => {
    const c = clock();
    const result = await waitForWorkspace({
      getFreshToken: async () => null,
      checkCompany: async () => { throw new Error("net"); },
      timeoutMs: 3000,
      ...c
    });
    expect(result).toEqual({ ok: false, reason: "company" });
  });

  it("ignores roles outside the session metadata claim", async () => {
    const c = clock();
    const result = await waitForWorkspace({ getFreshToken: async () => jwt({ role: "owner" }), checkCompany: async () => 200, timeoutMs: 2000, ...c });
    expect(result).toEqual({ ok: false, reason: "role" });
    expect(decodeTokenClaims("garbage")).toBeNull();
  });
});
