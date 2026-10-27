import { createHmac, randomBytes } from "node:crypto";

import { assertQboSandboxOnly, type QboRuntimeConfig } from "../qbo-env.js";

const QBO_OAUTH_SCOPES = "com.intuit.quickbooks.accounting";

export interface IntuitTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  x_refresh_token_expires_in?: number;
}

export function buildQboOAuthState(companyId: string, secret: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${companyId}:${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

export function verifyQboOAuthState(state: string, secret: string): string {
  const decoded = Buffer.from(state, "base64url").toString("utf8");
  const [companyId, nonce, sig] = decoded.split(":");
  if (!companyId || !nonce || !sig) {
    throw new Error("Invalid OAuth state");
  }
  const expected = createHmac("sha256", secret).update(`${companyId}:${nonce}`).digest("hex");
  if (sig !== expected) {
    throw new Error("Invalid OAuth state signature");
  }
  return companyId;
}

export function buildQboAuthorizeUrl(config: QboRuntimeConfig, state: string): string {
  assertQboSandboxOnly(config.environment);
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    scope: QBO_OAUTH_SCOPES,
    redirect_uri: config.redirectUri,
    state
  });
  return `${config.oauthAuthorizeUrl}?${params.toString()}`;
}

export async function exchangeQboAuthorizationCode(
  config: QboRuntimeConfig,
  code: string
): Promise<IntuitTokenResponse> {
  assertQboSandboxOnly(config.environment);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri
  });
  const response = await fetch(config.oauthTokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`QBO token exchange failed (${response.status})`);
  }
  return (await response.json()) as IntuitTokenResponse;
}

export async function refreshQboAccessToken(
  config: QboRuntimeConfig,
  refreshToken: string
): Promise<IntuitTokenResponse> {
  assertQboSandboxOnly(config.environment);
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  const response = await fetch(config.oauthTokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body
  });
  if (!response.ok) {
    throw new Error(`QBO token refresh failed (${response.status})`);
  }
  return (await response.json()) as IntuitTokenResponse;
}
