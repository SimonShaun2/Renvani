import { and, eq, isNull } from "drizzle-orm";

import { db, importBundles, importSessions } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  MigratePhotoMigrationStateSchema,
  type MigratePhotoLinkDecision,
  type MigratePhotoMigrationState
} from "@fsm/types";

type ImportBundleRow = typeof importBundles.$inferSelect;

const PHOTO_MIGRATION_STEP_KEY = "photoMigration";
const PHOTO_LINK_DECISIONS_KEY = "photoLinkDecisions";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getScopedImportBundle(companyId: string, bundleId: string): Promise<ImportBundleRow> {
  const [bundle] = await db
    .select()
    .from(importBundles)
    .where(
      and(eq(importBundles.id, bundleId), eq(importBundles.companyId, companyId), isNull(importBundles.deletedAt))
    )
    .limit(1);

  if (!bundle) {
    throw new AppError(ErrorCode.NOT_FOUND, "Import bundle not found");
  }

  return bundle;
}

function readStepStateRoot(bundle: ImportBundleRow): Record<string, unknown> {
  if (!isPlainObject(bundle.stepState)) {
    return {};
  }
  return { ...bundle.stepState };
}

export function readPhotoMigrationState(bundle: ImportBundleRow): MigratePhotoMigrationState | null {
  const root = readStepStateRoot(bundle);
  const raw = root[PHOTO_MIGRATION_STEP_KEY];
  if (raw === undefined || raw === null) {
    return null;
  }

  const parsed = MigratePhotoMigrationStateSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function readPhotoLinkDecisions(bundle: ImportBundleRow): Record<string, MigratePhotoLinkDecision> {
  const root = readStepStateRoot(bundle);
  const raw = root[PHOTO_LINK_DECISIONS_KEY];
  if (!isPlainObject(raw)) {
    return {};
  }

  const decisions: Record<string, MigratePhotoLinkDecision> = {};
  for (const [vendorFileId, value] of Object.entries(raw)) {
    if (!isPlainObject(value)) {
      continue;
    }
    decisions[vendorFileId] = {
      customerId: typeof value.customerId === "string" ? value.customerId : null,
      jobId: typeof value.jobId === "string" ? value.jobId : null,
      assetId: typeof value.assetId === "string" ? value.assetId : null,
      skip: value.skip === true
    };
  }
  return decisions;
}

export async function persistBundleStepState(
  companyId: string,
  bundleId: string,
  patch: {
    photoMigration?: MigratePhotoMigrationState;
    photoLinkDecisions?: Record<string, MigratePhotoLinkDecision>;
  }
): Promise<ImportBundleRow> {
  const bundle = await getScopedImportBundle(companyId, bundleId);
  const root = readStepStateRoot(bundle);

  if (patch.photoMigration !== undefined) {
    root[PHOTO_MIGRATION_STEP_KEY] = patch.photoMigration;
  }
  if (patch.photoLinkDecisions !== undefined) {
    root[PHOTO_LINK_DECISIONS_KEY] = patch.photoLinkDecisions;
  }

  const updatedRows = await db
    .update(importBundles)
    .set({
      stepState: root,
      updatedAt: new Date()
    })
    .where(eq(importBundles.id, bundleId))
    .returning();
  const updated = updatedRows[0];

  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, "Import bundle not found");
  }

  return updated;
}

export async function ensurePhotoMigrationMediaSession(
  companyId: string,
  actorId: string,
  bundle: ImportBundleRow
): Promise<MigratePhotoMigrationState> {
  const existing = readPhotoMigrationState(bundle);
  if (existing) {
    return existing;
  }

  const insertedSessions = await db
    .insert(importSessions)
    .values({
      companyId,
      createdById: actorId,
      importBundleId: bundle.id,
      sourceSystem: bundle.sourceSystem,
      entityType: "communications",
      status: "preview",
      fileName: "photo-migration.batch",
      fileUrl: `https://imports.local/${bundle.id}/photo-migration`,
      aiInferences: {}
    })
    .returning();
  const session = insertedSessions[0];

  if (!session) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create photo migration import session");
  }

  const photoMigration: MigratePhotoMigrationState = {
    mediaImportSessionId: session.id,
    clientBatches: {},
    objects: []
  };

  await persistBundleStepState(companyId, bundle.id, { photoMigration });
  return photoMigration;
}
