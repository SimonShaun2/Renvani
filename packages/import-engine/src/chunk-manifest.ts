import type { ColumnMapping, ImportChunkCommitManifest } from "@fsm/types";

import {
  DEFAULT_IMPORT_ROW_CHUNK_SIZE,
  planImportRowChunks,
} from "./chunk-ingest.js";

const CHUNK_COMMIT_ENTITY_TYPES = new Set<ImportChunkCommitManifest["entityType"]>([
  "customers",
  "jobs",
  "estimates",
]);

function columnMappingIncludesField(columnMapping: ColumnMapping, fieldName: string): boolean {
  return Object.values(columnMapping).some((mappedField) => mappedField === fieldName);
}

export function isChunkCommitEligibleEntity(
  entityType: string,
  columnMapping: ColumnMapping,
): entityType is ImportChunkCommitManifest["entityType"] {
  if (!CHUNK_COMMIT_ENTITY_TYPES.has(entityType as ImportChunkCommitManifest["entityType"])) {
    return false;
  }

  if (entityType === "customers") {
    return columnMappingIncludesField(columnMapping, "sourceId");
  }

  if (entityType === "jobs") {
    return (
      columnMappingIncludesField(columnMapping, "sourceId") ||
      columnMappingIncludesField(columnMapping, "jobNumber")
    );
  }

  if (entityType === "estimates") {
    return (
      columnMappingIncludesField(columnMapping, "sourceId") ||
      columnMappingIncludesField(columnMapping, "estimateNumber")
    );
  }

  return false;
}

export function buildImportChunkCommitManifest(input: {
  totalDataRows: number;
  entityType: ImportChunkCommitManifest["entityType"];
  sourceSystem: string;
  importBundleId?: string;
  chunkSize?: number;
}): ImportChunkCommitManifest | null {
  const plans = planImportRowChunks(input.totalDataRows, input.chunkSize ?? DEFAULT_IMPORT_ROW_CHUNK_SIZE);

  if (plans.length === 0) {
    return null;
  }

  return {
    importBundleId: input.importBundleId,
    sourceSystem: input.sourceSystem,
    entityType: input.entityType,
    chunks: plans.map((plan) => ({
      chunkIndex: plan.chunkIndex,
      chunksTotal: plan.chunksTotal,
      cursor: { rowOffset: plan.window.start },
      rowWindow: plan.window,
    })),
  };
}

export function initialImportSessionChunkProgress(
  manifest: ImportChunkCommitManifest,
): {
  entityType: string;
  chunksTotal: number;
  chunksDone: number;
  rowsOk: number;
  rowsFailed: number;
} {
  const chunksTotal = manifest.chunks[0]?.chunksTotal ?? 0;

  return {
    entityType: manifest.entityType,
    chunksTotal,
    chunksDone: 0,
    rowsOk: 0,
    rowsFailed: 0,
  };
}
