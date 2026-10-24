import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "./env.js";

function signingSecret(): string {
  return env.JWT_SECRET;
}

export const AGREEMENT_PORTAL_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function encodePayload(companyId: string, agreementId: string, expiresAt: number): string {
  return `${companyId}:${agreementId}:${expiresAt}`;
}

export function signAgreementPortalToken(
  companyId: string,
  agreementId: string,
  ttlSeconds: number = AGREEMENT_PORTAL_TOKEN_TTL_SECONDS
): string {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = encodePayload(companyId, agreementId, expiresAt);
  const signature = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyAgreementPortalToken(
  token: string
): { companyId: string; agreementId: string } | null {
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

  const [companyId, agreementId, expiresAtRaw, ...rest] = payload.split(":");
  const expiresAt = Number(expiresAtRaw);
  if (!companyId || !agreementId || rest.length > 0 || !Number.isInteger(expiresAt)) {
    return null;
  }

  if (expiresAt <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  return { companyId, agreementId };
}

export function buildAgreementRetryPortalUrl(appBaseUrl: string, portalToken: string): string {
  const base = appBaseUrl.replace(/\/$/, "");
  return `${base}/portal/agreements/${portalToken}`;
}

export function buildInvoiceReceiptPortalUrl(appBaseUrl: string, paymentToken: string): string {
  const base = appBaseUrl.replace(/\/$/, "");
  return `${base}/pay/${paymentToken}/receipt`;
}
