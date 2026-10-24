import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fake Clerk: no real keys or network. `auth()` reports the mocked user id.
let mockUserId: string | null = null;
vi.mock("@clerk/nextjs/server", () => ({
  clerkMiddleware:
    (handler: (auth: () => Promise<{ userId: string | null }>, req: NextRequest) => unknown) =>
    (req: NextRequest) =>
      handler(async () => ({ userId: mockUserId }), req)
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

  it("lets a Clerk-signed-in user reach staff routes", async () => {
    mockUserId = "user_1";
    const middleware = await loadMiddleware();
    const response = await middleware(req("/dashboard"));
    expect(response.headers.get("location")).toBeNull();
  });
});
