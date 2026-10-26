import { and, eq, isNull } from "drizzle-orm";

import { db, emitEvent, importBundles, importSessions } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  MIGRATE_ONBOARDING_SOURCE_CATALOG,
  type ApplyMigrateDedupeDecisionsBody,
  type ImportDuplicateAction,
  type LinkMigrateOnboardingFilesBody,
  type MigrateOnboardingBundle,
  type MigrateOnboardingCommitResponse,
  type MigrateOnboardingStepState,
  type MigrateOnboardingWizardStep,
  type MigrateSourceSystemId,
  migrateOnboardingStepStateSchema
} from "@fsm/types";

import {
  buildDedupePreviewForBundle,
  buildDuplicateActionsBySession,
  mergeDedupeDecisions
} from "./import-dedupe-preview.service.js";
import { buildRelationalPreviewForBundle } from "./import-relational-preview-bundle.service.js";
import { startImport } from "./import.service.js";
import {
  applyQuickBooksOAuthGateToCatalog,
  bundleRequiresFileLinkConfirmation,
  collectBundleMediaObjects
} from "./migrate-import-file-link.service.js";

type ImportBundleRow = typeof importBundles.$inferSelect;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStepState(value: unknown): MigrateOnboardingStepState {
  const parsed = migrateOnboardingStepStateSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  return { files: [] };
}

function normalizeDedupeDecisions(value: unknown): Record<string, ImportDuplicateAction> {
  if (!isPlainObject(value)) {
    return {};
  }

  const decisions: Record<string, ImportDuplicateAction> = {};
  for (const [key, action] of Object.entries(value)) {
    if (action === "skip" || action === "update_existing" || action === "import_new") {
      decisions[key] = action;
    }
  }
  return decisions;
}

function toBundleResponse(row: ImportBundleRow): MigrateOnboardingBundle {
  const stepState = parseStepState(row.stepState);
  return {
    id: row.id,
    companyId: row.companyId,
    createdById: row.createdById,
    status: row.status,
    wizardStep: row.wizardStep as MigrateOnboardingWizardStep,
    stepState,
    dedupeDecisions: normalizeDedupeDecisions(row.dedupeDecisions),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    abandonedAt: row.abandonedAt?.toISOString() ?? null
  };
}

async function getScopedBundle(companyId: string, bundleId: string): Promise<ImportBundleRow> {
  const [bundle] = await db
    .select()
    .from(importBundles)
    .where(
      and(eq(importBundles.id, bundleId), eq(importBundles.companyId, companyId), isNull(importBundles.deletedAt))
    )
    .limit(1);

  if (!bundle) {
    throw new AppError(ErrorCode.NOT_FOUND, "Onboarding bundle not found");
  }

  return bundle;
}

async function abandonActiveBundles(companyId: string, actorId: string): Promise<void> {
  const now = new Date();
  const activeBundles = await db
    .select()
    .from(importBundles)
    .where(
      and(
        eq(importBundles.companyId, companyId),
        eq(importBundles.status, "active"),
        isNull(importBundles.deletedAt)
      )
    );

  for (const bundle of activeBundles) {
    await db
      .update(importBundles)
      .set({
        status: "abandoned",
        abandonedAt: now,
        updatedAt: now
      })
      .where(eq(importBundles.id, bundle.id));

    await emitEvent({
      companyId,
      actorId,
      actorType: "user",
      eventType: "import.bundle.abandoned",
      entityType: "import_bundle",
      entityId: bundle.id,
      summary: "Prior onboarding import bundle abandoned for a new session"
    });
  }
}

export function listMigrateOnboardingSources() {
  return applyQuickBooksOAuthGateToCatalog(MIGRATE_ONBOARDING_SOURCE_CATALOG);
}

