import type { AuthSessionSnapshot } from "./auth";
import { resolveClerkRole } from "./clerk/route-decision";

export type ServerSessionSource = "legacy" | "clerk";

export type ServerSessionResult =
  | { status: "ok"; source: ServerSessionSource; session: AuthSessionSnapshot; getToken: () => Promise<string | null> }
  | { status: "no-role" }
  | { status: "signed-out" };

export interface ServerSessionDeps {
  clerkEnabled: boolean;
  readLegacy: () => AuthSessionSnapshot | null;
  readLegacyToken: () => string | null;
  readClerk: () => Promise<{
    userId: string | null;
    orgId: string | null;
    sessionClaims: unknown;
    getToken: () => Promise<string | null>;
  }>;
  readClerkUser: () => Promise<{ email: string; firstName: string; lastName: string } | null>;
}

function claimString(claims: unknown, key: string): string | null {
  if (!claims || typeof claims !== "object") return null;
  const value = (claims as Record<string, unknown>)[key];
  return typeof value === "string" && value ? value : null;
}

/** Pure session resolution (testable). Legacy cookie wins, as in middleware; Clerk only when enabled. */
export async function resolveServerSession(deps: ServerSessionDeps): Promise<ServerSessionResult> {
  const legacy = deps.readLegacy();
  if (legacy) {
    const token = deps.readLegacyToken();
    return { status: "ok", source: "legacy", session: legacy, getToken: async () => token };
  }
  if (!deps.clerkEnabled) return { status: "signed-out" };

  const clerk = await deps.readClerk();
  if (!clerk.userId) return { status: "signed-out" };

  const role = resolveClerkRole(clerk.sessionClaims);
  if (!role) return { status: "no-role" };

  const user = await deps.readClerkUser();
  return {
    status: "ok",
    source: "clerk",
    getToken: clerk.getToken,
    session: {
      role,
      user: { id: clerk.userId, email: user?.email ?? "", firstName: user?.firstName ?? "", lastName: user?.lastName ?? "", role },
      company: { id: clerk.orgId ?? "", name: claimString(clerk.sessionClaims, "org_name") ?? "Renvani" }
    }
  };
}
