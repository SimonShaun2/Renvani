import type {
  BuildRelationalPreviewGraphInput,
  ColumnMapping,
  CustomerPreviewRow,
  EstimatePreviewRow,
  ImportBundleRelationalPreview,
  JobPreviewRow,
  PropertyPreviewRow,
  RelationalJoinIssue,
  RelationalPreviewEdge,
  RelationalPreviewGraph,
  RelationalPreviewNode,
  RelationalPropertyJobEdge,
  RelationalJobEstimateEdge,
  RelationalPreviewFieldKeys,
  MappedImportPreviewRow,
  TabularRelationalPreviewInput
} from "@fsm/types";

import {
  computeEntityHistoryDepth,
  readBusinessDateField
} from "./import-relational-preview-history.js";

export type {
  CustomerPreviewRow,
  JobPreviewRow,
  PropertyPreviewRow
} from "@fsm/types";

export function normalizeRelationalJoinKey(value: string): string {
  return value.trim().toLowerCase();
}

export function mappedImportPreviewRowsFromCsv(
  rows: Array<{ rowNumber: number; values: Record<string, string> }>,
  columnMapping: ColumnMapping
): MappedImportPreviewRow[] {
  const mappedRows: MappedImportPreviewRow[] = [];

  for (const row of rows) {
    const fields: Record<string, string | null> = {};

    for (const [csvColumn, fieldName] of Object.entries(columnMapping)) {
      if (typeof fieldName !== "string" || fieldName.length === 0) {
        continue;
      }

      const raw = row.values[csvColumn];
      if (raw === undefined || raw.trim().length === 0) {
        fields[fieldName] = null;
      } else {
        fields[fieldName] = raw.trim();
      }
    }

    mappedRows.push({
      row: row.rowNumber,
      fields
    });
  }

  return mappedRows;
}