export async function getActiveMigrateOnboardingBundle(companyId: string): Promise<MigrateOnboardingBundle | null> {
  const bundles = await db
    .select()
    .from(importBundles)
    .where(
      and(
        eq(importBundles.companyId, companyId),
        eq(importBundles.status, "active"),
        isNull(importBundles.deletedAt)
      )
    );

  const bundle = bundles.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())[0];

  return bundle ? toBundleResponse(bundle) : null;
}

export async function createMigrateOnboardingSession(
  companyId: string,
  actorId: string,
  resumeActive: boolean
): Promise<MigrateOnboardingBundle> {
  if (resumeActive) {
    const active = await getActiveMigrateOnboardingBundle(companyId);
    if (active) {
      return active;
    }
  }

  await abandonActiveBundles(companyId, actorId);

  const inserted = await db
    .insert(importBundles)
    .values({
      companyId,
      createdById: actorId,
      sourceSystem: "manual_csv",
      status: "active",
      wizardStep: 1,
      stepState: { files: [] },
      dedupeDecisions: {}
    })
    .returning();
  const bundle = inserted[0];

  if (!bundle) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to create onboarding bundle");
  }

  await emitEvent({
    companyId,
    actorId,
    actorType: "user",
    eventType: "import.bundle.created",
    entityType: "import_bundle",
    entityId: bundle.id,
    summary: "FS-MIGRATE onboarding wizard session started"
  });

  return toBundleResponse(bundle);
}

export async function getMigrateOnboardingBundle(
  companyId: string,
  bundleId: string
): Promise<MigrateOnboardingBundle> {
  const bundle = await getScopedBundle(companyId, bundleId);
  return toBundleResponse(bundle);
}

async function advanceWizardStep(
  companyId: string,
  actorId: string,
  bundleId: string,
  nextStep: MigrateOnboardingWizardStep,
  stepState: MigrateOnboardingStepState
): Promise<MigrateOnboardingBundle> {
  const bundle = await getScopedBundle(companyId, bundleId);

  if (bundle.status !== "active") {
    throw new AppError(ErrorCode.CONFLICT, "Onboarding bundle is not active");
  }

  const now = new Date();
  const updatedRows = await db
    .update(importBundles)
    .set({
      wizardStep: nextStep,
      stepState,
      updatedAt: now
    })
    .where(eq(importBundles.id, bundleId))
    .returning();
  const updated = updatedRows[0];

  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, "Onboarding bundle not found");
  }

  await emitEvent({
    companyId,
    actorId,
    actorType: "user",
    eventType: "import.bundle.step_advanced",
    entityType: "import_bundle",
    entityId: bundleId,
    payload: {
      wizardStep: nextStep
    },
    summary: `Onboarding wizard advanced to step ${String(nextStep)}`
  });

  return toBundleResponse(updated);
}

export async function setMigrateOnboardingSource(
  companyId: string,
  actorId: string,
  bundleId: string,
  sourceSystem: MigrateSourceSystemId
): Promise<MigrateOnboardingBundle> {
  const bundle = await getScopedBundle(companyId, bundleId);

  if (bundle.wizardStep !== 1) {
    throw new AppError(ErrorCode.CONFLICT, "Source system can only be set on wizard step 1");
  }

  const stepState = parseStepState(bundle.stepState);
  stepState.sourceSystem = sourceSystem;

  return advanceWizardStep(companyId, actorId, bundleId, 2, stepState);
}

