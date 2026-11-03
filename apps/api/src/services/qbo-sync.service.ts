import { and, eq, isNull } from "drizzle-orm";

import { featureFlags } from "@fsm/config/feature-flags";
import {
  db,
  emitEvent,
  emitEventWithExecutor,
  listOpenQboSyncIssues,
  productCatalog,
  qboEntityMappings,
  qboSyncIssues
} from "@fsm/db";
import { enqueueQboSyncPullJob, enqueueQboSyncPushJob } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  QBO_SYNC_CONTRACT_VERSION,
  type QboCatalogV1,
  type QboConnectionPhase,
  type QboEntityMappingV1,
  type QboMappingBoardV1,
  type QboMappingKind,
  type QboSyncIssueSummaryV1,
  type QboSyncRunStatus,
  type QboSyncStatusV1,
  type UpsertQboMappingsBodyV1
} from "@fsm/types";

import { alertQboSyncFailure } from "../lib/qbo-sync-sentry.js";
import { stubQboSyncCatalogPort, type QboSyncCatalogPort } from "../lib/qbo-sync-catalog.port.js";
import { getQboConnectionStatus } from "./qbo-connection.service.js";

const TAX_CODE_ROWS: Array<{ localKey: string; localLabel: string }> = [
  { localKey: "default_sales_tax", localLabel: "Default sales tax" },
  { localKey: "tax_exempt", localLabel: "Tax exempt" }
];

const PAYMENT_METHOD_ROWS: Array<{ localKey: string; localLabel: string }> = [
  { localKey: "card", localLabel: "Card" },
  { localKey: "ach", localLabel: "ACH" },
  { localKey: "cash", localLabel: "Cash" },
  { localKey: "check", localLabel: "Check" },
  { localKey: "financing", localLabel: "Financing" },
  { localKey: "other", localLabel: "Other" }
];

let catalogPort: QboSyncCatalogPort = stubQboSyncCatalogPort;

export function setQboSyncCatalogPort(port: QboSyncCatalogPort): void {
  catalogPort = port;
}

function assertQboSyncEnabled(): void {
  if (!featureFlags.qboOngoingSyncSandbox) {
    throw new AppError(ErrorCode.FORBIDDEN, "QuickBooks ongoing sync is not enabled");
  }
}

function mapConnectionPhase(
  status: Awaited<ReturnType<typeof getQboConnectionStatus>>
): QboConnectionPhase {
  if (!status.connected) {
    return "disconnected";
  }

  return "connected_sandbox";
}

function mapSyncRunStatus(
  connectionStatus: Awaited<ReturnType<typeof getQboConnectionStatus>>,
  openIssueCount: number
): QboSyncRunStatus {
  if (connectionStatus.status === "error") {
    return "error";
  }

  if (connectionStatus.status === "pending") {
    return "running";
  }

  if (openIssueCount > 0) {
    return "degraded";
  }

  return "idle";
}

async function listStoredMappings(companyId: string) {
  return db.query.qboEntityMappings.findMany({
    where: and(eq(qboEntityMappings.companyId, companyId), isNull(qboEntityMappings.deletedAt))
  });
}

function toMappingRow(
  kind: QboMappingKind,
  localKey: string,
  localLabel: string,
  stored: { qboId: string | null; qboName: string | null } | undefined
): QboEntityMappingV1 {
  const qbo =
    stored?.qboId && stored.qboName
      ? { qboId: stored.qboId, qboName: stored.qboName }
      : null;

  return {
    kind,
    localKey,
    localLabel,
    qbo
  };
}

async function buildPriceBookRows(companyId: string, storedByKey: Map<string, { qboId: string | null; qboName: string | null }>) {
  const products = await db.query.productCatalog.findMany({
    where: and(
      eq(productCatalog.companyId, companyId),
      isNull(productCatalog.deletedAt),
      eq(productCatalog.isActive, true)
    ),
    orderBy: (t, { asc }) => [asc(t.sortOrder), asc(t.name)],
    limit: 500
  });

  return products.map((product) =>
    toMappingRow(
      "price_book_item",
      product.id,
      product.name,
      storedByKey.get(`price_book_item:${product.id}`)
    )
  );
}

function buildStaticRows(
  kind: "tax_code" | "payment_method",
  rows: Array<{ localKey: string; localLabel: string }>,
  storedByKey: Map<string, { qboId: string | null; qboName: string | null }>
) {
  return rows.map((row) =>
    toMappingRow(kind, row.localKey, row.localLabel, storedByKey.get(`${kind}:${row.localKey}`))
  );
}

function indexStoredMappings(
  rows: Array<{
    kind: QboMappingKind;
    localKey: string;
    qboId: string | null;
    qboName: string | null;
  }>
) {
  const map = new Map<string, { qboId: string | null; qboName: string | null }>();

  for (const row of rows) {
    map.set(`${row.kind}:${row.localKey}`, { qboId: row.qboId, qboName: row.qboName });
  }

  return map;
}

function countMapped(mappings: QboEntityMappingV1[]) {
  return {
    priceBookItem: mappings.filter((m) => m.kind === "price_book_item" && m.qbo).length,
    taxCode: mappings.filter((m) => m.kind === "tax_code" && m.qbo).length,
    paymentMethod: mappings.filter((m) => m.kind === "payment_method" && m.qbo).length
  };
}

function toIssueSummary(row: Awaited<ReturnType<typeof listOpenQboSyncIssues>>[number]): QboSyncIssueSummaryV1 {
  return {
    id: row.id,
    direction: row.direction,
    entityType: row.entityType,
    renvaniEntityId: row.renvaniEntityId,
    qboEntityId: row.qboEntityId,
    kind: row.kind,
    code: row.code,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt ? row.resolvedAt.toISOString() : null
  };
}

