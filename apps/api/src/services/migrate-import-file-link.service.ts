import { and, eq, isNull } from "drizzle-orm";

import { QUICKBOOKS_ONLINE_OAUTH_ENABLED } from "@fsm/config/quickbooks-oauth-gate";
import { db, emitEvent, importBundles, importSessions } from "@fsm/db";
import { enqueueImportFileLinkJob } from "@fsm/jobs";
import {
  AppError,
  ErrorCode,
  buildImportFileLinkIdempotencyKey,
  type ConfirmImportFileLinkDecisionsBody,
  type ImportFileLinkPreviewResponse,
  type ImportFileLinkProposal,
  type MigrateOnboardingSourceCatalogEntry,
  type MigrateOnboardingStepState,
  migrateOnboardingStepStateSchema
} from "@fsm/types";

import { extractMigrateFileBatchManifest } from "./import-migrate-file-batch.service.js";
import { buildRelationalPreviewForBundle } from "./import-relational-preview-bundle.service.js";

type ImportBundleRow = typeof importBundles.$inferSelect;

function parseStepState(value: unknown): MigrateOnboardingStepState {
  const parsed = migrateOnboardingStepStateSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  return { files: [] };
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

export async function collectBundleMediaObjects(
  companyId: string,
  bundleId: string,
  sessionIds: string[]
): Promise<Array<{ vendorFileId: string; relativePath: string }>> {
  if (sessionIds.length === 0) {
    return [];
  }

  const sessions = await db
    .select()
    .from(importSessions)
    .where(
      and(eq(importSessions.companyId, companyId), eq(importSessions.importBundleId, bundleId), isNull(importSessions.deletedAt))
    );

  const linked = sessions.filter((session) => sessionIds.includes(session.id));
  const objectsByVendorId = new Map<string, { vendorFileId: string; relativePath: string }>();

  for (const session of linked) {
    const manifest = extractMigrateFileBatchManifest(session.aiInferences);
    if (!manifest) {
      continue;
    }

    for (const batch of manifest.batches) {
      for (const object of batch.objects) {
        objectsByVendorId.set(object.vendorFileId, {
          vendorFileId: object.vendorFileId,
          relativePath: object.relativePath
        });
      }
    }
  }

  return [...objectsByVendorId.values()];
}

export function bundleRequiresFileLinkConfirmation(
  mediaObjects: Array<{ vendorFileId: string; relativePath: string }>,
  stepState: MigrateOnboardingStepState
): boolean {
  if (mediaObjects.length === 0) {
    return false;
  }

  return !stepState.fileLinkConfirmedAt;
}

async function buildFileLinkTargetsForBundle(companyId: string, bundleId: string, stepState: MigrateOnboardingStepState) {
  const preview = await buildRelationalPreviewForBundle(companyId, bundleId, stepState.files);

  return {
    customers: preview.graph.customers.map((node) => ({
      sourceId: node.id,
      displayName: node.label
    })),
    jobs: preview.graph.jobs.map((node) => ({
      sourceId: node.id,
      label: node.label
    })),
    assets: preview.graph.properties.map((node) => ({
      sourceId: node.id,
      label: node.label
    }))
  };
}

export async function runMigrateImportFileLink(
  companyId: string,
  actorId: string,
  bundleId: string
): Promise<ImportFileLinkPreviewResponse> {
  const bundle = await getScopedBundle(companyId, bundleId);

  if (bundle.wizardStep < 4) {
    throw new AppError(ErrorCode.CONFLICT, "File link runs on preview step 4 or later");
  }

  const stepState = parseStepState(bundle.stepState);
  const sessionIds = stepState.files.map((file) => file.importSessionId);
  const objects = await collectBundleMediaObjects(companyId, bundleId, sessionIds);

  if (objects.length === 0) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "No bundle media files found to link");
  }

  if (stepState.fileLinkStatus === "processing") {
    throw new AppError(ErrorCode.CONFLICT, "File link job is already running");
  }

  const targets = await buildFileLinkTargetsForBundle(companyId, bundleId, stepState);
  const sourceSystem = stepState.sourceSystem ?? bundle.sourceSystem;

  const now = new Date();
  const nextState: MigrateOnboardingStepState = {
    ...stepState,
    fileLinkStatus: "processing",
    fileLinkLastRunAt: now.toISOString()
  };

  await db
    .update(importBundles)
    .set({
      stepState: nextState,
      updatedAt: now
    })
    .where(eq(importBundles.id, bundleId));

  await enqueueImportFileLinkJob({
    companyId,
    importBundleId: bundleId,
    sourceSystem,
    targets,
    objects,
    idempotencyKey: buildImportFileLinkIdempotencyKey(bundleId)
  });

  await emitEvent({
    companyId,
    actorId,
    actorType: "user",
    eventType: "import.bundle.step_advanced",
    entityType: "import_bundle",
    entityId: bundleId,
    payload: {
      objectCount: objects.length
    },
    summary: "Operator requested import media file-link analysis"
  });

  return getMigrateImportFileLinkPreview(companyId, bundleId);
}

