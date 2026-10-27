import {
  goldenImportBundleManifestSchema,
  type GoldenBundleChunkedJobHistorySpec,
  type GoldenImportBundleManifest
} from "@fsm/types";

import {
  buildPresetColumnMapping,
  IMPORT_SOURCE_PRESETS,
  inferImportSourcePresetFromHeaders
} from "../import-source-presets.js";
import {
  expectedGoldenBundleWorkerChunkCount,
  listGoldenBundleChunkPartRelativePaths
} from "./chunked-job-history.js";
import { columnIndex, parseCsvTable } from "./csv.js";
import { parseGoldenBundleTabularTable } from "./tabular.js";
import { goldenImportBundleFileExists, readGoldenImportBundleFile } from "./io.js";

export interface GoldenBundleValidationIssue {
  code:
    | "MISSING_FILE"
    | "JOIN_ORPHAN"
    | "PRESET_NOT_INFERRED"
    | "HISTORY_SPAN_TOO_SHORT"
    | "INVALID_MANIFEST";
  message: string;
}

export interface GoldenBundleValidationResult {
  sourceSystem: GoldenImportBundleManifest["sourceSystem"];
  fixtureId: string;
  issues: GoldenBundleValidationIssue[];
}

type GoldenBundleFile = GoldenImportBundleManifest["files"][number];

