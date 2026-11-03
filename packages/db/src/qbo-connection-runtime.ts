import { and, eq, isNull } from "drizzle-orm";

import { readQboRuntimeConfig } from "@fsm/config/qbo-env";
import { decryptSecret, encryptSecret } from "@fsm/config/token-cipher";
import { refreshQboAccessToken } from "@fsm/config/quickbooks/intuit-oauth";

import { db } from "./client.js";
import { qboConnections } from "./schema.js";

export async function resolveQboAccessTokenForCompany(companyId: string): Promise<{
  accessToken: string;
  realmId: string;
  connectionId: string;
}> {
  const config = readQboRuntimeConfig();
  if (!config) {
    throw new Error("QuickBooks Online is not configured");
  }

  const [row] = await db
    .select()
    .from(qboConnections)
    .where(and(eq(qboConnections.companyId, companyId), isNull(qboConnections.deletedAt)))
    .limit(1);

  if (!row || row.status !== "connected") {
    throw new Error("QuickBooks Online is not connected");
  }

  let accessToken = decryptSecret(row.accessTokenEnc, config.tokenEncryptionKey);
  const refreshToken = decryptSecret(row.refreshTokenEnc, config.tokenEncryptionKey);

  if (row.accessTokenExpiresAt.getTime() <= Date.now() + 60_000) {
    const refreshed = await refreshQboAccessToken(config, refreshToken);
    accessToken = refreshed.access_token;
    const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
    await db
      .update(qboConnections)
      .set({
        accessTokenEnc: encryptSecret(refreshed.access_token, config.tokenEncryptionKey),
        refreshTokenEnc: encryptSecret(refreshed.refresh_token, config.tokenEncryptionKey),
        accessTokenExpiresAt: expiresAt
      })
      .where(eq(qboConnections.id, row.id));
  }

  return { accessToken, realmId: row.realmId, connectionId: row.id };
}
