import { verifyToken } from "@clerk/backend";

import { featureFlags } from "@fsm/config/feature-flags";
import { AppError, ErrorCode, type UserRole } from "@fsm/types";

/** Custom session-token claim carrying the Renvani staff role (set via Clerk session token template). */
export const CLERK_ROLE_CLAIM = "renvani_role";

const USER_ROLES: readonly UserRole[] = ["owner", "admin", "dispatcher", "office", "technician"];

export interface ClerkVerifiedSession {
  clerkUserId: string;
  clerkOrganizationId: string;
  email: string | null;
  role: UserRole | null;
}

export function parseClerkAuthorizedParties(raw: string | undefined = process.env.CLERK_AUTHORIZED_PARTIES): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().replace(/\/$/, ""))
    .filter((entry) => entry.length > 0);
}

export function extractClerkRoleClaim(payload: Record<string, unknown>): UserRole | null {
  const raw = payload[CLERK_ROLE_CLAIM];
  return typeof raw === "string" && (USER_ROLES as readonly string[]).includes(raw) ? (raw as UserRole) : null;
}

function readClerkSecretKey(): string | null {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  return secret && secret.length > 0 ? secret : null;
}

export function isClerkParallelAuthAvailable(): boolean {
  // FEATURE FLAG: clerk-auth-parallel-jwt
  return featureFlags.clerkAuthParallelJwt && readClerkSecretKey() !== null;
}

export function extractClerkOrganizationId(payload: Record<string, unknown>): string | null {
  const orgId = payload.org_id;
  if (typeof orgId === "string" && orgId.length > 0) {
    return orgId;
  }
  const org = payload.o;
  if (org && typeof org === "object" && !Array.isArray(org)) {
    const nestedId = (org as { id?: unknown }).id;
    if (typeof nestedId === "string" && nestedId.length > 0) {
      return nestedId;
    }
  }
  return null;
}

export async function verifyClerkBearerToken(accessToken: string): Promise<ClerkVerifiedSession> {
  if (!isClerkParallelAuthAvailable()) {
    throw new AppError(ErrorCode.FORBIDDEN, "Clerk authentication is not enabled");
  }

  const secretKey = readClerkSecretKey();
  if (!secretKey) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Clerk secret is not configured");
  }

  let payload: Record<string, unknown>;
  try {
    const authorizedParties = parseClerkAuthorizedParties();
    payload = (await verifyToken(accessToken, {
      secretKey,
      ...(authorizedParties.length > 0 ? { authorizedParties } : {})
    })) as Record<string, unknown>;
  } catch {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid Clerk session token");
  }

  const clerkUserId = payload.sub;
  if (typeof clerkUserId !== "string" || clerkUserId.length === 0) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Clerk session missing subject");
  }

  const clerkOrganizationId = extractClerkOrganizationId(payload);
  if (!clerkOrganizationId) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Clerk session missing organization");
  }

  const emailClaim = payload.email;
  const email = typeof emailClaim === "string" ? emailClaim : null;

  return {
    clerkUserId,
    clerkOrganizationId,
    email,
    role: extractClerkRoleClaim(payload)
  };
}
