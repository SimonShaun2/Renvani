import type { Job } from "bullmq";
import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import { db, emitEvent, importBundles } from "@fsm/db";
import {
  buildFileLinkTargetsFromPreviewRows,
  proposeImportFileLinksFromPaths
} from "@fsm/import-engine";
import {
  AI_QUEUE_JOB_NAMES,
  importFileLinkJobDataSchema,
  migrateOnboardingStepStateSchema,
  type ImportFileLinkJobData,
  type MigrateOnboardingStepState
} from "@fsm/types";

const logger = pino({
  name: "import-file-link-processor"
});

function parseStepState(value: unknown): MigrateOnboardingStepState {
  const parsed = migrateOnboardingStepStateSchema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  return { files: [] };
}

export async function handleImportFileLink(job: Job<ImportFileLinkJobData>): Promise<void> {
  if (job.name !== AI_QUEUE_JOB_NAMES.importFileLink) {
    return;
  }

  const payload = importFileLinkJobDataSchema.parse(job.data);
  const now = new Date();

  const [bundle] = await db
    .select()
    .from(importBundles)
    .where(
      and(
        eq(importBundles.id, payload.importBundleId),
        eq(importBundles.companyId, payload.companyId),
        isNull(importBundles.deletedAt)
      )
    )
    .limit(1);

  if (!bundle) {
    throw new Error(`import-file-link: bundle ${payload.importBundleId} not found`);
  }

  const stepState = parseStepState(bundle.stepState);
  stepState.fileLinkStatus = "processing";
  stepState.fileLinkLastRunAt = now.toISOString();

  await db
    .update(importBundles)
    .set({
      stepState,
      updatedAt: now
    })
    .where(eq(importBundles.id, payload.importBundleId));

  try {
    const targets = buildFileLinkTargetsFromPreviewRows(payload.targets);
    const proposals = proposeImportFileLinksFromPaths(payload.objects, targets);

    const completedState = {
      ...stepState,
      fileLinkStatus: "ready" as const,
      fileLinkProposals: proposals,
      fileLinkLastRunAt: now.toISOString()
    };

    await db
      .update(importBundles)
      .set({
        stepState: completedState,
        updatedAt: new Date()
      })
      .where(eq(importBundles.id, payload.importBundleId));

    await emitEvent({
      companyId: payload.companyId,
      actorType: "system",
      eventType: "import.bundle.step_advanced",
      entityType: "import_bundle",
      entityId: payload.importBundleId,
      payload: {
        proposalCount: proposals.length,
        unresolvedCount: proposals.filter((proposal) => proposal.suggestedEntityType === "unlinked").length
      },
      summary: "Import bundle media file-link proposals generated"
    });

    logger.info(
      {
        companyId: payload.companyId,
        importBundleId: payload.importBundleId,
        proposalCount: proposals.length
      },
      "import-file-link completed"
    );
  } catch (error) {
    const failedState = { ...stepState };
    failedState.fileLinkStatus = "failed";
    failedState.fileLinkLastRunAt = now.toISOString();

    await db
      .update(importBundles)
      .set({
        stepState: failedState,
        updatedAt: new Date()
      })
      .where(eq(importBundles.id, payload.importBundleId));

    throw error;
  }
}