function yearsBetween(earliestMs: number, latestMs: number): number {
  const diffMs = Math.max(0, latestMs - earliestMs);
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

function parseBusinessDate(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function validateHistorySpan(
  manifest: GoldenImportBundleManifest,
  issues: GoldenBundleValidationIssue[]
): void {
  if (!manifest.requiredHistorySpanYears) {
    return;
  }

  const dateValues: number[] = [];

  for (const file of manifest.files) {
    if (!file.businessDateColumn) {
      continue;
    }

    const content = readGoldenImportBundleFile(manifest.sourceSystem, file.relativePath);
    const { headers, rows } = parseGoldenBundleTabularTable(content, file.relativePath, file.entityType);
    const dateIdx = columnIndex(headers, file.businessDateColumn);

    for (const row of rows) {
      const ms = parseBusinessDate(row[dateIdx] ?? "");
      if (ms !== null) {
        dateValues.push(ms);
      }
    }
  }

  if (manifest.chunkedJobHistory) {
    collectChunkedJobHistoryBusinessDates(manifest, manifest.chunkedJobHistory, dateValues);
  }

  if (dateValues.length < 2) {
    issues.push({
      code: "HISTORY_SPAN_TOO_SHORT",
      message: `Expected at least two business dates for ${manifest.sourceSystem}`
    });
    return;
  }

  const earliest = Math.min(...dateValues);
  const latest = Math.max(...dateValues);
  const spanYears = yearsBetween(earliest, latest);

  if (spanYears < manifest.requiredHistorySpanYears) {
    issues.push({
      code: "HISTORY_SPAN_TOO_SHORT",
      message: `History span ${spanYears.toFixed(2)}y is below required ${manifest.requiredHistorySpanYears}y for ${manifest.sourceSystem}`
    });
  }
}

function validateJoinLinks(
  manifest: GoldenImportBundleManifest,
  issues: GoldenBundleValidationIssue[]
): void {
  const tables = new Map<string, { headers: string[]; rows: string[][] }>();

  for (const file of manifest.files) {
    const content = readGoldenImportBundleFile(manifest.sourceSystem, file.relativePath);
    tables.set(
      file.relativePath,
      parseGoldenBundleTabularTable(content, file.relativePath, file.entityType)
    );
  }

  for (const file of manifest.files) {
    if (!file.joinLink) {
      continue;
    }

    const child = tables.get(file.relativePath);
    const parent = tables.get(file.joinLink.parentFile);

    if (!child || !parent) {
      issues.push({
        code: "JOIN_ORPHAN",
        message: `Missing table for join validation on ${file.relativePath}`
      });
      continue;
    }

    const parentIdx = columnIndex(parent.headers, file.joinLink.parentColumn);
    const childIdx = columnIndex(child.headers, file.joinLink.localColumn);
    const parentKeys = new Set(parent.rows.map((row) => row[parentIdx]));

    for (const row of child.rows) {
      const key = row[childIdx];
      if (!parentKeys.has(key)) {
        issues.push({
          code: "JOIN_ORPHAN",
          message: `Orphan join key ${key} in ${file.relativePath} → ${file.joinLink.parentFile}`
        });
      }
    }
  }
}

const MIN_GENERIC_MAPPED_COLUMNS = 3;

function bestImportColumnMapping(headers: string[]): Record<string, string> {
  let best: Record<string, string> = {};

  for (const preset of IMPORT_SOURCE_PRESETS) {
    const mapping = buildPresetColumnMapping(headers, preset.id);
    if (Object.keys(mapping).length > Object.keys(best).length) {
      best = mapping;
    }
  }

  return best;
}

/** Non-QB fixtures: generic AI path — any mappable preset (incl. generic), no FSM-specific preset IDs. */
function validateGenericImportColumnMapping(
  manifest: GoldenImportBundleManifest,
  issues: GoldenBundleValidationIssue[]
): void {
  if (manifest.sourceSystem === "qbo" || manifest.sourceSystem === "qbd") {
    return;
  }

  for (const file of manifest.files) {
    if (file.entityType !== "customers" && file.entityType !== "products" && file.entityType !== "invoices") {
      continue;
    }

    if (file.relativePath.includes("price_book")) {
      continue;
    }

    const content = readGoldenImportBundleFile(manifest.sourceSystem, file.relativePath);
    const { headers } = parseGoldenBundleTabularTable(content, file.relativePath, file.entityType);
    const mapping = bestImportColumnMapping(headers);

    if (Object.keys(mapping).length < MIN_GENERIC_MAPPED_COLUMNS) {
      issues.push({
        code: "PRESET_NOT_INFERRED",
        message: `Generic/AI column mapping too sparse for ${manifest.sourceSystem}/${file.relativePath} (${Object.keys(mapping).length} fields)`
      });
    }
  }
}

function assertPresetForFile(
  manifest: GoldenImportBundleManifest,
  file: GoldenBundleFile,
  expectedPresetIds: string | string[],
  entityHint: "customers" | "products" | "invoices",
  issues: GoldenBundleValidationIssue[]
): void {
  const content = readGoldenImportBundleFile(manifest.sourceSystem, file.relativePath);
  const { headers } = parseGoldenBundleTabularTable(content, file.relativePath, file.entityType);
  const presetId = inferImportSourcePresetFromHeaders(headers, entityHint);
  const allowed = Array.isArray(expectedPresetIds) ? expectedPresetIds : [expectedPresetIds];

  if (!presetId || !allowed.includes(presetId)) {
    issues.push({
      code: "PRESET_NOT_INFERRED",
      message: `Expected one of [${allowed.join(", ")}] for ${file.relativePath}, got ${presetId ?? "null"}`
    });
  }
}

/** Housecall Pro: assert golden fixture headers infer HCP presets (not QB/ST). */
function validateHousecallProPresetInference(
  manifest: GoldenImportBundleManifest,
  issues: GoldenBundleValidationIssue[]
): void {
  if (manifest.sourceSystem !== "housecall_pro") {
    return;
  }

  const customerFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "customers");
  if (customerFile) {
    assertPresetForFile(manifest, customerFile, "housecall_pro", "customers", issues);
  }

  const jobFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "jobs");
  if (jobFile) {
    assertPresetForFile(manifest, jobFile, "housecall_pro_jobs", "customers", issues);
  }

  const invoiceFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "invoices");
  if (invoiceFile) {
    assertPresetForFile(manifest, invoiceFile, "housecall_pro_invoices", "invoices", issues);
  }
}

/** ServiceTitan: location-aware multi-export bundle must infer ST preset ids (generic importer path). */
function validateServiceTitanPresetInference(
  manifest: GoldenImportBundleManifest,
  issues: GoldenBundleValidationIssue[]
): void {
  if (manifest.sourceSystem !== "servicetitan") {
    return;
  }

  const byPath = new Map(manifest.files.map((file) => [file.relativePath, file]));

  const customers = byPath.get("customers.csv");
  if (customers) {
    assertPresetForFile(manifest, customers, "service_titan", "customers", issues);
  }

  const locations = byPath.get("locations.csv");
  if (locations) {
    assertPresetForFile(manifest, locations, "service_titan_locations", "customers", issues);
  }

  const jobs = byPath.get("jobs.csv");
  if (jobs) {
    assertPresetForFile(manifest, jobs, "service_titan_jobs", "customers", issues);
  }

  const invoices = byPath.get("invoices.csv");
  if (invoices) {
    assertPresetForFile(manifest, invoices, "service_titan_invoices", "invoices", issues);
  }
}

