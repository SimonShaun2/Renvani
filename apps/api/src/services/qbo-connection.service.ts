import { and, eq, isNull } from "drizzle-orm";

import { env } from "@fsm/config";
import { readQboRuntimeConfig } from "@fsm/config/qbo-env";
import { QUICKBOOKS_ONGOING_SYNC_OAUTH_ENABLED } from "@fsm/config/quickbooks-oauth-gate";
import {
  buildQboAuthorizeUrl,
  buildQboOAuthState,
  exchangeQboAuthorizationCode,
  verifyQboOAuthState
} from "@fsm/config/quickbooks/intuit-oauth";
import { encryptSecret } from "@fsm/config/token-cipher";
import { db, emitEvent, qboConnections } from "@fsm/db";
import { AppError, ErrorCode, type QboConnectionStatus } from "@fsm/types";

type ConnectionRow = typeof qboConnections.$inferSelect;

export interface QboConnectionStatusView {
  status: QboConnectionStatus;
  realmId?: string;
  environment: "sandbox";
  connected: boolean;
  lastSyncAt?: string | null;
  lastErrorMessage?: string | null;
}

function mapStatus(row: ConnectionRow | undefined): QboConnectionStatusView {
  if (!row || row.status === "disconnected") {
    return {
      status: "disconnected",
      environment: "sandbox",
      connected: false
    };
  }
  return {
    status: row.status,
    realmId: row.realmId,
    environment: "sandbox",
    connected: row.status === "connected",
    lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
    lastErrorMessage: row.lastErrorMessage
  };
}

export async function getQboConnectionStatus(companyId: string): Promise<QboConnectionStatusView> {
  const [row] = await db
    .select()
    .from(qboConnections)
    .where(and(eq(qboConnections.companyId, companyId), isNull(qboConnections.deletedAt)))
    .limit(1);
  return mapStatus(row);
}

export function startQboOAuthConnect(companyId: string): { authorizeUrl: string } {
  if (!QUICKBOOKS_ONGOING_SYNC_OAUTH_ENABLED) {
    throw new AppError(ErrorCode.FORBIDDEN, "QuickBooks Online ongoing sync OAuth is disabled");
  }
  const config = readQboRuntimeConfig();
  if (!config) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "QuickBooks Online is not configured");
  }
  const state = buildQboOAuthState(companyId, env.JWT_SECRET);
  return { authorizeUrl: buildQboAuthorizeUrl(config, state) };
}

export async function completeQboOAuthCallback(input: {
  code: string;
  state: string;
  realmId: string;
  actorId: string;
}): Promise<QboConnectionStatusView> {
  const config = readQboRuntimeConfig();
  if (!config) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "QuickBooks Online is not configured");
  }
  const companyId = verifyQboOAuthState(input.state, env.JWT_SECRET);
  const tokens = await exchangeQboAuthorizationCode(config, input.code);
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  const values = {
    companyId,
    realmId: input.realmId,
    environment: "sandbox" as const,
    status: "connected" as const,
    accessTokenEnc: encryptSecret(tokens.access_token, config.tokenEncryptionKey),
    refreshTokenEnc: encryptSecret(tokens.refresh_token, config.tokenEncryptionKey),
    accessTokenExpiresAt: expiresAt,
    lastErrorMessage: null
  };

  const [existing] = await db
    .select({ id: qboConnections.id })
    .from(qboConnections)
    .where(and(eq(qboConnections.companyId, companyId), isNull(qboConnections.deletedAt)))
    .limit(1);

  if (existing) {
    await db.update(qboConnections).set(values).where(eq(qboConnections.id, existing.id));
  } else {
    await db.insert(qboConnections).values(values);
  }

  await emitEvent({
    companyId,
    actorId: input.actorId,
    eventType: "integration.qbo_connected",
    entityType: "company",
    entityId: companyId,
    summary: "QuickBooks Online sandbox connected"
  });

  return getQboConnectionStatus(companyId);
}
