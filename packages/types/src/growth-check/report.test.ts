import { describe, expect, it } from "vitest";

import {
  GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY,
  GROWTH_CHECK_REPORT_EVIDENCE_LABEL_REGISTRY,
  growthCheckReportDraftEditBodySchema,
  growthCheckReportExportQuerySchema,
  growthCheckReportShareCreateBodySchema
} from "./report.js";

const id = "00000000-0000-4000-8000-000000000001";

describe("FS-57 report schemas", () => {
  it("requires at least one editable field and rejects unknown keys", () => {
    expect(growthCheckReportDraftEditBodySchema.safeParse({ expectedVersion: 1, idempotencyKey: "key-00001" }).success).toBe(false);
    expect(growthCheckReportDraftEditBodySchema.safeParse({ expectedVersion: 1, idempotencyKey: "key-00001", title: "t", x: 1 }).success).toBe(false);
    expect(growthCheckReportDraftEditBodySchema.safeParse({ expectedVersion: 1, idempotencyKey: "key-00001", intro: null }).success).toBe(true);
  });

  it("caps opportunities at 3 with unique findings and 1-3 scores", () => {
    const opp = (findingId: string, impact = 2) => ({ findingId, headline: "h", nextStep: "n", impact, evidence: 1, actionability: 1 });
    const parse = (opportunities: unknown[]) =>
      growthCheckReportDraftEditBodySchema.safeParse({ expectedVersion: 1, idempotencyKey: "key-00001", opportunities }).success;
    expect(parse([opp(id)])).toBe(true);
    expect(parse([opp(id), opp(id)])).toBe(false);
    expect(parse([opp(id, 0)])).toBe(false);
    expect(parse([1, 2, 3, 4].map((n) => opp(`00000000-0000-4000-8000-00000000000${n}`)))).toBe(false);
  });

  it("defaults export format to markdown and bounds share expiry", () => {
    expect(growthCheckReportExportQuerySchema.parse({})).toEqual({ format: "markdown" });
    expect(growthCheckReportExportQuerySchema.safeParse({ format: "pdf" }).success).toBe(false);
    expect(growthCheckReportShareCreateBodySchema.safeParse({ idempotencyKey: "key-00001", expectedVersion: 1, expiresInDays: 0 }).success).toBe(false);
    expect(growthCheckReportShareCreateBodySchema.safeParse({ idempotencyKey: "key-00001", expectedVersion: 1, expiresInDays: 90 }).success).toBe(true);
  });

  it("keeps registries trade-neutral and delivery disabled", () => {
    const text = JSON.stringify([GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY, GROWTH_CHECK_REPORT_EVIDENCE_LABEL_REGISTRY]);
    expect(text).not.toMatch(/clean|restaurant/i);
    expect(GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY.every((c) => c.enabled === false)).toBe(true);
  });
});
