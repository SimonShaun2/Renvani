import type { ColumnMapping } from "./import.types.js";

export type RelationalPreviewNodeKind = "customer" | "property" | "job" | "estimate";

export interface RelationalPreviewNode {
  id: string;
  kind: RelationalPreviewNodeKind;
  label: string;
  sourceRow: number;
}

/** Customer (vendor id) → property (vendor id). */
export interface RelationalPreviewEdge {
  fromCustomerId: string;
  toPropertyId: string;
  joinKey: string;
}

/** Property (vendor id) → job (vendor id). */
export interface RelationalPropertyJobEdge {
  fromPropertyId: string;
  toJobId: string;
  joinKey: string;
}

/** Job (vendor id) → estimate (vendor id). */
export interface RelationalJobEstimateEdge {
  fromJobId: string;
  toEstimateId: string;
  joinKey: string;
}

export type RelationalJoinIssueCode =
  | "duplicate_customer_key"
  | "duplicate_property_key"
  | "duplicate_job_key"
  | "duplicate_estimate_key"
  | "missing_join_key"
  | "missing_business_date"
  | "orphan_property"
  | "orphan_job"
  | "orphan_estimate";

export interface RelationalEntityHistoryDepth {
  entity: "jobs" | "estimates";
  datedRowCount: number;
  undatedRowCount: number;
  earliestBusinessDate: string | null;
  latestBusinessDate: string | null;
  spanYears: number | null;
  /** True when span is at least two years (epic §6 multi-year history). */
  meetsMultiYearThreshold: boolean;
}

export interface RelationalJoinIssue {
  code: RelationalJoinIssueCode;
  message: string;
  sourceRow?: number;
  field?: string;
  joinKey?: string;
}

export interface RelationalPreviewGraphStats {
  customerCount: number;
  propertyCount: number;
  jobCount: number;
  estimateCount: number;
  linkedPropertyCount: number;
  linkedJobCount: number;
  linkedEstimateCount: number;
}

export interface RelationalPreviewGraph {
  customers: RelationalPreviewNode[];
  properties: RelationalPreviewNode[];
  jobs: RelationalPreviewNode[];
  estimates: RelationalPreviewNode[];
  edges: RelationalPreviewEdge[];
  propertyJobEdges: RelationalPropertyJobEdge[];
  jobEstimateEdges: RelationalJobEstimateEdge[];
  orphanPropertyCount: number;
  orphanJobCount: number;
  orphanEstimateCount: number;
  unmatchedCustomerKeys: string[];
  unmatchedPropertyKeys: string[];
  unmatchedJobKeys: string[];
  historyDepth: RelationalEntityHistoryDepth[];
  joinIssues: RelationalJoinIssue[];
  stats: RelationalPreviewGraphStats;
}

export type ImportBundleFileKind = "customers" | "properties" | "jobs" | "estimates";

export interface ImportBundleFileRef {
  importSessionId: string;
  kind: ImportBundleFileKind;
  fileName: string;
}

export interface ImportBundleRelationalPreview {
  bundleId: string;
  files: ImportBundleFileRef[];
  graph: RelationalPreviewGraph;
}

export interface RelationalPreviewFieldKeys {
  sourceId: string;
  displayName?: string;
  customerSourceId?: string;
  propertySourceId?: string;
  jobSourceId?: string;
  businessDate?: string;
  label?: string;
}

export interface MappedImportPreviewRow {
  row: number;
  fields: Record<string, string | null>;
}

export interface CustomerPreviewRow {
  row: number;
  customerKey: string;
  displayName: string;
}

export interface PropertyPreviewRow {
  row: number;
  propertyKey: string;
  customerKey: string;
  label: string;
}

export interface JobPreviewRow {
  row: number;
  jobKey: string;
  propertyKey: string;
  label: string;
  businessDate: string | null;
}

export interface EstimatePreviewRow {
  row: number;
  estimateKey: string;
  jobKey: string;
  label: string;
  businessDate: string | null;
}

export interface BuildRelationalPreviewGraphInput {
  customerRows: CustomerPreviewRow[];
  propertyRows: PropertyPreviewRow[];
  jobRows?: JobPreviewRow[];
  estimateRows?: EstimatePreviewRow[];
}

export interface TabularRelationalPreviewInput {
  bundleId: string;
  files: ImportBundleFileRef[];
  customerMappedRows: MappedImportPreviewRow[];
  propertyMappedRows: MappedImportPreviewRow[];
  jobMappedRows?: MappedImportPreviewRow[];
  estimateMappedRows?: MappedImportPreviewRow[];
  fieldKeys: {
    customers: RelationalPreviewFieldKeys;
    properties: RelationalPreviewFieldKeys;
    jobs?: RelationalPreviewFieldKeys;
    estimates?: RelationalPreviewFieldKeys;
  };
  columnMappings?: {
    customers?: ColumnMapping;
    properties?: ColumnMapping;
    jobs?: ColumnMapping;
    estimates?: ColumnMapping;
  };
}