export async function getQboMappingBoard(companyId: string): Promise<QboMappingBoardV1> {
  assertQboSyncEnabled();

  const stored = await listStoredMappings(companyId);
  const storedByKey = indexStoredMappings(stored);

  const priceBook = await buildPriceBookRows(companyId, storedByKey);
  const taxCodes = buildStaticRows("tax_code", TAX_CODE_ROWS, storedByKey);
  const paymentMethods = buildStaticRows("payment_method", PAYMENT_METHOD_ROWS, storedByKey);

  return {
    contractVersion: QBO_SYNC_CONTRACT_VERSION,
    companyId,
    mappings: [...priceBook, ...taxCodes, ...paymentMethods]
  };
}

export async function upsertQboMappings(
  companyId: string,
  actorId: string,
  body: UpsertQboMappingsBodyV1
): Promise<QboMappingBoardV1> {
  assertQboSyncEnabled();

  await db.transaction(async (tx) => {
    for (const mapping of body.mappings) {
      if (mapping.qbo === null) {
        await tx
          .update(qboEntityMappings)
          .set({ qboId: null, qboName: null, updatedAt: new Date() })
          .where(
            and(
              eq(qboEntityMappings.companyId, companyId),
              eq(qboEntityMappings.kind, mapping.kind),
              eq(qboEntityMappings.localKey, mapping.localKey),
              isNull(qboEntityMappings.deletedAt)
            )
          );
        continue;
      }

      await tx
        .insert(qboEntityMappings)
        .values({
          companyId,
          kind: mapping.kind,
          localKey: mapping.localKey,
          qboId: mapping.qbo.qboId,
          qboName: mapping.qbo.qboName
        })
        .onConflictDoUpdate({
          target: [qboEntityMappings.companyId, qboEntityMappings.kind, qboEntityMappings.localKey],
          set: {
            qboId: mapping.qbo.qboId,
            qboName: mapping.qbo.qboName,
            updatedAt: new Date()
          }
        });
    }

    await emitEventWithExecutor(tx, {
      companyId,
      actorId,
      actorType: "user",
      eventType: "integration.qbo_mapping_updated",
      entityType: "qbo_sync",
      entityId: companyId,
      summary: "QuickBooks field mappings updated",
      payload: { mappingCount: body.mappings.length }
    });
  });

  const board = await getQboMappingBoard(companyId);

  await enqueueQboSyncPullJob({
    companyId,
    idempotencyKey: `mapping-updated-${Date.now()}`,
    actorId
  });

  return board;
}

export async function getQboSyncStatus(companyId: string): Promise<QboSyncStatusV1> {
  assertQboSyncEnabled();

  const connectionView = await getQboConnectionStatus(companyId);
  const board = await getQboMappingBoard(companyId);
  const mappedCounts = countMapped(board.mappings);

  const issues = await listOpenQboSyncIssues({ companyId, limit: 10 });
  const allOpen = await listOpenQboSyncIssues({ companyId, limit: 500 });

  return {
    contractVersion: QBO_SYNC_CONTRACT_VERSION,
    companyId,
    sandboxOnly: true,
    connection: {
      phase: mapConnectionPhase(connectionView),
      realmId: connectionView.realmId ?? null,
      connectedAt: connectionView.lastSyncAt ?? null
    },
    sync: {
      status: mapSyncRunStatus(connectionView, allOpen.length),
      lastSuccessfulAt: connectionView.lastSyncAt ?? null,
      lastAttemptAt: connectionView.lastSyncAt ?? null,
      pendingIssueCount: allOpen.length,
      mappedCounts
    },
    recentIssues: issues.map(toIssueSummary)
  };
}

export async function fetchQboCatalog(companyId: string, kind: QboMappingKind): Promise<QboCatalogV1> {
  assertQboSyncEnabled();
  await getQboConnectionStatus(companyId);
  return catalogPort.fetchCatalog(companyId, kind);
}

export async function retryQboSyncIssue(
  companyId: string,
  actorId: string,
  issueId: string
): Promise<QboSyncIssueSummaryV1> {
  assertQboSyncEnabled();

  const issue = await db.query.qboSyncIssues.findFirst({
    where: and(
      eq(qboSyncIssues.id, issueId),
      eq(qboSyncIssues.companyId, companyId),
      isNull(qboSyncIssues.deletedAt),
      isNull(qboSyncIssues.resolvedAt)
    )
  });

  if (!issue) {
    throw new AppError(ErrorCode.NOT_FOUND, "Sync issue not found");
  }

  if (issue.renvaniEntityId) {
    await enqueueQboSyncPushJob({
      companyId,
      entityType: issue.entityType,
      entityId: issue.renvaniEntityId,
      idempotencyKey: `retry-issue:${issue.id}:${Date.now()}`,
      actorId
    });
  } else {
    await enqueueQboSyncPullJob({
      companyId,
      idempotencyKey: `retry-issue:${issue.id}:${Date.now()}`,
      actorId
    });
  }

  await alertQboSyncFailure(issue.message, {
    companyId,
    failureId: issue.id,
    entityKind: issue.entityType,
    operation: issue.direction,
    errorCode: issue.code
  });

  await emitEvent({
    companyId,
    actorId,
    actorType: "user",
    eventType: "integration.qbo_sync_retry_requested",
    entityType: "qbo_sync_issue",
    entityId: issueId,
    summary: "QuickBooks sync issue retry requested",
    payload: { entityType: issue.entityType, code: issue.code }
  });

  return toIssueSummary(issue);
}
