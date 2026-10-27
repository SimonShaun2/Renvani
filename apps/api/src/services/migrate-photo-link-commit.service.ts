import { and, eq, isNull } from "drizzle-orm";

import { db, emitEvent, importSessions } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  MigrateFileBatchManifestSchema,
  type ApplyMigratePhotoLinkDecisionsBody,
  type MigratePhotoLinkPreviewResponse
} from "@fsm/types";

import { scheduleMigrateFileBatchesFromSessionAiInferences } from "./import-migrate-file-batch.service.js";
import { buildMigratePhotoLinkSuggestions } from "./migrate-photo-link-suggest.service.js";
import {
  getScopedImportBundle,
  persistBundleStepState,
  readPhotoLinkDecisions,
  readPhotoMigrationState
} from "./migrate-photo-migration-state.js";

const OBJECTS_PER_BATCH = 500;

function chunkObjects<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function getMigratePhotoLinkPreview(
  companyId: string,
  bundleId: string
): Promise<MigratePhotoLinkPreviewResponse> {
  const bundle = await getScopedImportBundle(companyId, bundleId);
  const photoMigration = readPhotoMigrationState(bundle);

  if (!photoMigration || photoMigration.objects.length === 0) {
    throw new AppError(ErrorCode.CONFLICT, "Upload photo files before opening link preview");
  }

  const suggestions = await buildMigratePhotoLinkSuggestions(companyId, photoMigration.objects);
  const decisions = readPhotoLinkDecisions(bundle);

  return {
    bundleId,
    importBundleId: bundleId,
    mediaImportSessionId: photoMigration.mediaImportSessionId,
    upload: {
      objectCount: photoMigration.objects.length,
      clientBatchCount: Object.keys(photoMigration.clientBatches).length
    },
    suggestions,
    decisions
  };
}

export async function applyMigratePhotoLinkDecisions(
  companyId: string,
  bundleId: string,
  body: ApplyMigratePhotoLinkDecisionsBody
): Promise<MigratePhotoLinkPreviewResponse> {
  await persistBundleStepState(companyId, bundleId, { photoLinkDecisions: body.decisions });
  return getMigratePhotoLinkPreview(companyId, bundleId);
}

export async function commitMigratePhotoLinks(
  companyId: string,
  actorId: string,
  bundleId: string
): Promise<{ enqueuedBatches: number; mediaImportSessionId: string }> {
  const bundle = await getScopedImportBundle(companyId, bundleId);
  const photoMigration = readPhotoMigrationState(bundle);

  if (!photoMigration || photoMigration.objects.length === 0) {
    throw new AppError(ErrorCode.CONFLICT, "No uploaded photos to commit");
  }

  const preview = await getMigratePhotoLinkPreview(companyId, bundleId);
  const decisions = preview.decisions;

  const objectChunks = chunkObjects(photoMigration.objects, OBJECTS_PER_BATCH);
  const batchesTotal = objectChunks.length;

  const manifest = MigrateFileBatchManifestSchema.parse({
    importBundleId: bundleId,
    sourceSystem: bundle.sourceSystem,
    batches: objectChunks.map((objects, batchIndex) => ({
      batchIndex,
      batchesTotal,
      objects: objects.map((object) => ({
        vendorFileId: object.vendorFileId,
        relativePath: object.relativePath,
        r2Key: object.r2Key,
        mimeType: object.mimeType
      }))
    }))
  });

  const sessionRows = await db
    .select()
    .from(importSessions)
    .where(
      and(
        eq(importSessions.id, photoMigration.mediaImportSessionId),
        eq(importSessions.companyId, companyId),
        isNull(importSessions.deletedAt)
      )
    )
    .limit(1);
  const session = sessionRows[0];

  if (!session) {
    throw new AppError(ErrorCode.NOT_FOUND, "Photo migration import session not found");
  }

  const aiInferences =
    typeof session.aiInferences === "object" && session.aiInferences !== null && !Array.isArray(session.aiInferences)
      ? { ...(session.aiInferences as Record<string, unknown>) }
      : {};

  aiInferences.migrateFileBatchManifest = manifest;
  aiInferences.migratePhotoLinkDecisions = decisions;
  aiInferences.migratePhotoLinkSuggestions = preview.suggestions;

  const updatedSessions = await db
    .update(importSessions)
    .set({
      aiInferences,
      status: "importing",
      updatedAt: new Date()
    })
    .where(eq(importSessions.id, session.id))
    .returning();
  const updatedSession = updatedSessions[0];

  if (!updatedSession) {
    throw new AppError(ErrorCode.NOT_FOUND, "Photo migration import session not found");
  }

  const enqueuedBatches = await scheduleMigrateFileBatchesFromSessionAiInferences(companyId, session.id);

  await emitEvent({
    companyId,
    actorId,
    actorType: "user",
    eventType: "import.bundle.commit_started",
    entityType: "import_bundle",
    entityId: bundleId,
    payload: {
      photoLinkCommit: true,
      enqueuedBatches,
      objectCount: photoMigration.objects.length
    },
    summary: "Photo link preview confirmed; migrate-file-batch jobs enqueued"
  });

  return {
    enqueuedBatches,
    mediaImportSessionId: session.id
  };
}
