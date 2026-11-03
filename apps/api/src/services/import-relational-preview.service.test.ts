import type { RelationalJoinIssue } from "@fsm/types";
import { describe, expect, it } from "vitest";

import {
  buildCustomerPropertyPreviewGraph,
  buildImportBundleRelationalPreview,
  buildRelationalPreviewGraph,
  customerPreviewRowsFromMapped,
  jobPreviewRowsFromMapped,
  normalizeRelationalJoinKey,
  propertyPreviewRowsFromMapped
} from "./import-relational-preview.service.js";

describe("import-relational-preview.service", () => {
  it("links properties to customers by customer key (case-insensitive)", () => {
    const graph = buildCustomerPropertyPreviewGraph(
      [
        { row: 2, customerKey: "C-1", displayName: "Acme" },
        { row: 3, customerKey: "C-2", displayName: "Beta" }
      ],
      [
        { row: 2, propertyKey: "P-1", customerKey: "c-1", label: "Main St" },
        { row: 3, propertyKey: "P-2", customerKey: "C-9", label: "Orphan" }
      ]
    );

    expect(graph.edges).toHaveLength(1);
    expect(graph.edges[0]).toEqual({
      fromCustomerId: "C-1",
      toPropertyId: "P-1",
      joinKey: "c-1"
    });
    expect(graph.orphanPropertyCount).toBe(1);
    expect(graph.unmatchedCustomerKeys).toEqual(["C-2"]);
    expect(graph.joinIssues.some((issue: RelationalJoinIssue) => issue.code === "orphan_property")).toBe(
      true
    );
    expect(graph.stats.linkedPropertyCount).toBe(1);
  });

  it("links jobs to properties and flags orphan jobs", () => {
    const graph = buildRelationalPreviewGraph({
      customerRows: [{ row: 2, customerKey: "C-1", displayName: "Acme" }],
      propertyRows: [
        { row: 2, propertyKey: "P-1", customerKey: "C-1", label: "Main St" },
        { row: 3, propertyKey: "P-2", customerKey: "C-1", label: "Second site" }
      ],
      jobRows: [
        { row: 2, jobKey: "J-1", propertyKey: "P-1", label: "Tune-up", businessDate: null },
        { row: 3, jobKey: "J-2", propertyKey: "P-99", label: "Orphan job", businessDate: null }
      ]
    });

    expect(graph.propertyJobEdges).toEqual([
      { fromPropertyId: "P-1", toJobId: "J-1", joinKey: "P-1" }
    ]);
    expect(graph.orphanJobCount).toBe(1);
    expect(graph.unmatchedPropertyKeys).toEqual(["P-2"]);
    expect(graph.stats.linkedJobCount).toBe(1);
  });

  it("detects duplicate vendor keys in mapped customer rows", () => {
    const { rows, issues } = customerPreviewRowsFromMapped(
      [
        { row: 2, fields: { sourceId: "C-1", displayName: "Acme" } },
        { row: 3, fields: { sourceId: "c-1", displayName: "Acme duplicate" } }
      ],
      { sourceId: "sourceId", displayName: "displayName" }
    );

    expect(rows).toHaveLength(2);
    expect(issues.some((issue) => issue.code === "duplicate_customer_key")).toBe(true);
  });

  it("builds bundle preview from mapped tabular rows (customer + location + job)", () => {
    const preview = buildImportBundleRelationalPreview({
      bundleId: "bundle-1",
      files: [
        { importSessionId: "sess-c", kind: "customers", fileName: "customers.csv" },
        { importSessionId: "sess-p", kind: "properties", fileName: "locations.csv" },
        { importSessionId: "sess-j", kind: "jobs", fileName: "jobs.csv" }
      ],
      customerMappedRows: [{ row: 2, fields: { sourceId: "C-1", displayName: "Acme" } }],
      propertyMappedRows: [
        { row: 2, fields: { sourceId: "P-1", customerSourceId: "C-1", label: "Main St" } }
      ],
      jobMappedRows: [{ row: 2, fields: { sourceId: "J-1", propertySourceId: "P-1", label: "Tune-up" } }],
      fieldKeys: {
        customers: { sourceId: "sourceId", displayName: "displayName" },
        properties: {
          sourceId: "sourceId",
          customerSourceId: "customerSourceId",
          label: "label"
        },
        jobs: { sourceId: "sourceId", propertySourceId: "propertySourceId", label: "label" }
      }
    });

    expect(preview.bundleId).toBe("bundle-1");
    expect(preview.graph.edges).toHaveLength(1);
    expect(preview.graph.propertyJobEdges).toHaveLength(1);
    expect(preview.graph.stats.jobCount).toBe(1);
  });

  it("normalizes join keys for matching", () => {
    expect(normalizeRelationalJoinKey("  C-1 ")).toBe("c-1");
  });

  it("flags missing join keys when extracting property rows", () => {
    const { rows, issues } = propertyPreviewRowsFromMapped(
      [{ row: 4, fields: { sourceId: "P-1", customerSourceId: null, label: "Main" } }],
      {
        sourceId: "sourceId",
        customerSourceId: "customerSourceId",
        label: "label"
      }
    );

    expect(rows).toHaveLength(0);
    expect(issues).toEqual([
      {
        code: "missing_join_key",
        message: "Missing customer join key on preview row",
        sourceRow: 4,
        field: "customerSourceId"
      }
    ]);
  });

  it("computes multi-year job and estimate history depth with join warnings", () => {
    const graph = buildRelationalPreviewGraph({
      customerRows: [{ row: 2, customerKey: "C-1", displayName: "Acme" }],
      propertyRows: [{ row: 2, propertyKey: "P-1", customerKey: "C-1", label: "Main" }],
      jobRows: [
        { row: 2, jobKey: "J-1", propertyKey: "P-1", label: "2022 job", businessDate: "2022-03-01" },
        { row: 3, jobKey: "J-2", propertyKey: "P-1", label: "2024 job", businessDate: "2024-08-15" }
      ],
      estimateRows: [
        { row: 2, estimateKey: "E-1", jobKey: "J-1", label: "2022 est", businessDate: "2022-01-01" },
        { row: 3, estimateKey: "E-2", jobKey: "J-99", label: "orphan", businessDate: "2024-06-01" }
      ]
    });

    const jobDepth = graph.historyDepth.find((entry) => entry.entity === "jobs");
    const estimateDepth = graph.historyDepth.find((entry) => entry.entity === "estimates");

    expect(jobDepth?.meetsMultiYearThreshold).toBe(true);
    expect(jobDepth?.earliestBusinessDate).toBe("2022-03-01");
    expect(jobDepth?.latestBusinessDate).toBe("2024-08-15");
    expect(estimateDepth?.meetsMultiYearThreshold).toBe(true);
    expect(graph.jobEstimateEdges).toHaveLength(1);
    expect(graph.orphanEstimateCount).toBe(1);
    expect(graph.joinIssues.some((issue) => issue.code === "orphan_estimate")).toBe(true);
    expect(graph.stats.estimateCount).toBe(2);
  });

  it("detects duplicate job keys", () => {
    const { issues } = jobPreviewRowsFromMapped(
      [
        { row: 2, fields: { sourceId: "J-1", propertySourceId: "P-1", label: "A" } },
        { row: 3, fields: { sourceId: "j-1", propertySourceId: "P-1", label: "B" } }
      ],
      { sourceId: "sourceId", propertySourceId: "propertySourceId", label: "label" }
    );

    expect(issues.some((issue) => issue.code === "duplicate_job_key")).toBe(true);
  });
});
