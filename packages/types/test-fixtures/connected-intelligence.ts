import { COMMAND_CENTER_KPI_REGISTRY, type CommandCenterBrief } from "../src/command-center.types.js";
import { CAPABILITIES, EVIDENCE_VERSION, SENSITIVITIES, getMetric, type CapabilityId } from "../src/connected-intelligence/v1/catalog.js";
import { packetSchema, type EvidenceFact, type EvidencePacket, type EvidenceScope, type ReadResult } from "../src/connected-intelligence/v1/contracts.js";

/** SYNTHETIC TEST DATA. Outside src, excluded from production build and all package exports. */
export const NOW = "2026-11-06T15:00:00.000Z";
export const TENANT = "00000000-0000-4000-8000-000000000001";
export const OTHER = "00000000-0000-4000-8000-000000000002";
export const ACTOR = "00000000-0000-4000-8000-000000000003";
export const RECORD = "00000000-0000-4000-8000-000000000004";
export function scopeFixture(): EvidenceScope { return { tenantId: TENANT, actorId: ACTOR, scopeKey: "scope.synthetic.owner", authorizationVersion: "v1",
  locationIds: [], permissions: CAPABILITIES.map((c) => c.permission), sensitivities: [...SENSITIVITIES] }; }
export function factFixture(metricId = "jobs.today", value: string | null = "2"): EvidenceFact {
  const m = getMetric(metricId); if (!m) throw new Error("Unknown test metric");
  return { id: `f.${metricId}`, metricId, definitionVersion: m.version, value, unit: m.unit, currency: m.unit === "money" ? "USD" : null,
    quantityUnit: m.unit === "quantity" ? "unit" : null, basis: m.basis, grain: m.grain, sensitivity: m.sensitivity,
    sourceIds: ["s.test"], periodRef: "current", finality: "not_applicable", displaySourcesTruncated: false };
}
export function readFixture(capabilityId: CapabilityId = "jobs", metricId = "jobs.today", value: string | null = "2"): Extract<ReadResult, { status: "ok" }> {
  return { capabilityId, status: "ok", asOf: NOW, quality: { completeness: "complete", freshness: "fresh", reconciliation: "not_applicable", finality: "not_applicable", computationTruncated: false },
    sources: [{ id: "s.test", kind: "query_manifest", entityId: null, recordVersion: "snapshot.v1", observedAt: NOW, effectiveAt: NOW,
      sensitivity: getMetric(metricId)?.sensitivity ?? "operational", origin: "aggregate", importBatchId: null,
      queryManifest: { queryId: "synthetic.query", definitionVersion: "v1", filterKey: "all", cohortKey: "shop", matchedCount: 2, complete: true } }],
    facts: [factFixture(metricId, value)], nextCursor: null };
}
export function packetFixture(read = readFixture()): EvidencePacket {
  return packetSchema.parse({ version: EVIDENCE_VERSION, packetId: "p.synthetic", requestId: "q.synthetic", scope: scopeFixture(), generatedAt: NOW,
    period: { startDate: "2026-11-06", endDate: "2026-11-06", timeZone: "America/Chicago", cohortKey: "shop", filterKey: "all", comparisonMode: "none" },
    comparison: null, today: null, requiredCapabilities: [read.capabilityId], reads: [read] });
}
export function briefFixture(): CommandCenterBrief {
  return { generatedAt: NOW, period: { date: "2026-11-06", period: "month", startDate: "2026-11-01", endDate: "2026-11-30", timeZone: "America/Chicago", compareStartDate: "2026-10-01", compareEndDate: "2026-10-31" },
    header: { approvalsWaiting: 2, exceptions: 1 },
    kpis: COMMAND_CENTER_KPI_REGISTRY.map((m, i) => ({ ...m, value: m.unit === "money" ? "4860.00" : i === 0 ? 46 : 50,
      previousValue: m.unit === "money" ? "4000.00" : 40, numerator: m.unit === "percent" ? 1 : null, denominator: m.unit === "percent" ? 2 : null,
      detail: null, sources: [{ kind: "job", id: RECORD, label: "J-100", route: `/jobs/${RECORD}`, occurredAt: NOW }], sourcesTruncated: false })),
    needsYou: { counts: { approvals: 2, exceptions: 1 }, items: [{ kind: "suggestion", state: "awaiting_approval", agentProduct: "Revenue", actionId: RECORD,
      actionType: "estimate.followup", version: 12, title: "Synthetic internal title", primaryAction: "approve", occurredAt: NOW, sources: [] }], truncated: false },
    loop: [], crewsToday: [], today: { jobsToday: 2, sources: [] }, emptyStates: { hasAnyData: true, missing: [] },
    limits: { jobsTruncated: false, jobHistoryTruncated: false, actionsTruncated: false } };
}
export function formFixture() { return { templateId: "hvac.inspection", pinnedVersion: "v1", submissionVersion: "v1", status: "reviewed", requiredFields: ["pressure"], answeredFields: ["pressure"], requiredArtifacts: ["photo"], confirmedArtifacts: ["photo"], reviewedPass: true }; }
export function migrationFixture() { return { status: "completed", sourceCount: 10, accepted: 8, rejected: 1, duplicates: 1,
  relationshipsReconciled: true, amountsReconciled: true, unsupportedDisclosed: true, exceptionsAccepted: true, downstreamChanged: false }; }
export function launchFixture() { return { freshStart: false, ownerAccepted: true, requiredGateIds: ["configuration", "migration"], gates: [
  { id: "configuration", mandatory: true, accepted: true, evidenceVersion: "v1", currentVersion: "v1" },
  { id: "migration", mandatory: true, accepted: true, evidenceVersion: "v1", currentVersion: "v1" }] }; }
export function payrollFixture() { return { period: { start: "2026-11-01T05:00:00.000Z", end: "2026-11-08T06:00:00.000Z" }, policyVersion: "synthetic.policy.v1",
  paidActivityKinds: ["on_site", "travel"], inputsVersion: "inputs.v1", exportedInputsVersion: null as string | null,
  entries: [{ id: "time.1", employeeId: "employee.1", jobId: "job.1", interval: { start: "2026-11-06T14:00:00.000Z", end: "2026-11-06T16:00:00.000Z" }, activityKind: "on_site", approval: "approved", rateVersion: "rate.v1" }],
  rates: [{ employeeId: "employee.1", version: "rate.v1", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveUntil: null as string | null, hourlyRate: "30.00" as string | null }] }; }
