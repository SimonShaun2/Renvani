import { and, eq, isNull } from "drizzle-orm";

import { readQboRuntimeConfig } from "@fsm/config/qbo-env";
import { createQboApiClient } from "@fsm/config/quickbooks/qbo-api-client";
import type { QboSyncEntityType, QboSyncPullJobPayload, QboSyncPushJobPayload } from "@fsm/types";

import { resolveQboAccessTokenForCompany } from "./qbo-connection-runtime.js";
import { recordQboSyncIssue } from "./qbo-sync-issue.js";
import { db } from "./client.js";
import { emitEvent } from "./events.js";
import { customers, qboConnections } from "./schema.js";

function customerDisplayName(row: typeof customers.$inferSelect): string {
  if (row.displayName) {
    return row.displayName;
  }
  return `${row.firstName} ${row.lastName}`.trim();
}

export async function runQboSyncPushJob(payload: QboSyncPushJobPayload): Promise<void> {
  const config = readQboRuntimeConfig();
  if (!config) {
    throw new Error("QBO not configured");
  }
  const client = createQboApiClient(config);
  const { accessToken, realmId, connectionId } = await resolveQboAccessTokenForCompany(payload.companyId);

  try {
    if (payload.entityType === "customer") {
      const [row] = await db
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.companyId, payload.companyId),
            eq(customers.id, payload.entityId),
            isNull(customers.deletedAt)
          )
        )
        .limit(1);
      if (!row) {
        throw new Error("Customer not found");
      }
      const qboId = await client.upsertCustomer(accessToken, realmId, {
        DisplayName: customerDisplayName(row),
        ...(row.email ? { PrimaryEmailAddr: { Address: row.email } } : {}),
        ...(row.phone ? { PrimaryPhone: { FreeFormNumber: row.phone } } : {})
      });
      await db
        .update(customers)
        .set({ sourceSystem: "qbo", sourceId: qboId })
        .where(eq(customers.id, row.id));
    } else if (payload.entityType === "invoice" || payload.entityType === "payment") {
      await recordQboSyncIssue({
        companyId: payload.companyId,
        connectionId,
        direction: "push",
        entityType: payload.entityType,
        renvaniEntityId: payload.entityId,
        kind: "error",
        code: "NOT_IMPLEMENTED",
        message: `${payload.entityType} push mapping is not implemented yet`,
        payload: { entityId: payload.entityId }
      });
      return;
    }

    await db
      .update(qboConnections)
      .set({ lastSyncAt: new Date(), lastErrorMessage: null })
      .where(eq(qboConnections.id, connectionId));

    await emitEvent({
      companyId: payload.companyId,
      actorId: payload.actorId,
      actorType: payload.actorId ? "user" : "system",
      eventType: "integration.qbo_sync_completed",
      entityType: payload.entityType,
      entityId: payload.entityId,
      summary: `Pushed ${payload.entityType} to QuickBooks Online`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QBO push failed";
    await recordQboSyncIssue({
      companyId: payload.companyId,
      connectionId,
      direction: "push",
      entityType: payload.entityType,
      renvaniEntityId: payload.entityId,
      kind: "error",
      code: "PUSH_FAILED",
      message,
      payload: { entityId: payload.entityId }
    });
    await emitEvent({
      companyId: payload.companyId,
      actorId: payload.actorId,
      actorType: payload.actorId ? "user" : "system",
      eventType: "integration.qbo_sync_failed",
      entityType: payload.entityType,
      entityId: payload.entityId,
      summary: `QuickBooks push failed for ${payload.entityType}`,
      payload: { message }
    });
    throw error;
  }
}

export async function runQboSyncPullJob(payload: QboSyncPullJobPayload): Promise<void> {
  const config = readQboRuntimeConfig();
  if (!config) {
    throw new Error("QBO not configured");
  }
  const client = createQboApiClient(config);
  const { accessToken, realmId, connectionId } = await resolveQboAccessTokenForCompany(payload.companyId);

  const [connection] = await db
    .select()
    .from(qboConnections)
    .where(eq(qboConnections.id, connectionId))
    .limit(1);

  const changedSince =
    payload.cdcSince ??
    connection?.pullCursor ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const changes = await client.fetchCdcChanges(
      accessToken,
      realmId,
      ["Customer", "Invoice", "Payment"],
      changedSince
    );

    let latestCursor = changedSince;
    for (const change of changes) {
      if (change.lastUpdated > latestCursor) {
        latestCursor = change.lastUpdated;
      }
      const entityType: QboSyncEntityType =
        change.entityType === "Customer"
          ? "customer"
          : change.entityType === "Invoice"
            ? "invoice"
            : "payment";

      const [existingCustomer] = await db
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.companyId, payload.companyId),
            eq(customers.sourceSystem, "qbo"),
            eq(customers.sourceId, change.id),
            isNull(customers.deletedAt)
          )
        )
        .limit(1);

      if (entityType !== "customer" || existingCustomer) {
        continue;
      }

      await recordQboSyncIssue({
        companyId: payload.companyId,
        connectionId,
        direction: "pull",
        entityType,
        qboEntityId: change.id,
        kind: "conflict",
        code: "UNMAPPED_QBO_ENTITY",
        message: `Incoming QBO ${entityType} ${change.id} has no Renvani mapping`,
        payload: { change }
      });
    }

    await db
      .update(qboConnections)
      .set({
        pullCursor: latestCursor,
        lastSyncAt: new Date(),
        lastErrorMessage: null
      })
      .where(eq(qboConnections.id, connectionId));

    await emitEvent({
      companyId: payload.companyId,
      actorId: payload.actorId,
      actorType: payload.actorId ? "user" : "system",
      eventType: "integration.qbo_sync_completed",
      entityType: "company",
      entityId: payload.companyId,
      summary: "Pulled QuickBooks Online changes (CDC)",
      payload: { changeCount: changes.length }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "QBO pull failed";
    await recordQboSyncIssue({
      companyId: payload.companyId,
      connectionId,
      direction: "pull",
      entityType: "customer",
      kind: "error",
      code: "PULL_FAILED",
      message,
      payload: {}
    });
    await emitEvent({
      companyId: payload.companyId,
      actorId: payload.actorId,
      actorType: payload.actorId ? "user" : "system",
      eventType: "integration.qbo_sync_failed",
      entityType: "company",
      entityId: payload.companyId,
      summary: "QuickBooks pull failed",
      payload: { message }
    });
    throw error;
  }
}
