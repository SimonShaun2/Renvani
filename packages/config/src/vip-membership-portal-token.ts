import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "./env.js";

/**
 * Legacy grace period: tokens issued before expiry was added carry no exp segment.
 * They are accepted until this fixed cutoff (deploy date 2026-10-24 + 30 days), then rejected.
 * Remove the legacy branch after this date.
 */
export const LEGACY_TOKEN_CUTOFF = new Date("2026-11-23T00:00:00Z");

function signingSecret(): string {
  return env.JWT_SECRET;
}

export const VIP_MEMBERSHIP_JOIN_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function encodePayload(companyId: string, customerId: string, vipTierId: string, expiresAt: number): string {
  return `${companyId}:${customerId}:${vipTierId}:${expiresAt}`;
}

export function signVipMembershipJoinToken(
  companyId: string,
  customerId: string,
  vipTierId: string,
  ttlSeconds: number = VIP_MEMBERSHIP_JOIN_TOKEN_TTL_SECONDS
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = encodePayload(companyId, customerId, vipTierId, expiresAt);
  const signature = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyVipMembershipJoinToken(
  token: string
): { companyId: string; customerId: string; vipTierId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 2) {
    return null;
  }

  const payload = parts[0];
  const signature = parts[1];
  if (!payload || !signature) {
    return null;
  }

  const expected = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
    return null;
  }

  const [companyId, customerId, vipTierId, expiresAtRaw, ...rest] = payload.split(":");
  if (!companyId || !customerId || !vipTierId || rest.length > 0) {
    return null;
  }

  if (expiresAtRaw === undefined) {
    return Date.now() < LEGACY_TOKEN_CUTOFF.getTime() ? { companyId, customerId, vipTierId } : null;
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isInteger(expiresAt)) {
    return null;
  }

  if (expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { companyId, customerId, vipTierId };
}

export function buildVipMembershipJoinUrl(appBaseUrl: string, joinToken: string): string {
  const base = appBaseUrl.replace(/\/$/, "");
  return `${base}/vip/join/${joinToken}`;
}
