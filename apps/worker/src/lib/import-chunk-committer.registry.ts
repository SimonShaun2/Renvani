import type { importSessions } from "@fsm/db";
import type { ImportChunkCommitPayload } from "@fsm/jobs";
import type { ColumnMapping } from "@fsm/types";

/**
 * Plug-in point for chunked import commits (FS-MIGRATE). Each entity type registers one
 * committer; the processor looks it up by `payload.entityType` (no per-type switch).
 * Add-ons call `registerImportChunkCommitter(type, committer)` at worker boot.
 */

export type ImportChunkSessionRow = typeof importSessions.$inferSelect;

export interface ImportChunkRow {
  rowNumber: number;
  values: Record<string, string>;
}

export interface ImportChunkCommitInput {
  payload: ImportChunkCommitPayload;
  importSession: ImportChunkSessionRow;
  rows: ImportChunkRow[];
  columnMapping: ColumnMapping;
}

export interface ImportChunkCommitResult {
  rowsOk: number;
  rowsFailed: number;
  /** Rows intentionally not written (e.g. a duplicate the user chose to skip). Optional. */
  rowsSkipped?: number;
}

/**
 * Contract: idempotent per row (lineage upsert on companyId + sourceSystem + sourceId),
 * tenant-scoped (runTransactionWithTenantSession + explicit company filters), and
 * row-level failures counted in rowsFailed rather than thrown.
 */
export type ImportChunkCommitter = (input: ImportChunkCommitInput) => Promise<ImportChunkCommitResult>;

export class ImportChunkCommitError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ImportChunkCommitError";
    this.code = code;
  }
}

export const UNSUPPORTED_ENTITY_TYPE = "UNSUPPORTED_ENTITY_TYPE";

const committers = new Map<string, ImportChunkCommitter>();

/** Registers (or overrides) the committer for an entity type. Returns the previous one, if any. */
export function registerImportChunkCommitter(
  entityType: string,
  committer: ImportChunkCommitter,
): ImportChunkCommitter | undefined {
  const key = entityType.trim();
  if (key.length === 0) {
    throw new ImportChunkCommitError("INVALID_ENTITY_TYPE", "Import chunk committer entity type is required");
  }
  const previous = committers.get(key);
  committers.set(key, committer);
  return previous;
}

export function unregisterImportChunkCommitter(entityType: string): boolean {
  return committers.delete(entityType.trim());
}

export function hasImportChunkCommitter(entityType: string): boolean {
  return committers.has(entityType.trim());
}

export function listImportChunkCommitterTypes(): string[] {
  return [...committers.keys()].sort();
}

/** Throws a handled ImportChunkCommitError (UNSUPPORTED_ENTITY_TYPE) for unregistered types. */
export function getImportChunkCommitter(entityType: string): ImportChunkCommitter {
  const committer = committers.get(entityType.trim());
  if (!committer) {
    throw new ImportChunkCommitError(
      UNSUPPORTED_ENTITY_TYPE,
      `No import chunk committer registered for entity type "${entityType}" (registered: ${
        listImportChunkCommitterTypes().join(", ") || "none"
      })`,
    );
  }
  return committer;
}