export async function linkMigrateOnboardingFiles(
  companyId: string,
  actorId: string,
  bundleId: string,
  input: LinkMigrateOnboardingFilesBody
): Promise<MigrateOnboardingBundle> {
  const bundle = await getScopedBundle(companyId, bundleId);

  if (bundle.wizardStep !== 2) {
    throw new AppError(ErrorCode.CONFLICT, "Files can only be linked on wizard step 2");
  }

  const stepState = parseStepState(bundle.stepState);
  if (!stepState.sourceSystem) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Choose a source system before uploading files");
  }

  for (const file of input.files) {
    const [session] = await db
      .select()
      .from(importSessions)
      .where(
        and(
          eq(importSessions.id, file.importSessionId),
          eq(importSessions.companyId, companyId),
          isNull(importSessions.deletedAt)
        )
      )
      .limit(1);

    if (!session) {
      throw new AppError(ErrorCode.NOT_FOUND, `Import session ${file.importSessionId} not found`);
    }

    if (session.entityType !== file.entityType) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, "Import session entity type does not match file metadata");
    }

    await db
      .update(importSessions)
      .set({
        importBundleId: bundleId,
        updatedAt: new Date()
      })
      .where(eq(importSessions.id, file.importSessionId));
  }

  stepState.files = input.files;

  return advanceWizardStep(companyId, actorId, bundleId, 3, stepState);
}

export async function confirmMigrateOnboardingMappings(
  companyId: string,
  actorId: string,
  bundleId: string
): Promise<MigrateOnboardingBundle> {
  const bundle = await getScopedBundle(companyId, bundleId);

  if (bundle.wizardStep !== 3) {
    throw new AppError(ErrorCode.CONFLICT, "Mappings can only be confirmed on wizard step 3");
  }

  const stepState = parseStepState(bundle.stepState);
  const sessionIds = stepState.files.map((file) => file.importSessionId);

  if (sessionIds.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Link at least one import file before confirming mappings");
  }

  for (const sessionId of sessionIds) {
    const [session] = await db
      .select()
      .from(importSessions)
      .where(
        and(
          eq(importSessions.id, sessionId),
          eq(importSessions.companyId, companyId),
          eq(importSessions.importBundleId, bundleId),
          isNull(importSessions.deletedAt)
        )
      )
      .limit(1);

    if (!session) {
      throw new AppError(ErrorCode.NOT_FOUND, `Import session ${sessionId} not found on bundle`);
    }

    if (session.status !== "preview" && session.status !== "mapping") {
      throw new AppError(
        ErrorCode.CONFLICT,
        `Import session ${sessionId} must be in mapping or preview before continuing`
      );
    }
  }

  stepState.mappingsConfirmedAt = new Date().toISOString();

  return advanceWizardStep(companyId, actorId, bundleId, 4, stepState);
}

export async function acknowledgeMigrateOnboardingPreview(
  companyId: string,
  actorId: string,
  bundleId: string
): Promise<MigrateOnboardingBundle> {
  const bundle = await getScopedBundle(companyId, bundleId);

  if (bundle.wizardStep !== 4) {
    throw new AppError(ErrorCode.CONFLICT, "Preview review happens on wizard step 4");
  }

  const stepState = parseStepState(bundle.stepState);
  const sessionIds = stepState.files.map((file) => file.importSessionId);
  const mediaObjects = await collectBundleMediaObjects(companyId, bundleId, sessionIds);

  if (bundleRequiresFileLinkConfirmation(mediaObjects, stepState)) {
    if (stepState.fileLinkStatus !== "ready") {
      throw new AppError(
        ErrorCode.CONFLICT,
        "Run import media file-link analysis and confirm proposals before continuing"
      );
    }

    throw new AppError(
      ErrorCode.CONFLICT,
      "Confirm all import media file-link proposals before acknowledging preview"
    );
  }

  stepState.previewReviewedAt = new Date().toISOString();

  return advanceWizardStep(companyId, actorId, bundleId, 5, stepState);
}

export async function getMigrateDedupePreview(companyId: string, bundleId: string) {
  const bundle = await getScopedBundle(companyId, bundleId);
  const stepState = parseStepState(bundle.stepState);
  const sessionIds = stepState.files.map((file) => file.importSessionId);
  const decisions = normalizeDedupeDecisions(bundle.dedupeDecisions);

  return buildDedupePreviewForBundle(companyId, bundleId, sessionIds, decisions);
}