export async function getMigrateImportFileLinkPreview(
  companyId: string,
  bundleId: string
): Promise<ImportFileLinkPreviewResponse> {
  const bundle = await getScopedBundle(companyId, bundleId);
  const stepState = parseStepState(bundle.stepState);
  const proposals = stepState.fileLinkProposals ?? [];
  const unresolvedCount = proposals.filter((proposal) => proposal.suggestedEntityType === "unlinked").length;

  return {
    bundleId,
    status: stepState.fileLinkStatus ?? "idle",
    proposals,
    unresolvedCount,
    lastRunAt: stepState.fileLinkLastRunAt ?? null
  };
}

function applyFileLinkDecision(
  proposal: ImportFileLinkProposal,
  decision: ConfirmImportFileLinkDecisionsBody["decisions"][number]
): ImportFileLinkProposal {
  if (decision.action === "reject") {
    return {
      ...proposal,
      operatorStatus: "rejected",
      operatorEntityType: "unlinked",
      operatorSourceId: null
    };
  }

  const entityType = decision.entityType ?? proposal.suggestedEntityType;
  const sourceId = decision.sourceId ?? proposal.suggestedSourceId;

  return {
    ...proposal,
    operatorStatus: "confirmed",
    operatorEntityType: entityType,
    operatorSourceId: sourceId
  };
}

export async function confirmMigrateImportFileLinkDecisions(
  companyId: string,
  actorId: string,
  bundleId: string,
  input: ConfirmImportFileLinkDecisionsBody
): Promise<ImportFileLinkPreviewResponse> {
  const bundle = await getScopedBundle(companyId, bundleId);

  if (bundle.wizardStep < 4) {
    throw new AppError(ErrorCode.CONFLICT, "File link confirmation applies on preview step 4 or later");
  }

  const stepState = parseStepState(bundle.stepState);
  const proposals = stepState.fileLinkProposals ?? [];

  if (proposals.length === 0) {
    throw new AppError(ErrorCode.CONFLICT, "Run file link analysis before confirming proposals");
  }

  const proposalById = new Map(proposals.map((proposal) => [proposal.proposalId, proposal]));

  for (const decision of input.decisions) {
    if (!proposalById.has(decision.proposalId)) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, `Unknown file link proposal: ${decision.proposalId}`);
    }
  }

  const updatedProposals = proposals.map((proposal) => {
    const decision = input.decisions.find((entry) => entry.proposalId === proposal.proposalId);
    return decision ? applyFileLinkDecision(proposal, decision) : proposal;
  });

  const pendingCount = updatedProposals.filter((proposal) => proposal.operatorStatus === "pending").length;
  const now = new Date().toISOString();

  const nextState: MigrateOnboardingStepState = {
    ...stepState,
    fileLinkProposals: updatedProposals,
    ...(pendingCount === 0 ? { fileLinkConfirmedAt: now } : {})
  };

  await db
    .update(importBundles)
    .set({
      stepState: nextState,
      updatedAt: new Date()
    })
    .where(eq(importBundles.id, bundleId));

  await emitEvent({
    companyId,
    actorId,
    actorType: "user",
    eventType: "import.bundle.step_advanced",
    entityType: "import_bundle",
    entityId: bundleId,
    payload: {
      decisions: input.decisions.length,
      pendingCount
    },
    summary: "Operator updated import media file-link decisions"
  });

  return getMigrateImportFileLinkPreview(companyId, bundleId);
}

export function applyQuickBooksOAuthGateToCatalog(
  sources: readonly MigrateOnboardingSourceCatalogEntry[]
): MigrateOnboardingSourceCatalogEntry[] {
  return sources.map((entry) => {
    if (entry.id !== "qbo" || entry.oauth === undefined) {
      return entry;
    }

    return {
      ...entry,
      oauth: {
        ...entry.oauth,
        enabled: QUICKBOOKS_ONLINE_OAUTH_ENABLED
      }
    };
  });
}
