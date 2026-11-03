import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import { buildImportBundleObjectKey } from "@fsm/config/import-bundle-storage";
import { db, importSessions } from "@fsm/db";
import { enqueueMigrateFileBatchJob } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  MigrateFileBatchJobDataSchema,
  MigrateFileBatchManifestSchema,
  buildMigrateFileBatchIdempotencyKey,
  buildMigrateFileBatchJobId,
  buildMigrateFileBatchSessionTraceSummary,
  buildMigrateFileBatchTraceObjects,
  type FsMigrateFileBatchBatchTrace,
  type MigrateFileBatchManifest
} from "@fsm/types";

type ImportSessionRow = typeof importSessions.$inferSelect;

const logger = pino({
  name: "import-migrate-file-batch-service"
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractMigrateFileBatchManifest(aiInferences: unknown): MigrateFileBatchManifest | null {
  if (!isPlainObject(aiInferences)) {
    return null;
  }

  const raw = aiInferences.migrateFileBatchManifest;
  if (raw === undefined || raw === null) {
    return null;
  }

  const parsed = MigrateFileBatchManifestSchema.safeParse(raw);
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
        isNull(importSessions.deletedAt)
      )
    )
    .limit(1);
  const session = rows[0];

  if (!session) {
    throw new AppError(ErrorCode.NOT_FOUND, "Import session not found");
  }

  return session;
}

export async function scheduleMigrateFileBatchesFromSessionAiInferences(
  companyId: string,
  importSessionId: string
): Promise<number> {
  const session = await getImportSessionRow(companyId, importSessionId);
  const manifest = extractMigrateFileBatchManifest(session.aiInferences);

  if (!manifest) {
    return 0;
  }

  const batchTraces: FsMigrateFileBatchBatchTrace[] = [];

  for (const batch of manifest.batches) {
    if (batch.batchIndex >= batch.batchesTotal) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "migrateFileBatchManifest batch index is out of range");
    }

    const resolveR2Key = (relativePath: string) =>
      buildImportBundleObjectKey(companyId, manifest.importBundleId, relativePath);

    const objects = batch.objects.map((object) => ({
      ...object,
      r2Key: object.r2Key ?? resolveR2Key(object.relativePath)
    }));

    const payload = MigrateFileBatchJobDataSchema.parse({
      companyId,
      importSessionId,
      importBundleId: manifest.importBundleId,
      sourceSystem: manifest.sourceSystem,
      batchIndex: batch.batchIndex,
      batchesTotal: batch.batchesTotal,
      idempotencyKey: buildMigrateFileBatchIdempotencyKey(importSessionId, batch.batchIndex),
      cursor: batch.cursor,
      objects
    });

    const bullJobId = buildMigrateFileBatchJobId(importSessionId, batch.batchIndex);
    const traceObjects = buildMigrateFileBatchTraceObjects(payload.objects, resolveR2Key);

    await enqueueMigrateFileBatchJob(payload);

    batchTraces.push({
      bullJobId,
      batchIndex: batch.batchIndex,
      batchesTotal: batch.batchesTotal,
      idempotencyKey: payload.idempotencyKey,
      r2Keys: traceObjects.map((object) => object.r2Key),
      objects: traceObjects
    });
  }

  logger.info(
    buildMigrateFileBatchSessionTraceSummary({
      companyId,
      importSessionId,
      importBundleId: manifest.importBundleId,
      batches: batchTraces
    }),
    "FS-MIGRATE import session file-batch enqueue summary"
  );

  return batchTraces.length;
}