export async function getMigrateRelationalPreview(companyId: string, bundleId: string) {
  const bundle = await getScopedBundle(companyId, bundleId);
  const stepState = parseStepState(bundle.stepState);

  if (bundle.wizardStep < 3) {
    throw new AppError(ErrorCode.CONFLICT, "Relational preview is available on wizard step 3 or later");
  }

  return buildRelationalPreviewForBundle(companyId, bundleId, stepState.files);
}

export async function applyMigrateDedupeDecisions(
  companyId: string,
  actorId: string,
  bundleId: string,
  input: ApplyMigrateDedupeDecisionsBody
): Promise<MigrateOnboardingBundle> {
  const bundle = await getScopedBundle(companyId, bundleId);

  if (bundle.wizardStep < 4) {
    throw new AppError(ErrorCode.CONFLICT, "Dedupe decisions apply on preview step 4 or later");
  }

  const preview = await getMigrateDedupePreview(companyId, bundleId);
  const validKeys = new Set(preview.collisions.map((collision) => collision.collisionKey));

  for (const decision of input.decisions) {
    if (!validKeys.has(decision.collisionKey)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Unknown collision key: ${decision.collisionKey}`);
    }
  }

  const merged = mergeDedupeDecisions(normalizeDedupeDecisions(bundle.dedupeDecisions), input.decisions);
  const now = new Date();

  const updatedRows = await db
    .update(importBundles)
    .set({
      dedupeDecisions: merged,
      updatedAt: now
    })
    .where(eq(importBundles.id, bundleId))
    .returning();
  const updated = updatedRows[0];

  if (!updated) {
    throw new AppError(ErrorCode.NOT_FOUND, "Onboarding bundle not found");
  }

  await emitEvent({
    companyId,
    actorId,
    actorType: "user",
    eventType: "import.bundle.step_advanced",
    entityType: "import_bundle",
    entityId: bundleId,
    payload: {
      dedupeDecisionsUpdated: input.decisions.length
    },
    summary: "Operator updated import dedupe merge decisions"
  });

  return toBundleResponse(updated);
}

export async function commitMigrateOnboardingBundle(
  companyId: string,
  actorId: string,
  bundleId: string
): Promise<MigrateOnboardingCommitResponse> {
  const bundle = await getScopedBundle(companyId, bundleId);

  if (bundle.wizardStep !== 5) {
    throw new AppError(ErrorCode.CONFLICT, "Commit is only available on wizard step 5");
  }

  if (bundle.status !== "active") {
    throw new AppError(ErrorCode.CONFLICT, "Onboarding bundle is not active");
  }

  const stepState = parseStepState(bundle.stepState);
  if (!stepState.previewReviewedAt) {
    throw new AppError(ErrorCode.CONFLICT, "Preview must be reviewed before commit");
  }

  const sessionIds = stepState.files.map((file) => file.importSessionId);
  const preview = await getMigrateDedupePreview(companyId, bundleId);
  const decisions = normalizeDedupeDecisions(bundle.dedupeDecisions);
  const duplicateActionsBySession = buildDuplicateActionsBySession(preview.collisions, decisions);

  const now = new Date();
  await db
    .update(importBundles)
    .set({
      status: "committing",
      stepState: {
        ...stepState,
        commitStartedAt: now.toISOString()
      },
      updatedAt: now
    })
    .where(eq(importBundles.id, bundleId));

  await emitEvent({
    companyId,
    actorId,
    actorType: "user",
    eventType: "import.bundle.commit_started",
    entityType: "import_bundle",
    entityId: bundleId,
    payload: {
      importSessionIds: sessionIds
    },
    summary: "Onboarding bundle commit started for linked import sessions"
  });

  for (const sessionId of sessionIds) {
    const duplicateActions = duplicateActionsBySession[sessionId] ?? {};
    await startImport(companyId, actorId, sessionId, duplicateActions);
  }

  return {
    bundleId,
    status: "committing",
    importSessionIds: sessionIds,
    startedAt: now.toISOString()
  };
}
