import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { AuthSessionSnapshot } from "./auth";
import { resolveServerSession, type ServerSessionDeps } from "./server-session.core";

const legacySession: AuthSessionSnapshot = {
  role: "owner",
  user: { id: "u1", email: "o@x.test", firstName: "O", lastName: "W", role: "owner" },
  company: { id: "c1", name: "Acme" }
};

function deps(over: Partial<ServerSessionDeps> = {}): ServerSessionDeps {
  return {
    clerkEnabled: true,
    readLegacy: () => null,
    readLegacyToken: () => null,
    readClerk: async () => ({ userId: null, orgId: null, sessionClaims: null, getToken: async () => null }),
    readClerkUser: async () => ({ email: "a@x.test", firstName: "Ann", lastName: "Lee" }),
    ...over
  };
}

describe("resolveServerSession: Clerk on", () => {
  it("returns the session with role from metadata.role and the Clerk token", async () => {
    const result = await resolveServerSession(
      deps({
        readClerk: async () => ({
          userId: "user_1",
          orgId: "org_1",
          sessionClaims: { metadata: { role: "admin" }, role: "owner" },
          getToken: async () => "clerk.jwt"
        })
      })
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.source).toBe("clerk");
    expect(result.session.role).toBe("admin");
    expect(result.session.user).toMatchObject({ id: "user_1", firstName: "Ann", role: "admin" });
    expect(result.session.company.id).toBe("org_1");
    expect(await result.getToken()).toBe("clerk.jwt");
  });

  it("is no-role when the claim is missing (ignores top-level role)", async () => {
    const result = await resolveServerSession(
      deps({ readClerk: async () => ({ userId: "user_1", orgId: null, sessionClaims: { role: "owner" }, getToken: async () => "t" }) })
    );
    expect(result).toEqual({ status: "no-role" });
  });

  it("is signed-out without a Clerk user", async () => {
    expect(await resolveServerSession(deps())).toEqual({ status: "signed-out" });
  });
});

describe("resolveServerSession: legacy cookie", () => {
  it("returns the cookie session and token without calling Clerk", async () => {
    const readClerk = vi.fn();
    const result = await resolveServerSession(
      deps({ clerkEnabled: false, readLegacy: () => legacySession, readLegacyToken: () => "legacy.jwt", readClerk })
    );
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.source).toBe("legacy");
    expect(result.session).toBe(legacySession);
    expect(await result.getToken()).toBe("legacy.jwt");
    expect(readClerk).not.toHaveBeenCalled();
  });

  it("is signed-out when the cookie is missing and Clerk is off", async () => {
    const readClerk = vi.fn();
    expect(await resolveServerSession(deps({ clerkEnabled: false, readClerk }))).toEqual({ status: "signed-out" });
    expect(readClerk).not.toHaveBeenCalled();
  });
});

describe("server session call sites", () => {
  const appDir = join(__dirname, "../../app");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(name)) files.push(path);
    }
  };
  walk(appDir);

  it("no app file reads the legacy cookie session directly", () => {
    const offenders = files.filter((f) => readFileSync(f, "utf8").includes("readServerAuthSession")).map((f) => relative(appDir, f));
    expect(offenders).toEqual([]);
  });

  it("the former call sites use the shared helper", () => {
    const expected = [
      "page.tsx",
      "(mobile)/layout.tsx",
      "(app)/layout.tsx",
      "(app)/reporting/page.tsx",
      "(app)/onboarding/import/page.tsx",
      "(app)/settings/import/page.tsx",
      "(app)/settings/import/photos/page.tsx",
      "(app)/settings/migrate/page.tsx"
    ];
    for (const file of expected) {
      expect(readFileSync(join(appDir, file), "utf8"), file).toMatch(/@\/src\/lib\/server-session/);
    }
  });
});
