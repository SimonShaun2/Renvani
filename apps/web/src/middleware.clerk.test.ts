import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fake Clerk: no real keys or network. `auth()` reports the mocked user id.
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

function req(path: string) {
  return new NextRequest(`http://localhost:3000${path}`, { method: "POST" });
}

describe("middleware with Clerk enabled", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", "pk_test_fake");
    mockUserId = null;
    mockClaims = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["/pay/tok_1/receipt", "/vip/join/tok_1", "/portal/agreements/tok_1", "/book/acme", "/book/acme/schedule"])(
    "keeps %s public when signed out",
    async (path) => {
      const middleware = await loadMiddleware();
      const response = await middleware(req(path));
      expect(response.headers.get("location")).toBeNull();
    }
  );

  it("redirects signed-out staff routes to /login", async () => {
    const middleware = await loadMiddleware();
    const response = await middleware(req("/dashboard"));
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  const loc = async (path: string) => (await (await loadMiddleware())(req(path))).headers.get("location");

  it("lets a Clerk owner reach staff routes", async () => {
    mockUserId = "user_1";
    mockClaims = { metadata: { role: "owner" } };
    expect(await loc("/dashboard")).toBeNull();
  });

  it("enforces role gating for Clerk sessions like legacy sessions", async () => {
    mockUserId = "user_1";
    mockClaims = { metadata: { role: "technician" } };
    expect(await loc("/dashboard")).toBe("http://localhost:3000/mobile/jobs");
    expect(await loc("/settings")).toBe("http://localhost:3000/mobile/jobs");
    expect(await loc("/mobile/jobs")).toBeNull();
    mockClaims = { role: "dispatcher" };
    expect(await loc("/reporting")).toBe("http://localhost:3000/dispatch");
    expect(await loc("/dispatch")).toBeNull();
  });

  it("sends a Clerk session with no role to /no-access, not into the app", async () => {
    mockUserId = "user_1";
    expect(await loc("/dashboard")).toBe("http://localhost:3000/no-access");
    expect(await loc("/login")).toBe("http://localhost:3000/no-access");
    expect(await loc("/no-access")).toBeNull();
    expect(await loc("/pay/tok_1/receipt")).toBeNull();
  });

  it("sends signed-in Clerk users on /login and /signup to their role default route", async () => {
    mockUserId = "user_1";
    mockClaims = { metadata: { role: "office" } };
    expect(await loc("/login")).toBe("http://localhost:3000/dispatch");
    expect(await loc("/signup")).toBe("http://localhost:3000/dispatch");
    mockClaims = { metadata: { role: "technician" } };
    expect(await loc("/login/factor-one")).toBe("http://localhost:3000/mobile/jobs");
  });
});