/** QuickBooks Online + Desktop: source-specific preset assertions only. */
function validateQuickBooksPresetInference(
  manifest: GoldenImportBundleManifest,
  issues: GoldenBundleValidationIssue[]
): void {
  if (manifest.sourceSystem === "qbo") {
    const customerFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "customers");
    if (customerFile) {
      assertPresetForFile(manifest, customerFile, "quickbooks_customers", "customers", issues);
    }

    const invoiceFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "invoices");
    if (invoiceFile) {
      assertPresetForFile(manifest, invoiceFile, "quickbooks_invoices", "invoices", issues);
    }

    const itemsFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "products");
    if (itemsFile) {
      assertPresetForFile(manifest, itemsFile, "quickbooks_items", "products", issues);
    }

    return;
  }

  if (manifest.sourceSystem === "qbd") {
    const customerFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "customers");
    if (customerFile) {
      assertPresetForFile(manifest, customerFile, "quickbooks_desktop_customers", "customers", issues);
    }

    const invoiceFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "invoices");
    if (invoiceFile) {
      assertPresetForFile(manifest, invoiceFile, "quickbooks_desktop_invoices", "invoices", issues);
    }

    const paymentsFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "payments");
    if (paymentsFile) {
      assertPresetForFile(
        manifest,
        paymentsFile,
        ["quickbooks_desktop_payments", "quickbooks_payments"],
        "invoices",
        issues
      );
    }

    const itemsFile = manifest.files.find((entry: GoldenBundleFile) => entry.entityType === "products");
    if (itemsFile) {
      assertPresetForFile(
        manifest,
        itemsFile,
        ["quickbooks_desktop_items", "quickbooks_items"],
        "products",
        issues
      );
    }

  }
}

function collectChunkedJobHistoryBusinessDates(
  manifest: GoldenImportBundleManifest,
  spec: GoldenBundleChunkedJobHistorySpec,
  dateValues: number[]
): void {
  const partPaths = listGoldenBundleChunkPartRelativePaths(spec);
  const firstPath = partPaths[0];
  const lastPath = partPaths[partPaths.length - 1];
  if (!firstPath || !lastPath) {
    return;
  }
  const firstPart = readGoldenImportBundleFile(manifest.sourceSystem, firstPath);
  const lastPart = readGoldenImportBundleFile(manifest.sourceSystem, lastPath);

  for (const content of [firstPart, lastPart]) {
    const { headers, rows } = parseCsvTable(content);
    const dateIdx = columnIndex(headers, spec.businessDateColumn);
    for (const row of rows) {
      const ms = parseBusinessDate(row[dateIdx] ?? "");
      if (ms !== null) {
        dateValues.push(ms);
      }
    }
  }
}

