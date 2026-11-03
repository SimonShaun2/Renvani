import { z } from "zod";

import { env } from "./env.js";

const qboEnvironmentSchema = z.enum(["sandbox"]);

export type QboEnvironment = z.infer<typeof qboEnvironmentSchema>;

export interface QboRuntimeConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: QboEnvironment;
  tokenEncryptionKey: string;
  apiBaseUrl: string;
  oauthAuthorizeUrl: string;
  oauthTokenUrl: string;
}

const SANDBOX_API_BASE = "https://sandbox-quickbooks.api.intuit.com";
const OAUTH_AUTHORIZE_URL = "https://appcenter.intuit.com/connect/oauth2";
const OAUTH_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";

function resolveTokenEncryptionKey(): string {
  const explicit = process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY?.trim();
  if (explicit && explicit.length >= 32) {
    return explicit;
  }
  return `${env.JWT_SECRET}:qbo-token-v1`.padEnd(32, "0").slice(0, 32);
}

export function readQboRuntimeConfig(): QboRuntimeConfig | null {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET?.trim() ?? "";
  const redirectUri =
    process.env.QUICKBOOKS_REDIRECT_URI?.trim() ??
    `${env.NEXT_PUBLIC_API_URL.replace(/\/$/, "")}/quickbooks-online/connect/callback`;

  if (!clientId || !clientSecret) {
    return null;
  }

  const environment = qboEnvironmentSchema.parse(process.env.QUICKBOOKS_ENVIRONMENT ?? "sandbox");

  return {
    clientId,
    clientSecret,
    redirectUri,
    environment,
    tokenEncryptionKey: resolveTokenEncryptionKey(),
    apiBaseUrl: SANDBOX_API_BASE,
    oauthAuthorizeUrl: OAUTH_AUTHORIZE_URL,
    oauthTokenUrl: OAUTH_TOKEN_URL
  };
}

export function assertQboSandboxOnly(environment: string): void {
  if (environment !== "sandbox") {
    throw new Error("Production QuickBooks Online is not enabled");
  }
}
