import { and, eq, inArray, isNull } from "drizzle-orm";

import { db, importSessions } from "@fsm/db";
import { buildImportSessionIngestStatus } from "../lib/import-ingest-status.js";
import {
  AppError,
  ErrorCode,
  type MigrateOnboardingIngestStatusResponse,
  migrateOnboardingStepStateSchema
} from "@fsm/types";

import { getMigrateOnboardingBundle } from "./migrate-onboarding.service.js";

function parseStepState(value: unknown) {
  const parsed = migrateOnboardingStepStateSchema.safeParse(value);
  return parsed.success ? parsed.data : { files: [] };
}

export async function getMigrateOnboardingIngestStatus(
  companyId: string,
  bundleId: string
): Promise<MigrateOnboardingIngestStatusResponse> {
  const bundle = await getMigrateOnboardingBundle(companyId, bundleId);
  const stepState = parseStepState(bundle.stepState);
  const sessionIdsFromState = stepState.files.map((file) => file.importSessionId);

  const linkedSessions = await db
    .select({ id: importSessions.id })
    .from(importSessions)
    .where(
      and(
        eq(importSessions.companyId, companyId),
        eq(importSessions.importBundleId, bundleId),
        isNull(importSessions.deletedAt)
      )
    );

  const sessionIds = [
    ...new Set([...sessionIdsFromState, ...linkedSessions.map((row) => row.id)])
  ];

  if (sessionIds.length === 0) {
    return { bundleId, sessions: [] };
  }

  const rows = await db
    .select()
    .from(importSessions)
    .where(
      and(
        eq(importSessions.companyId, companyId),
        inArray(importSessions.id, sessionIds),
        isNull(importSessions.deletedAt)
      )
    );

  if (rows.length !== sessionIds.length) {
    throw new AppError(ErrorCode.NOT_FOUND, "One or more import sessions on the bundle were not found");
  }

  const sessions = rows.map((session) =>
    buildImportSessionIngestStatus({
      id: session.id,
      entityType: session.entityType,
      fileName: session.fileName,
      status: session.status,
      progress: session.progress,
      aiInferences: session.aiInferences,
      importedRows: session.importedRows
    })
  );

  return { bundleId, sessions };
}
