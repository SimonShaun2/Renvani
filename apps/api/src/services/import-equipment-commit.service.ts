import { and, eq, isNull } from "drizzle-orm";
import pino from "pino";

import { db, importSessions } from "@fsm/db";
import {
  buildImportEquipmentCommitJobId,
  enqueueImportEquipmentCommitJob,
  IMPORT_EQUIPMENT_COMMIT_JOB_NAME,
  type ImportEquipmentCommitPayload,
} from "@fsm/jobs";
import { AppError, ErrorCode } from "@fsm/types";

type ImportSessionRow = typeof importSessions.$inferSelect;

const logger = pino({
  name: "import-equipment-commit-service",
});

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface ScheduleEquipmentImportChunksInput {
  companyId: string;
  importSessionId: string;
  sourceSystem: string;
  chunksTotal: number;
  lineageMaps?: ImportEquipmentCommitPayload["lineageMaps"];
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

export function extractEquipmentChunkPlan(aiInferences: unknown): ScheduleEquipmentImportChunksInput | null {
  if (!isPlainObject(aiInferences)) {
    return null;
  }

  const raw = aiInferences.equipmentChunkPlan;
  if (!isPlainObject(raw)) {
    return null;
  }

  const companyId = typeof raw.companyId === "string" ? raw.companyId : null;
  const importSessionId = typeof raw.importSessionId === "string" ? raw.importSessionId : null;
  const sourceSystem = typeof raw.sourceSystem === "string" ? raw.sourceSystem : null;
  const chunksTotal = typeof raw.chunksTotal === "number" ? raw.chunksTotal : null;

  if (!companyId || !importSessionId || !sourceSystem || !chunksTotal || chunksTotal < 1) {
    return null;
  }

  return {
    companyId,
    importSessionId,
    sourceSystem,
    chunksTotal,
    lineageMaps: isPlainObject(raw.lineageMaps)
      ? (raw.lineageMaps as ImportEquipmentCommitPayload["lineageMaps"])
      : undefined,
  };
}

export async function scheduleEquipmentImportChunks(
  input: ScheduleEquipmentImportChunksInput,
): Promise<number> {
  const session = await getImportSessionRow(input.companyId, input.importSessionId);

  if (session.entityType !== "assets") {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Import session entity type must be assets");
  }

  let enqueued = 0;

  for (let chunkIndex = 0; chunkIndex < input.chunksTotal; chunkIndex += 1) {
    await enqueueImportEquipmentCommitJob({
      companyId: input.companyId,
      importSessionId: input.importSessionId,
      sourceSystem: input.sourceSystem,
      chunkIndex,
      chunksTotal: input.chunksTotal,
      lineageMaps: input.lineageMaps,
    });
    enqueued += 1;
  }

  logger.info(
    {
      companyId: input.companyId,
      importSessionId: input.importSessionId,
      chunksTotal: input.chunksTotal,
      jobName: IMPORT_EQUIPMENT_COMMIT_JOB_NAME,
    },
    "Enqueued equipment import chunk jobs",
  );

  return enqueued;
}

export async function scheduleEquipmentImportChunksFromSessionAiInferences(
  companyId: string,
  importSessionId: string,
): Promise<number> {
  const session = await getImportSessionRow(companyId, importSessionId);
  const plan = extractEquipmentChunkPlan(session.aiInferences);

  if (!plan) {
    return 0;
  }

  if (plan.companyId !== companyId || plan.importSessionId !== importSessionId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "equipmentChunkPlan does not match session");
  }

  return scheduleEquipmentImportChunks(plan);
}

export { buildImportEquipmentCommitJobId };
