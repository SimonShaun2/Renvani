/** FS-MIGRATE M2 — multi-file onboarding bundle (ADR import lineage) */

export type ImportBundleStatus = "open" | "preview" | "importing" | "completed" | "failed";

export type ImportBundleFileRole =
  | "customers"
  | "properties"
  | "jobs"
  | "invoices"
  | "equipment"
  | "payments"
  | "unknown";

export interface ImportBundleFileDescriptor {
  fileName: string;
  role: ImportBundleFileRole;
  mimeType: string;
  byteSize: number;
  importSessionId?: string | null;
}

export interface ImportBundleProgress {
  filesTotal: number;
  filesMapped: number;
  chunksCommitted: number;
  chunksTotal: number | null;
}

/** Zero-based data row window (header row excluded). `end` is exclusive. */
export interface ImportRowChunkWindow {
  start: number;
  end: number;
}

/** ADR FS-MIGRATE §3 — persisted on `import_sessions.progress` during chunked ingest. */
export interface ImportSessionChunkProgress {
  entityType: string;
  chunksTotal: number;
  chunksDone: number;
  rowsOk: number;
  rowsFailed: number;
  lastCursor?: {
    rowOffset?: number;
    lastSourceId?: string;
  };
  lastIdempotencyKey?: string;
}

export interface ImportBundleContract {
  id: string;
  companyId: string;
  status: ImportBundleStatus;
  sourceSystem: string | null;
  files: ImportBundleFileDescriptor[];
  progress: ImportBundleProgress;
  createdAt: string;
  updatedAt: string;
}

export interface ImportSessionIngestProgressResponse {
  importSessionId: string;
  status: string;
  entityType: string;
  fileName: string;
  chunk: ImportSessionChunkProgress | null;
}

export interface MigrateOnboardingIngestProgressSession {
  importSessionId: string;
  entityType: string;
  status: string;
  fileName: string;
  chunk: ImportSessionChunkProgress | null;
}

export interface MigrateOnboardingIngestProgressResponse {
  bundleId: string;
  progress: ImportBundleProgress;
  sessions: MigrateOnboardingIngestProgressSession[];
}