function validateChunkedJobHistory(
  manifest: GoldenImportBundleManifest,
  spec: GoldenBundleChunkedJobHistorySpec,
  issues: GoldenBundleValidationIssue[]
): void {
  const expectedPartRows = spec.partCount * spec.rowsPerPart;
  if (expectedPartRows !== spec.totalDataRows) {
    issues.push({
      code: "INVALID_MANIFEST",
      message: `chunkedJobHistory partCount*rowsPerPart (${expectedPartRows}) must equal totalDataRows (${spec.totalDataRows})`
    });
  }

  const workerChunks = expectedGoldenBundleWorkerChunkCount(spec);
  if (workerChunks < 1) {
    issues.push({
      code: "INVALID_MANIFEST",
      message: `chunkedJobHistory workerRowChunkSize yields zero worker chunks`
    });
  }

  const partPaths = listGoldenBundleChunkPartRelativePaths(spec);
  let dataRowCount = 0;

  for (const relativePath of partPaths) {
    if (!goldenImportBundleFileExists(manifest.sourceSystem, relativePath)) {
      issues.push({
        code: "MISSING_FILE",
        message: `Missing chunked job history part ${manifest.sourceSystem}/${relativePath}`
      });
      continue;
    }

    const content = readGoldenImportBundleFile(manifest.sourceSystem, relativePath);
    const { rows } = parseCsvTable(content);
    dataRowCount += rows.length;

    if (rows.length !== spec.rowsPerPart && relativePath !== partPaths[partPaths.length - 1]) {
      issues.push({
        code: "INVALID_MANIFEST",
        message: `Chunk part ${relativePath} expected ${spec.rowsPerPart} rows, got ${rows.length}`
      });
    }
  }

  if (dataRowCount !== spec.totalDataRows) {
    issues.push({
      code: "INVALID_MANIFEST",
      message: `chunkedJobHistory row count ${dataRowCount} != totalDataRows ${spec.totalDataRows}`
    });
  }

  const parentContent = readGoldenImportBundleFile(manifest.sourceSystem, spec.joinLink.parentFile);
  const parentTable = parseCsvTable(parentContent);
  const parentIdx = columnIndex(parentTable.headers, spec.joinLink.parentColumn);
  const parentKeys = new Set(parentTable.rows.map((row) => row[parentIdx]));

  const firstSamplePath = partPaths[0];
  const lastSamplePath = partPaths[partPaths.length - 1];
  const samplePaths = [firstSamplePath, lastSamplePath].filter(
    (path): path is string => typeof path === "string"
  );
  for (const relativePath of samplePaths) {
    if (!goldenImportBundleFileExists(manifest.sourceSystem, relativePath)) {
      continue;
    }
    const { headers, rows } = parseCsvTable(
      readGoldenImportBundleFile(manifest.sourceSystem, relativePath)
    );
    const childIdx = columnIndex(headers, spec.joinLink.localColumn);
    const edgeRows = [rows[0], rows.at(-1)].filter((row): row is string[] => row !== undefined);
    for (const row of edgeRows) {
      const key = row[childIdx];
      if (!parentKeys.has(key)) {
        issues.push({
          code: "JOIN_ORPHAN",
          message: `Orphan join key ${key} in chunked ${relativePath} → ${spec.joinLink.parentFile}`
        });
      }
    }
  }
}

function validateFilesPresent(
  manifest: GoldenImportBundleManifest,
  issues: GoldenBundleValidationIssue[]
): void {
  for (const file of manifest.files) {
    if (!goldenImportBundleFileExists(manifest.sourceSystem, file.relativePath)) {
      issues.push({
        code: "MISSING_FILE",
        message: `Missing tabular file ${manifest.sourceSystem}/${file.relativePath}`
      });
    }
  }

  for (const mediaPath of manifest.mediaRelativePaths) {
    if (!goldenImportBundleFileExists(manifest.sourceSystem, mediaPath)) {
      issues.push({
        code: "MISSING_FILE",
        message: `Missing media file ${manifest.sourceSystem}/${mediaPath}`
      });
    }
  }
}

export function validateGoldenImportBundleManifest(
  manifest: GoldenImportBundleManifest
): GoldenBundleValidationResult {
  const issues: GoldenBundleValidationIssue[] = [];

  const parsed = goldenImportBundleManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    issues.push({
      code: "INVALID_MANIFEST",
      message: parsed.error.message
    });
    return {
      sourceSystem: manifest.sourceSystem,
      fixtureId: manifest.fixtureId,
      issues
    };
  }

  validateFilesPresent(parsed.data, issues);
  if (issues.some((issue) => issue.code === "MISSING_FILE")) {
    return {
      sourceSystem: parsed.data.sourceSystem,
      fixtureId: parsed.data.fixtureId,
      issues
    };
  }

  validateJoinLinks(parsed.data, issues);
  if (parsed.data.chunkedJobHistory) {
    validateChunkedJobHistory(parsed.data, parsed.data.chunkedJobHistory, issues);
  }
  validateGenericImportColumnMapping(parsed.data, issues);
  validateHousecallProPresetInference(parsed.data, issues);
  validateQuickBooksPresetInference(parsed.data, issues);
  validateServiceTitanPresetInference(parsed.data, issues);
  validateHistorySpan(parsed.data, issues);

  return {
    sourceSystem: parsed.data.sourceSystem,
    fixtureId: parsed.data.fixtureId,
    issues
  };
}

export function assertGoldenImportBundleManifest(manifest: GoldenImportBundleManifest): void {
  const result = validateGoldenImportBundleManifest(manifest);
  if (result.issues.length > 0) {
    const detail = result.issues.map((issue) => `${issue.code}: ${issue.message}`).join("; ");
    throw new Error(`Golden bundle validation failed for ${manifest.fixtureId}: ${detail}`);
  }
}
