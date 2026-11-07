import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fake Clerk: auth() reports the mocked VERIFIED user id and session claims. No real keys or network.
let mockUserId: string | null = null;
let mockClaims: Record<string, unknown> | null = null;
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (handler: (auth: () => Promise<{ userId: string | null; sessionClaims: unknown }>, req: NextRequest) => unknown) =>
    (req: NextRequest) =>
      handler(async () => ({ userId: mockUserId, sessionClaims: mockClaims }), req)
}));

async function loadMiddleware() {
  vi.resetModules();
  return (await import("../middleware")).middleware as (req: NextRequest) => Promise<Response>;
}

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
/** An unsigned legacy JWT that merely claims to be an owner. */
const FORGED_OWNER = `${b64url({ alg: "none", typ: "JWT" })}.${b64url({ role: "owner", exp: 4102444800 })}.forged`;

function req(path: string, cookie?: string) {
  const headers = new Headers();
  if (cookie) headers.set("cookie", `fsm_auth_token=${cookie}`);
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe("/studio middleware gate (verified Clerk only)", () => {
  afterEach(() => vi.unstubAllEnvs());

  describe("Clerk enabled", () => {
    beforeEach(() => {
      vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
      mockUserId = null;
      mockClaims = null;
    });

    it.each(["/studio", "/studio/structure/post"])("redirects %s to sign in with no auth at all", async (path) => {
      const res = await (await loadMiddleware())(req(path));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toContain("/login");
    });

    it.each(["/studio", "/studio/structure"])("denies a forged unsigned owner cookie on %s", async (path) => {
      const res = await (await loadMiddleware())(req(path, FORGED_OWNER));
      expect(res.status).not.toBe(200);
      expect(res.headers.get("x-middleware-next")).toBeNull();
      expect(res.headers.get("location")).toContain("/login");
    });

    it("ignores a forged owner cookie that conflicts with a verified technician Clerk session (403)", async () => {
      mockUserId = "user_1";
      mockClaims = { metadata: { role: "technician" } };
      const res = await (await loadMiddleware())(req("/studio", FORGED_OWNER));
      expect(res.status).toBe(403);
    });

    it.each(["technician", "dispatcher", "unknown"])("returns HTTP 403 (not a redirect or 404) for a signed-in %s", async (role) => {
      mockUserId = "user_1";
      mockClaims = { metadata: { role } };
      for (const path of ["/studio", "/studio/structure"]) {
        const res = await (await loadMiddleware())(req(path));
        expect(res.status).toBe(403);
        expect(res.headers.get("location")).toBeNull();
      }
    });

    it("returns 403 for a signed-in user with no role", async () => {
      mockUserId = "user_1";
      mockClaims = {};
      expect((await (await loadMiddleware())(req("/studio"))).status).toBe(403);
    });

    it.each(["owner", "admin", "office"])("lets a verified Clerk %s through", async (role) => {
      mockUserId = "user_1";
      mockClaims = { metadata: { role } };
      const res = await (await loadMiddleware())(req("/studio/structure"));
      expect(res.headers.get("x-middleware-next")).toBe("1");
      expect(res.headers.get("location")).toBeNull();
    });
  });

  describe("Clerk disabled (legacy-only deployments)", () => {
    beforeEach(() => vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", ""));

    it("never admits a legacy owner cookie to /studio", async () => {
      const res = await (await loadMiddleware())(req("/studio", FORGED_OWNER));
      expect(res.headers.get("x-middleware-next")).toBeNull();
      expect(res.headers.get("location")).toContain("/login");
    });
  });
});
