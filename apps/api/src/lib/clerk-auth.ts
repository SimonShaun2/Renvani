import { verifyToken } from "@clerk/backend";

import { env } from "@fsm/config";
import { featureFlags, isClerkAuthParallelJwtEnabled } from "@fsm/config/feature-flags";
import { AppError, ErrorCode, type UserRole } from "@fsm/types";

import { extraAppOrigins } from "./app-origins.js";

/**
 * Session-token claim carrying the Renvani staff role, shared with web (#184): `metadata.role`.
 * The Clerk session token template must map `"metadata": "{{user.public_metadata}}"` (server-controlled).
 * unsafe_metadata is never read.
 */
export const CLERK_ROLE_CLAIM = "metadata.role";

const USER_ROLES: readonly UserRole[] = ["owner", "admin", "dispatcher", "office", "technician"];

export interface ClerkVerifiedSession {
  clerkUserId: string;
  clerkOrganizationId: string;
  email: string | null;
  role: UserRole | null;
}

export function parseClerkAuthorizedParties(raw: string | undefined = env.CLERK_AUTHORIZED_PARTIES): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().replace(/\/$/, ""))
    .filter((entry) => entry.length > 0);
}

export function extractClerkRoleClaim(payload: Record<string, unknown>): UserRole | null {
  const metadata = payload.metadata;
  const raw =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as { role?: unknown }).role
      : undefined;
  return typeof raw === "string" && (USER_ROLES as readonly string[]).includes(raw) ? (raw as UserRole) : null;
}

function readClerkSecretKey(): string | null {
  // Validated config only (packages/config); blank means Clerk verify is off (fail closed).
  const secret = env.CLERK_SECRET_KEY.trim();
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

/**
 * FS-156: azp (CLERK_AUTHORIZED_PARTIES) is mandatory whenever Clerk login can be used:
 * deployment tier "staging" (where Clerk login is on) or NODE_ENV=production, or the Clerk flag is on.
 */
export function isClerkAzpRequired(source?: Record<string, string | undefined>): boolean {
  // FEATURE FLAG: clerk-auth-parallel-jwt
  return (
    featureFlags.clerkAuthParallelJwt ||
    isClerkAuthParallelJwtEnabled(source) ||
    (source ? source.NODE_ENV : env.NODE_ENV) === "production"
  );
}

export async function verifyClerkBearerToken(accessToken: string): Promise<ClerkVerifiedSession>;
export async function verifyClerkBearerToken(
  accessToken: string,
  options: { requireOrganization: false }
): Promise<Omit<ClerkVerifiedSession, "clerkOrganizationId"> & { clerkOrganizationId: string | null }>;
export async function verifyClerkBearerToken(
  accessToken: string,
  options: { requireOrganization?: boolean } = {}
): Promise<Omit<ClerkVerifiedSession, "clerkOrganizationId"> & { clerkOrganizationId: string | null }> {
  const requireOrganization = options.requireOrganization !== false;
  if (!isClerkParallelAuthAvailable()) {
    throw new AppError(ErrorCode.FORBIDDEN, "Clerk authentication is not enabled");
  }

  const secretKey = readClerkSecretKey();
  if (!secretKey) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Clerk secret is not configured");
  }

  // CLERK_AUTHORIZED_PARTIES plus APP_URL_ALLOWED extras (staging tier only; exact origins).
  const authorizedParties = [...new Set([...parseClerkAuthorizedParties(), ...extraAppOrigins()])];
  if (authorizedParties.length === 0 && isClerkAzpRequired()) {
    // Fail closed: without an azp allow-list any Clerk frontend for this instance could mint usable tokens.
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid Clerk session token");
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await verifyToken(accessToken, {
      secretKey,
      ...(authorizedParties.length > 0 ? { authorizedParties } : {})
    })) as Record<string, unknown>;
  } catch {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid Clerk session token");
  }

  // Defense in depth on top of the SDK check: azp must be present and allow-listed.
  if (authorizedParties.length > 0) {
    const azp = typeof payload.azp === "string" ? payload.azp.replace(/\/$/, "") : "";
    if (!authorizedParties.includes(azp)) {
      throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid Clerk session token");
    }
  }

  const clerkUserId = payload.sub;
  if (typeof clerkUserId !== "string" || clerkUserId.length === 0) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Clerk session missing subject");
  }

  const clerkOrganizationId = extractClerkOrganizationId(payload);
  if (!clerkOrganizationId && requireOrganization) {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Clerk session missing organization");
  }

  // Only a Clerk-verified primary email is usable for user mapping (template: email + email_verified).
  const emailClaim = payload.email;
  const emailVerified = payload.email_verified === true || payload.email_verified === "true";
  const email =
    emailVerified && typeof emailClaim === "string" && emailClaim.trim().length > 0
      ? emailClaim.trim().toLowerCase()
      : null;

  return {
    clerkUserId,
    clerkOrganizationId,
    email,
    role: extractClerkRoleClaim(payload)
  };
}
