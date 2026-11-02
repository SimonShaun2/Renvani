import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({ CLERK_SECRET_KEY: "" }));
vi.mock("@fsm/config", () => ({ env: mockEnv }));

import { syncClerkUserRoleMetadata } from "./clerk-role-metadata.js";

describe("syncClerkUserRoleMetadata", () => {
  beforeEach(() => {
    mockEnv.CLERK_SECRET_KEY = "sk_test_x";
  });

  it("PATCHes public_metadata.role on the Clerk user (merge)", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    await expect(syncClerkUserRoleMetadata("user_1", "owner", fetchImpl)).resolves.toBe("synced");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { method: string; body: string; headers: Record<string, string> }];
    expect(url).toBe("https://api.clerk.com/v1/users/user_1/metadata");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ public_metadata: { role: "owner" } });
    expect(init.headers.authorization).toBe("Bearer sk_test_x");
  });

  it("is disabled without CLERK_SECRET_KEY (no call)", async () => {
    mockEnv.CLERK_SECRET_KEY = "";
    const fetchImpl = vi.fn();
    await expect(syncClerkUserRoleMetadata("user_1", "owner", fetchImpl)).resolves.toBe("disabled");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never throws on HTTP or network failure", async () => {
    await expect(syncClerkUserRoleMetadata("user_1", "owner", vi.fn(async () => ({ ok: false, status: 500 })))).resolves.toBe("failed");
    await expect(
      syncClerkUserRoleMetadata("user_1", "owner", vi.fn(async () => { throw new Error("down"); }))
    ).resolves.toBe("failed");
  });

  it("encodes the user id in the path", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200 }));
    await syncClerkUserRoleMetadata("../x", "admin", fetchImpl);
    expect((fetchImpl.mock.calls[0] as unknown as [string])[0]).toBe("https://api.clerk.com/v1/users/..%2Fx/metadata");
  });
});
