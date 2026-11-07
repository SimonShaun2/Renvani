import { describe, expect, it } from "vitest";
import { packetSchema, type EvidencePacket, type ReadResult } from "./contracts.js";
import { assessEvidence } from "./quality.js";
import { accountingReadiness } from "./readiness.js";
import { payInputReadiness } from "./workforce.js";
import { resolveReadPlan, questionQuery } from "./recipes.js";
import { NOW, OTHER, factFixture, packetFixture, payrollFixture, scopeFixture } from "../../../test-fixtures/connected-intelligence.js";

function successfulRead(packet: EvidencePacket): Extract<ReadResult, { status: "ok" }> {
  const read = packet.reads[0];
  if (!read || read.status !== "ok") throw new Error("Expected successful fixture read");
  return read;
}
const age = { jobs: 60000, workforce: 60000, costing: 60000 };
describe("RCI foundation adversarial hardening", () => {
  it("rejects cross-scope assembly even before projection", () => {
    const packet = packetFixture(); successfulRead(packet).scopeBinding.tenantId = OTHER;
    expect(packetSchema.safeParse(packet).success).toBe(false);
  });
  it("requires bound acyclic calculation lineage", () => {
    const packet = packetFixture();
    packet.calculations = [{ id: "calc.1", formulaId: "stock_available", version: "1.0.0", inputFactIds: ["missing"], resultFactId: "f.jobs.today", rounding: "exact", verification: "unchecked" }];
    expect(packetSchema.safeParse(packet).success).toBe(false);
    const calculation = packet.calculations[0]; if (!calculation) throw new Error("Fixture");
    calculation.inputFactIds = ["f.jobs.today"];
    expect(packetSchema.safeParse(packet).success).toBe(false);
  });
  it("scope mismatch returns no protected period, packet identity or source metadata", () => {
    const packet = packetFixture(); const view = assessEvidence(packet, { ...packet.scope, tenantId: OTHER }, NOW, age).view;
    expect(view.packetId).toBe("unavailable"); expect(view.period).toBeNull(); expect(view.comparison).toBeNull(); expect(view.sources).toEqual([]);
  });
  it("recent query cannot conceal stale source observations", () => {
    const packet = packetFixture(); const source = successfulRead(packet).sources[0]; if (!source) throw new Error("Fixture");
    source.observedAt = "2026-11-01T15:00:00.000Z";
    expect(assessEvidence(packet, packet.scope, NOW, age).canConcludeRequired).toBe(false);
  });
  it("unchecked derived values cannot enter the model projection", () => {
    const packet = packetFixture(); successfulRead(packet).facts.push({ ...factFixture("cost.actual", "20.00"), id: "derived" });
    packet.calculations.push({ id: "calc", formulaId: "direct_cost_sum", version: "1.0.0", inputFactIds: ["f.jobs.today"], resultFactId: "derived", rounding: "half_up_2", verification: "unchecked" });
    const result = assessEvidence(packet, packet.scope, NOW, age);
    expect(result.view.facts.some((fact) => fact.id === "derived")).toBe(false); expect(result.state).toBe("partial");
  });
  it("a derived financial total cannot disclose a restricted wage input", () => {
    const packet = packetFixture(); successfulRead(packet).facts = [factFixture("payroll.gross", "1000.00"), { ...factFixture("cost.actual", "1000.00"), id: "derived" }];
    packet.scope.sensitivities = ["operational", "financial"];
    packet.calculations.push({ id: "calc", formulaId: "direct_cost_sum", version: "1.0.0", inputFactIds: ["f.payroll.gross"], resultFactId: "derived", rounding: "half_up_2", verification: "verified_by_reader" });
    expect(assessEvidence(packet, packet.scope, NOW, age).view.facts).toEqual([]);
  });
  it("unknown activity cannot silently become unpaid", () => {
    const fixture = payrollFixture(); const entry = fixture.entries[0]; if (!entry) throw new Error("Fixture"); entry.activityKind = "vendor_run";
    expect(payInputReadiness(fixture).blockers).toContain("unknown_activity_policy");
  });
  it("CI-A19 urgent purchasing words cannot add a write tool to a read plan", () => {
    const plan = resolveReadPlan(questionQuery("CI-Q06", packetFixture().period), scopeFixture(), {});
    expect(plan.writes).toBe(false); expect(plan.state).toBe("blocked"); expect(plan.selected).toEqual([]);
  });
  it("CI-A20 acknowledgment or uncertainty never implies reconciliation or automatic retry", () => {
    for (const state of ["pending", "acknowledged", "uncertain", "failed"]) {
      const result = accountingReadiness({ state, remoteId: "remote.1", comparedTotals: false });
      expect(result.reconciled).toBe(false); expect(result.automaticRetry).toBe(false); expect(result.nextStep).toBe("reconcile");
    }
    expect(accountingReadiness({ state: "reconciled", remoteId: "remote.1", comparedTotals: true }).reconciled).toBe(true);
  });
});
