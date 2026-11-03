import { describe, expect, it } from "vitest";

import {
  buildImportChunkCommitManifest,
  initialImportSessionChunkProgress,
  isChunkCommitEligibleEntity
} from "./chunk-manifest.js";

describe("chunk-manifest", () => {
  it("detects chunk-eligible customer imports with sourceId mapping", () => {
    expect(
      isChunkCommitEligibleEntity("customers", {
        "Customer ID": "sourceId",
        Name: "displayName"
      })
    ).toBe(true);
    expect(isChunkCommitEligibleEntity("customers", { Name: "displayName" })).toBe(false);
    expect(isChunkCommitEligibleEntity("price_book", { SKU: "sourceId" })).toBe(false);
  });

  it("builds manifest chunks with row windows", () => {
    const manifest = buildImportChunkCommitManifest({
      totalDataRows: 3,
      entityType: "customers",
      sourceSystem: "jobber",
      chunkSize: 2
    });

    expect(manifest?.chunks).toHaveLength(2);
    expect(manifest?.chunks[0]).toMatchObject({
      chunkIndex: 0,
      chunksTotal: 2,
      rowWindow: { start: 0, end: 2 }
    });
    expect(manifest?.chunks[1]).toMatchObject({
      chunkIndex: 1,
      chunksTotal: 2,
      rowWindow: { start: 2, end: 3 }
    });
  });

  it("seeds initial session progress from manifest", () => {
    const manifest = buildImportChunkCommitManifest({
      totalDataRows: 10,
      entityType: "jobs",
      sourceSystem: "service_fusion"
    });
    expect(manifest).not.toBeNull();
    if (!manifest) {
      return;
    }

    expect(initialImportSessionChunkProgress(manifest)).toEqual({
      entityType: "jobs",
      chunksTotal: manifest.chunks[0]?.chunksTotal,
      chunksDone: 0,
      rowsOk: 0,
      rowsFailed: 0
    });
  });
});

describe("chunk eligibility registry", () => {
  it("makes properties eligible only with sourceId and a customer reference", async () => {
    const { isChunkCommitEligibleEntity } = await import("./chunk-manifest.js");
    expect(isChunkCommitEligibleEntity("properties", { a: "sourceId", b: "customerSourceId" })).toBe(true);
    expect(isChunkCommitEligibleEntity("properties", { a: "sourceId", b: "customerId" })).toBe(true);
    expect(isChunkCommitEligibleEntity("properties", { a: "sourceId" })).toBe(false);
    expect(isChunkCommitEligibleEntity("properties", { b: "customerSourceId" })).toBe(false);
  });

  it("makes invoices eligible with sourceId or invoiceNumber plus a customer reference", async () => {
    const { isChunkCommitEligibleEntity } = await import("./chunk-manifest.js");
    expect(isChunkCommitEligibleEntity("invoices", { a: "invoiceNumber", b: "customerSourceId" })).toBe(true);
    expect(isChunkCommitEligibleEntity("invoices", { a: "sourceId", b: "customerId" })).toBe(true);
    expect(isChunkCommitEligibleEntity("invoices", { a: "invoiceNumber" })).toBe(false);
  });

  it("keeps payments and unknown types out of chunk commits", async () => {
    const { isChunkCommitEligibleEntity } = await import("./chunk-manifest.js");
    expect(isChunkCommitEligibleEntity("payments", { a: "sourceId", b: "customerSourceId" })).toBe(false);
    expect(isChunkCommitEligibleEntity("toString", { a: "sourceId" })).toBe(false);
    expect(isChunkCommitEligibleEntity("customers", { a: "email" })).toBe(false);
  });
});
