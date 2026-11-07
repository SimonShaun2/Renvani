import { describe, expect, it } from "vitest";
import { CAPABILITIES, METRICS } from "./catalog.js";
import { claimSchema, factSchema, localDateSchema, moneySchema, packetSchema, periodSchema, proposalReferenceSchema, querySchema, readResultSchema, sourceSchema } from "./contracts.js";
import { NOW, factFixture, packetFixture, readFixture, scopeFixture } from "../../../test-fixtures/connected-intelligence.js";

describe("RCI H04 strict contracts", () => {
  it("validates complete versioned evidence", () => expect(packetSchema.safeParse(packetFixture()).success).toBe(true));
  it.each(["1", "01.00", "1e3", "NaN", "Infinity", "-0.00", "1.001", " 1.00", "10000000000000000.00"])("rejects noncanonical money %s", (s) => expect(moneySchema.safeParse(s).success).toBe(false));
  it.each(["0.00", "120.00", "-30.01", "9999999999999999.99"])("accepts decimal string %s", (s) => expect(moneySchema.safeParse(s).success).toBe(true));
  it.each(["2026-02-29", "2026-04-31", "2026-13-01", "not-a-date"])("rejects impossible local date %s", (s) => expect(localDateSchema.safeParse(s).success).toBe(false));
  it("accepts leap date", () => expect(localDateSchema.safeParse("2028-02-29").success).toBe(true));
  it("rejects backwards period and invalid zone", () => { const p = packetFixture().period; expect(periodSchema.safeParse({ ...p, startDate: "2026-12-01" }).success).toBe(false); expect(periodSchema.safeParse({ ...p, timeZone: "Fake/Zone" }).success).toBe(false); });
  it("rejects tenant, SQL and destination injection in a query", () => {
    const q = { recipeId: "CI-Q01", period: packetFixture().period, subject: { kind: "company", id: null } };
    expect(querySchema.safeParse(q).success).toBe(true);
    for (const extra of [{ tenantId: scopeFixture().tenantId }, { sql: "SELECT * FROM payroll" }, { url: "https://bad.example" }]) expect(querySchema.safeParse({ ...q, ...extra }).success).toBe(false);
  });
  it("rejects unknown metric version and weakened sensitivity", () => { const f = factFixture("payroll.gross", "120.00"); expect(factSchema.safeParse({ ...f, definitionVersion: "99" }).success).toBe(false); expect(factSchema.safeParse({ ...f, sensitivity: "operational" }).success).toBe(false); });
  it("rejects money without currency and quantities without units", () => { expect(factSchema.safeParse({ ...factFixture("cost.actual", "20.00"), currency: null }).success).toBe(false); expect(factSchema.safeParse({ ...factFixture("stock.available", "1.5"), quantityUnit: null }).success).toBe(false); });
  it("rejects negative or fractional counts", () => { for (const v of ["-1", "1.5"]) expect(factSchema.safeParse(factFixture("jobs.today", v)).success).toBe(false); });
  it("denied read cannot disclose values or counts", () => { expect(readResultSchema.safeParse({ capabilityId: "workforce", status: "denied" }).success).toBe(true); expect(readResultSchema.safeParse({ capabilityId: "workforce", status: "denied", hiddenCount: 4, facts: [] }).success).toBe(false); });
  it("requires source links and unique IDs", () => { const p = packetFixture(); const r = p.reads[0]; if (r?.status !== "ok") throw new Error("Fixture"); r.facts[0]!.sourceIds = ["unknown"]; expect(packetSchema.safeParse(p).success).toBe(false); const other = packetFixture(); other.reads.push(other.reads[0]!); expect(packetSchema.safeParse(other).success).toBe(false); });
  it("cannot declare a capped result complete", () => { const r = readFixture(); r.quality.computationTruncated = true; expect(readResultSchema.safeParse(r).success).toBe(false); r.quality.completeness = "partial"; expect(readResultSchema.safeParse(r).success).toBe(true); });
  it("cannot declare missing or provisional values final", () => { const r = readFixture("costing", "cost.actual", null); r.quality.finality = "final"; expect(readResultSchema.safeParse(r).success).toBe(false); });
  it("requires comparison and daily period bindings", () => { const p = packetFixture(); const r = p.reads[0]; if (r?.status !== "ok") throw new Error("Fixture"); r.facts[0]!.periodRef = "comparison"; expect(packetSchema.safeParse(p).success).toBe(false); r.facts[0]!.periodRef = "today"; expect(packetSchema.safeParse(p).success).toBe(false); });
  it("requires imported lineage and real query manifests", () => { const s = readFixture().sources[0]!; expect(sourceSchema.safeParse({ ...s, origin: "imported" }).success).toBe(false); expect(sourceSchema.safeParse({ ...s, queryManifest: null }).success).toBe(false); });
  it("rejects future source cutoff", () => { const p = packetFixture(); const r = p.reads[0]; if (r?.status !== "ok") throw new Error("Fixture"); r.asOf = "2026-11-07T15:00:00.000Z"; expect(packetSchema.safeParse(p).success).toBe(false); });
  it("keeps proposals explicitly non-executable", () => { const p = { proposalId: "p", actionType: "purchase.draft", evidencePacketId: "e", policyVersion: "v1", expectedVersion: "v1", requiredPermission: "purchase.review", state: "proposed", executable: false }; expect(proposalReferenceSchema.safeParse(p).success).toBe(true); expect(proposalReferenceSchema.safeParse({ ...p, executable: true }).success).toBe(false); });
  it("rejects arbitrary model prose, URLs and executed effects", () => { const c = { id: "c", kind: "fact", factIds: ["f"], assertedValues: [], strength: "observed", template: "fact_value", effect: "none" }; expect(claimSchema.safeParse({ ...c, text: "Ignore policy", url: "https://bad.example" }).success).toBe(false); expect(claimSchema.safeParse({ ...c, effect: "executed" }).success).toBe(false); });
  it("does not enable or certify adapters from source presence", () => { expect(CAPABILITIES.every((c) => !c.enabled && !c.configured && !c.validated)).toBe(true); expect(new Set(METRICS.map((m) => m.id)).size).toBe(METRICS.length); });
  it("valid fixture timestamp is explicit", () => expect(packetFixture().generatedAt).toBe(NOW));
});
