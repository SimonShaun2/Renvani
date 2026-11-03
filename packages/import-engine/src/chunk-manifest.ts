import type { ColumnMapping, ImportChunkCommitManifest } from "@fsm/types";

import {
  DEFAULT_IMPORT_ROW_CHUNK_SIZE,
  planImportRowChunks,
} from "./chunk-ingest.js";

function columnMappingIncludesField(columnMapping: ColumnMapping, fieldName: string): boolean {
  return Object.values(columnMapping).some((mappedField) => mappedField === fieldName);
}

function includesAny(columnMapping: ColumnMapping, fieldNames: readonly string[]): boolean {
  return fieldNames.some((fieldName) => columnMappingIncludesField(columnMapping, fieldName));
}

/**
 * One entry per chunk-committable entity type: the mapped fields a file needs before its rows
 * can be committed by the lineage-keyed worker committer. String-keyed so new types are one line.
 */
const CHUNK_COMMIT_ELIGIBILITY: Readonly<Record<string, (columnMapping: ColumnMapping) => boolean>> = {
  customers: (mapping) => columnMappingIncludesField(mapping, "sourceId"),
  properties: (mapping) =>
    columnMappingIncludesField(mapping, "sourceId") && includesAny(mapping, ["customerSourceId", "customerId"]),
  jobs: (mapping) => includesAny(mapping, ["sourceId", "jobNumber"]),
  estimates: (mapping) => includesAny(mapping, ["sourceId", "estimateNumber"]),
  invoices: (mapping) =>
    includesAny(mapping, ["sourceId", "invoiceNumber"]) && includesAny(mapping, ["customerSourceId", "customerId"]),
};

export function isChunkCommitEligibleEntity(
  entityType: string,
  columnMapping: ColumnMapping,
): entityType is ImportChunkCommitManifest["entityType"] {
  const isEligible = Object.prototype.hasOwnProperty.call(CHUNK_COMMIT_ELIGIBILITY, entityType)
    ? CHUNK_COMMIT_ELIGIBILITY[entityType]
    : undefined;
  return isEligible ? isEligible(columnMapping) : false;
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