function isNonEmpty(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readMappedField(
  fields: Record<string, string | null>,
  fieldKey: string | undefined,
  row: number,
  fieldLabel: string,
  issues: RelationalJoinIssue[]
): string | null {
  if (!fieldKey) {
    return null;
  }

  const raw = fields[fieldKey];
  if (!isNonEmpty(raw)) {
    issues.push({
      code: "missing_join_key",
      message: `Missing ${fieldLabel} on preview row`,
      sourceRow: row,
      field: fieldKey
    });
    return null;
  }

  return raw.trim();
}

function detectDuplicateKeys(
  rows: Array<{ row: number; key: string }>,
  code: RelationalJoinIssue["code"],
  label: string
): RelationalJoinIssue[] {
  const issues: RelationalJoinIssue[] = [];
  const seen = new Map<string, number>();

  for (const entry of rows) {
    const normalized = normalizeRelationalJoinKey(entry.key);
    const priorRow = seen.get(normalized);
    if (priorRow !== undefined) {
      issues.push({
        code,
        message: `Duplicate ${label} key "${entry.key}" (rows ${priorRow} and ${entry.row})`,
        sourceRow: entry.row,
        joinKey: entry.key
      });
      continue;
    }
    seen.set(normalized, entry.row);
  }

  return issues;
}

export function customerPreviewRowsFromMapped(
  mappedRows: MappedImportPreviewRow[],
  fieldKeys: RelationalPreviewFieldKeys
): { rows: CustomerPreviewRow[]; issues: RelationalJoinIssue[] } {
  const issues: RelationalJoinIssue[] = [];
  const rows: CustomerPreviewRow[] = [];

  for (const mappedRow of mappedRows) {
    const customerKey = readMappedField(
      mappedRow.fields,
      fieldKeys.sourceId,
      mappedRow.row,
      "customer source id",
      issues
    );
    if (!customerKey) {
      continue;
    }

    const displayName =
      readMappedField(mappedRow.fields, fieldKeys.displayName, mappedRow.row, "display name", issues) ??
      customerKey;

    rows.push({
      row: mappedRow.row,
      customerKey,
      displayName
    });
  }

  issues.push(
    ...detectDuplicateKeys(
      rows.map((row) => ({ row: row.row, key: row.customerKey })),
      "duplicate_customer_key",
      "customer"
    )
  );

  return { rows, issues };
}

export function propertyPreviewRowsFromMapped(
  mappedRows: MappedImportPreviewRow[],
  fieldKeys: RelationalPreviewFieldKeys
): { rows: PropertyPreviewRow[]; issues: RelationalJoinIssue[] } {
  const issues: RelationalJoinIssue[] = [];
  const rows: PropertyPreviewRow[] = [];

  for (const mappedRow of mappedRows) {
    const propertyKey = readMappedField(
      mappedRow.fields,
      fieldKeys.sourceId,
      mappedRow.row,
      "property source id",
      issues
    );
    const customerKey = readMappedField(
      mappedRow.fields,
      fieldKeys.customerSourceId,
      mappedRow.row,
      "customer join key",
      issues
    );
    if (!propertyKey || !customerKey) {
      continue;
    }

    const label =
      readMappedField(mappedRow.fields, fieldKeys.label, mappedRow.row, "property label", issues) ??
      propertyKey;

    rows.push({
      row: mappedRow.row,
      propertyKey,
      customerKey,
      label
    });
  }

  issues.push(
    ...detectDuplicateKeys(
      rows.map((row) => ({ row: row.row, key: row.propertyKey })),
      "duplicate_property_key",
      "property"
    )
  );

  return { rows, issues };
}

export function jobPreviewRowsFromMapped(
  mappedRows: MappedImportPreviewRow[],
  fieldKeys: RelationalPreviewFieldKeys
): { rows: JobPreviewRow[]; issues: RelationalJoinIssue[] } {
  const issues: RelationalJoinIssue[] = [];
  const rows: JobPreviewRow[] = [];

  for (const mappedRow of mappedRows) {
    const jobKey = readMappedField(mappedRow.fields, fieldKeys.sourceId, mappedRow.row, "job source id", issues);
    const propertyKey = readMappedField(
      mappedRow.fields,
      fieldKeys.propertySourceId,
      mappedRow.row,
      "property join key",
      issues
    );
    if (!jobKey || !propertyKey) {
      continue;
    }

    const label =
      readMappedField(mappedRow.fields, fieldKeys.label, mappedRow.row, "job label", issues) ?? jobKey;

    const businessDate = readBusinessDateField(
      mappedRow.fields,
      fieldKeys.businessDate,
      mappedRow.row,
      "job",
      issues
    );

    rows.push({
      row: mappedRow.row,
      jobKey,
      propertyKey,
      label,
      businessDate
    });
  }

  issues.push(
    ...detectDuplicateKeys(
      rows.map((row) => ({ row: row.row, key: row.jobKey })),
      "duplicate_job_key",
      "job"
    )
  );

  return { rows, issues };
}

export function estimatePreviewRowsFromMapped(
  mappedRows: MappedImportPreviewRow[],
  fieldKeys: RelationalPreviewFieldKeys
): { rows: EstimatePreviewRow[]; issues: RelationalJoinIssue[] } {
  const issues: RelationalJoinIssue[] = [];
  const rows: EstimatePreviewRow[] = [];

  for (const mappedRow of mappedRows) {
    const estimateKey = readMappedField(
      mappedRow.fields,
      fieldKeys.sourceId,
      mappedRow.row,
      "estimate source id",
      issues
    );
    const jobKey = readMappedField(mappedRow.fields, fieldKeys.jobSourceId, mappedRow.row, "job join key", issues);
    if (!estimateKey || !jobKey) {
      continue;
    }

    const label =
      readMappedField(mappedRow.fields, fieldKeys.label, mappedRow.row, "estimate label", issues) ?? estimateKey;

    const businessDate = readBusinessDateField(
      mappedRow.fields,
      fieldKeys.businessDate,
      mappedRow.row,
      "estimate",
      issues
    );

    rows.push({
      row: mappedRow.row,
      estimateKey,
      jobKey,
      label,
      businessDate
    });
  }

  issues.push(
    ...detectDuplicateKeys(
      rows.map((row) => ({ row: row.row, key: row.estimateKey })),
      "duplicate_estimate_key",
      "estimate"
    )
  );

  return { rows, issues };
}

export function buildRelationalPreviewGraph(input: BuildRelationalPreviewGraphInput): RelationalPreviewGraph {
  const jobRows = input.jobRows ?? [];
  const estimateRows = input.estimateRows ?? [];
  const joinIssues: RelationalJoinIssue[] = [];

  const customerCanonicalByNormalized = new Map<string, string>();
  for (const row of input.customerRows) {
    customerCanonicalByNormalized.set(normalizeRelationalJoinKey(row.customerKey), row.customerKey);
  }

  const propertyCanonicalByNormalized = new Map<string, string>();
  for (const row of input.propertyRows) {
    propertyCanonicalByNormalized.set(normalizeRelationalJoinKey(row.propertyKey), row.propertyKey);
  }

  const jobCanonicalByNormalized = new Map<string, string>();
  for (const row of jobRows) {
    jobCanonicalByNormalized.set(normalizeRelationalJoinKey(row.jobKey), row.jobKey);
  }

  const customers: RelationalPreviewNode[] = input.customerRows.map((row) => ({
    id: row.customerKey,
    kind: "customer",
    label: row.displayName,
    sourceRow: row.row
  }));

  const properties: RelationalPreviewNode[] = [];
  const edges: RelationalPreviewEdge[] = [];
  let orphanPropertyCount = 0;

  for (const propertyRow of input.propertyRows) {
    properties.push({
      id: propertyRow.propertyKey,
      kind: "property",
      label: propertyRow.label,
      sourceRow: propertyRow.row
    });

    const normalizedCustomerKey = normalizeRelationalJoinKey(propertyRow.customerKey);
    const canonicalCustomerId = customerCanonicalByNormalized.get(normalizedCustomerKey);
    if (!canonicalCustomerId) {
      orphanPropertyCount += 1;
      joinIssues.push({
        code: "orphan_property",
        message: `Property "${propertyRow.propertyKey}" references unknown customer "${propertyRow.customerKey}"`,
        sourceRow: propertyRow.row,
        joinKey: propertyRow.customerKey
      });
      continue;
    }

    edges.push({
      fromCustomerId: canonicalCustomerId,
      toPropertyId: propertyRow.propertyKey,
      joinKey: propertyRow.customerKey
    });
  }

  const jobs: RelationalPreviewNode[] = [];
  const propertyJobEdges: RelationalPropertyJobEdge[] = [];
  let orphanJobCount = 0;

  for (const jobRow of jobRows) {
    jobs.push({
      id: jobRow.jobKey,
      kind: "job",
      label: jobRow.label,
      sourceRow: jobRow.row
    });

    const normalizedPropertyKey = normalizeRelationalJoinKey(jobRow.propertyKey);
    const canonicalPropertyId = propertyCanonicalByNormalized.get(normalizedPropertyKey);
    if (!canonicalPropertyId) {
      orphanJobCount += 1;
      joinIssues.push({
        code: "orphan_job",
        message: `Job "${jobRow.jobKey}" references unknown property "${jobRow.propertyKey}"`,
        sourceRow: jobRow.row,
        joinKey: jobRow.propertyKey
      });
      continue;
    }

    propertyJobEdges.push({
      fromPropertyId: canonicalPropertyId,
      toJobId: jobRow.jobKey,
      joinKey: jobRow.propertyKey
    });
  }

  const linkedCustomerKeys = new Set(edges.map((edge) => normalizeRelationalJoinKey(edge.fromCustomerId)));
  const unmatchedCustomerKeys = input.customerRows
    .map((row) => row.customerKey)
    .filter((key) => !linkedCustomerKeys.has(normalizeRelationalJoinKey(key)));

  const linkedPropertyKeys = new Set(
    propertyJobEdges.map((edge) => normalizeRelationalJoinKey(edge.fromPropertyId))
  );
  const unmatchedPropertyKeys = input.propertyRows
    .map((row) => row.propertyKey)
    .filter((key) => !linkedPropertyKeys.has(normalizeRelationalJoinKey(key)));

  const estimates: RelationalPreviewNode[] = [];
  const jobEstimateEdges: RelationalJobEstimateEdge[] = [];
  let orphanEstimateCount = 0;

  for (const estimateRow of estimateRows) {
    estimates.push({
      id: estimateRow.estimateKey,
      kind: "estimate",
      label: estimateRow.label,
      sourceRow: estimateRow.row
    });

    const normalizedJobKey = normalizeRelationalJoinKey(estimateRow.jobKey);
    const canonicalJobId = jobCanonicalByNormalized.get(normalizedJobKey);
    if (!canonicalJobId) {
      orphanEstimateCount += 1;
      joinIssues.push({
        code: "orphan_estimate",
        message: `Estimate "${estimateRow.estimateKey}" references unknown job "${estimateRow.jobKey}"`,
        sourceRow: estimateRow.row,
        joinKey: estimateRow.jobKey
      });
      continue;
    }

    jobEstimateEdges.push({
      fromJobId: canonicalJobId,
      toEstimateId: estimateRow.estimateKey,
      joinKey: estimateRow.jobKey
    });
  }

  const linkedJobKeys = new Set(jobEstimateEdges.map((edge) => normalizeRelationalJoinKey(edge.fromJobId)));
  const unmatchedJobKeys = jobRows
    .map((row) => row.jobKey)
    .filter((key) => !linkedJobKeys.has(normalizeRelationalJoinKey(key)));

  const jobDates = jobRows.filter((row) => row.businessDate !== null).map((row) => row.businessDate as string);
  const jobUndated = jobRows.length - jobDates.length;
  const estimateDates = estimateRows
    .filter((row) => row.businessDate !== null)
    .map((row) => row.businessDate as string);
  const estimateUndated = estimateRows.length - estimateDates.length;

  const historyDepth = [
    computeEntityHistoryDepth("jobs", jobDates, jobUndated),
    computeEntityHistoryDepth("estimates", estimateDates, estimateUndated)
  ];

  return {
    customers,
    properties,
    jobs,
    estimates,
    edges,
    propertyJobEdges,
    jobEstimateEdges,
    orphanPropertyCount,
    orphanJobCount,
    orphanEstimateCount,
    unmatchedCustomerKeys,
    unmatchedPropertyKeys,
    unmatchedJobKeys,
    historyDepth,
    joinIssues,
    stats: {
      customerCount: customers.length,
      propertyCount: properties.length,
      jobCount: jobs.length,
      estimateCount: estimates.length,
      linkedPropertyCount: edges.length,
      linkedJobCount: propertyJobEdges.length,
      linkedEstimateCount: jobEstimateEdges.length
    }
  };
}

/** M2 two-file join (customers + locations/properties). */
export function buildCustomerPropertyPreviewGraph(
  customerRows: CustomerPreviewRow[],
  propertyRows: PropertyPreviewRow[]
): RelationalPreviewGraph {
  return buildRelationalPreviewGraph({ customerRows, propertyRows });
}

export function buildImportBundleRelationalPreview(
  input: TabularRelationalPreviewInput
): ImportBundleRelationalPreview {
  const joinIssues: RelationalJoinIssue[] = [];

  const customerExtract = customerPreviewRowsFromMapped(input.customerMappedRows, input.fieldKeys.customers);
  const propertyExtract = propertyPreviewRowsFromMapped(input.propertyMappedRows, input.fieldKeys.properties);
  joinIssues.push(...customerExtract.issues, ...propertyExtract.issues);

  let jobRows: JobPreviewRow[] = [];
  if (input.jobMappedRows && input.fieldKeys.jobs) {
    const jobExtract = jobPreviewRowsFromMapped(input.jobMappedRows, input.fieldKeys.jobs);
    jobRows = jobExtract.rows;
    joinIssues.push(...jobExtract.issues);
  }

  let estimateRows: EstimatePreviewRow[] = [];
  if (input.estimateMappedRows && input.fieldKeys.estimates) {
    const estimateExtract = estimatePreviewRowsFromMapped(input.estimateMappedRows, input.fieldKeys.estimates);
    estimateRows = estimateExtract.rows;
    joinIssues.push(...estimateExtract.issues);
  }

  const graph = buildRelationalPreviewGraph({
    customerRows: customerExtract.rows,
    propertyRows: propertyExtract.rows,
    jobRows,
    estimateRows
  });

  graph.joinIssues.push(...joinIssues);

  return {
    bundleId: input.bundleId,
    files: input.files,
    graph
  };
}
