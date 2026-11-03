import { randomUUID } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import { db, emitEvent, importChunkRuns, importSessions } from "@fsm/db";
import { enqueueImportChunkCommitJob } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  IMPORT_POLICY_V1,
  ImportChunkCommitManifestSchema,
  ImportChunkCommitPayloadSchema,
  buildImportChunkCommitJobId,
  buildImportChunkIdempotencyKey,
  buildImportWorkflowAuditPayloadV1,
  assertIdempotencyPayloadMatches,
  type ImportChunkCommitManifest,
  type ImportChunkCommitPayload,
} from "@fsm/types";
import { hashImportWorkflowStepFingerprint } from "@fsm/types/fs-migrate/import-workflow-runtime-fingerprint.node";

import { assertImportPolicyVersion } from "./import-workflow-runtime.policy.js";

type ImportSessionRow = typeof importSessions.$inferSelect;

const logger = pino({
  name: "import-workflow-runtime-service",
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractImportChunkCommitManifest(aiInferences: unknown): ImportChunkCommitManifest | null {
  if (!isPlainObject(aiInferences)) {
    return null;
  }

  const raw = aiInferences.importChunkCommitManifest;
  if (raw === undefined || raw === null) {
    return null;
  }

  const parsed = ImportChunkCommitManifestSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

async function getImportSessionRow(companyId: string, importSessionId: string): Promise<ImportSessionRow> {
  const rows = await db
    .select()
    .from(importSessions)
    .where(
      and(
        eq(importSessions.companyId, companyId),
        eq(importSessions.id, importSessionId),
        isNull(importSessions.deletedAt),
      ),
    )
    .limit(1);
  const session = rows[0];

  if (!session) {
    throw new AppError(ErrorCode.NOT_FOUND, "Import session not found");
  }

  return session;
}

function readStoredFingerprint(cursor: unknown): string | null {
  if (!isPlainObject(cursor)) {
    return null;
  }

  const fingerprint = cursor.payloadFingerprint;
  return typeof fingerprint === "string" ? fingerprint : null;
}

async function findChunkRun(companyId: string, idempotencyKey: string) {
  const rows = await db
    .select()
    .from(importChunkRuns)
    .where(
      and(eq(importChunkRuns.companyId, companyId), eq(importChunkRuns.idempotencyKey, idempotencyKey)),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function registerPendingChunkRun(
  payload: ImportChunkCommitPayload,
  payloadFingerprint: string,
): Promise<void> {
  const existing = await findChunkRun(payload.companyId, payload.idempotencyKey);

  if (existing) {
    const storedFingerprint = readStoredFingerprint(existing.cursor);
    if (storedFingerprint) {
      assertIdempotencyPayloadMatches(storedFingerprint, {
        companyId: payload.companyId,
        idempotencyKey: payload.idempotencyKey,
        payloadFingerprint,
      });
    }

    if (existing.status === "completed") {
      return;
    }

    await db
      .update(importChunkRuns)
      .set({
        status: "pending",
        cursor: { ...payload.cursor, payloadFingerprint },
        updatedAt: new Date(),
      })
      .where(eq(importChunkRuns.id, existing.id));

    return;
  }

  await db.insert(importChunkRuns).values({
    id: randomUUID(),
    companyId: payload.companyId,
    importSessionId: payload.importSessionId,
    entityType: payload.entityType,
    chunkIndex: payload.chunkIndex,
    chunksTotal: payload.chunksTotal,
    idempotencyKey: payload.idempotencyKey,
    status: "pending",
    cursor: { ...payload.cursor, payloadFingerprint },
  });
}

export async function enqueueDurableImportChunkCommitStep(
  companyId: string,
  actorId: string,
  payloadInput: ImportChunkCommitPayload,
  policyVersion: string = IMPORT_POLICY_V1,
): Promise<"scheduled" | "deduped_completed"> {
  assertImportPolicyVersion(policyVersion);

  const payload = ImportChunkCommitPayloadSchema.parse({
    ...payloadInput,
    companyId,
    idempotencyKey:
      payloadInput.idempotencyKey ??
      buildImportChunkIdempotencyKey(
        payloadInput.importSessionId,
        payloadInput.entityType,
        payloadInput.chunkIndex,
      ),
  });

  const expectedKey = buildImportChunkIdempotencyKey(
    payload.importSessionId,
    payload.entityType,
    payload.chunkIndex,
  );

  if (payload.idempotencyKey !== expectedKey) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "import-chunk-commit idempotencyKey is invalid");
  }

  const payloadFingerprint = hashImportWorkflowStepFingerprint({
    companyId: payload.companyId,
    importSessionId: payload.importSessionId,
    importBundleId: payload.importBundleId ?? null,
    sourceSystem: payload.sourceSystem,
    entityType: payload.entityType,
    chunkIndex: payload.chunkIndex,
    chunksTotal: payload.chunksTotal,
    cursor: payload.cursor,
    rowWindow: payload.rowWindow ?? null,
  });

  const existing = await findChunkRun(companyId, payload.idempotencyKey);

  if (existing?.status === "completed") {
    const audit = buildImportWorkflowAuditPayloadV1({
      stepKind: "import-chunk-commit",
      idempotencyKey: payload.idempotencyKey,
      state: "deduped_completed",
      importSessionId: payload.importSessionId,
      importBundleId: payload.importBundleId,
      chunkIndex: payload.chunkIndex,
      jobId: buildImportChunkCommitJobId(payload.importSessionId, payload.chunkIndex),
    });

    await emitEvent({
      companyId,
      actorId,
      actorType: "system",
      eventType: "import.started",
      entityType: "import_session",
      entityId: payload.importSessionId,
      payload: audit,
      summary: `Import chunk ${payload.chunkIndex} deduped (already completed)`,
    });

    return "deduped_completed";
  }

  if (existing) {
    const storedFingerprint = readStoredFingerprint(existing.cursor);
    if (storedFingerprint) {
      assertIdempotencyPayloadMatches(storedFingerprint, {
        companyId,
        idempotencyKey: payload.idempotencyKey,
        payloadFingerprint,
      });
    }
  }

  await registerPendingChunkRun(payload, payloadFingerprint);
  await enqueueImportChunkCommitJob(payload);

  const audit = buildImportWorkflowAuditPayloadV1({
    stepKind: "import-chunk-commit",
    idempotencyKey: payload.idempotencyKey,
    state: "scheduled",
    importSessionId: payload.importSessionId,
    importBundleId: payload.importBundleId,
    chunkIndex: payload.chunkIndex,
    jobId: buildImportChunkCommitJobId(payload.importSessionId, payload.chunkIndex),
  });

  await emitEvent({
    companyId,
    actorId,
    actorType: "system",
    eventType: "import.started",
    entityType: "import_session",
    entityId: payload.importSessionId,
    payload: audit,
    summary: `Import chunk ${payload.chunkIndex} scheduled`,
  });

  return "scheduled";
}

export async function scheduleImportChunkCommitsFromSessionAiInferences(
  companyId: string,
  actorId: string,
  importSessionId: string,
): Promise<number> {
  const session = await getImportSessionRow(companyId, importSessionId);
  const manifest = extractImportChunkCommitManifest(session.aiInferences);

  if (!manifest) {
    return 0;
  }

  if (manifest.entityType !== session.entityType) {
    throw new AppError(
      ErrorCode.VALIDATION_ERROR,
      "importChunkCommitManifest entityType does not match import session",
    );
  }

  const sourceSystem = manifest.sourceSystem ?? session.sourceSystem ?? "manual_csv";
  let enqueued = 0;

  for (const chunk of manifest.chunks) {
    if (chunk.chunkIndex >= chunk.chunksTotal) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "importChunkCommitManifest chunk index is out of range");
    }

    const payload = ImportChunkCommitPayloadSchema.parse({
      companyId,
      importSessionId,
      importBundleId: manifest.importBundleId ?? session.importBundleId ?? undefined,
      sourceSystem,
      entityType: manifest.entityType,
      chunkIndex: chunk.chunkIndex,
      chunksTotal: chunk.chunksTotal,
      cursor: chunk.cursor,
      rowWindow: chunk.rowWindow,
      idempotencyKey: buildImportChunkIdempotencyKey(importSessionId, manifest.entityType, chunk.chunkIndex),
    });

    const outcome = await enqueueDurableImportChunkCommitStep(companyId, actorId, payload);
    if (outcome === "scheduled" || outcome === "deduped_completed") {
      enqueued += 1;
    }
  }

  logger.info(
    {
      companyId,
      importSessionId,
      importBundleId: manifest.importBundleId ?? session.importBundleId,
      enqueuedChunks: enqueued,
    },
    "Scheduled durable import-chunk-commit steps from session manifest",
  );

  return enqueued;
}
