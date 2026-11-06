import type { CommandCenterBrief, CommandCenterSource } from "../../command-center.types.js";
import { EVIDENCE_VERSION, getMetric } from "./catalog.js";
import { packetSchema, scopeSchema, type EvidenceFact, type EvidencePacket, type EvidenceScope, type EvidenceSource } from "./contracts.js";

export interface AdaptedBrief {
  packet: EvidencePacket;
  /** Internal compatibility snapshot only. It contains legacy text and MUST NOT be sent to a model as verified instructions. */
  legacySnapshot: CommandCenterBrief;
  reviewItems: { actionId: string; expectedVersion: number; state: string; reviewRoute: string }[];
  displayTruncated: boolean;
}
function valueString(value: string | number | null, money: boolean): string | null {
  if (value === null) return null;
  if (money && typeof value !== "string") throw new Error("Legacy money must be a decimal string");
  if (typeof value === "number" && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)) throw new Error("Invalid legacy number");
  return String(value);
}
/** Pure compatibility adapter. Its caller must obtain the brief with the same authenticated owner/admin scope. */
export function adaptCommandCenterBrief(brief: CommandCenterBrief, scopeInput: EvidenceScope, currency: string): AdaptedBrief {
  const scope = scopeSchema.parse(scopeInput);
  const suffix = brief.generatedAt.replace(/[^0-9]/gu, "");
  const sourceMap = new Map<string, EvidenceSource>();
  const sourcesFor = (items: CommandCenterSource[], queryKey: string, complete: boolean): string[] => {
    const manifestId = `legacy.query.${queryKey}`;
    sourceMap.set(manifestId, { id: manifestId, kind: "query_manifest", entityId: null, recordVersion: `snapshot.${suffix}`,
      observedAt: brief.generatedAt, effectiveAt: null, sensitivity: "operational", origin: "aggregate", importBatchId: null,
      queryManifest: { queryId: `command_center_brief.${queryKey}`, definitionVersion: "legacy.v1", filterKey: "legacy.default", cohortKey: "legacy.company", matchedCount: null, complete } });
    const ids = [manifestId];
    for (const source of items) {
      const id = `legacy.ref.${source.kind}.${source.id}`;
      sourceMap.set(id, { id, kind: source.kind, entityId: source.id, recordVersion: "legacy.row_version_unavailable",
        observedAt: brief.generatedAt, effectiveAt: source.occurredAt, sensitivity: "operational", origin: "unknown", importBatchId: null, queryManifest: null });
      ids.push(id);
    }
    return [...new Set(ids)];
  };
  const computationalCap = brief.limits.jobsTruncated || brief.limits.jobHistoryTruncated || brief.limits.actionsTruncated;
  const facts: EvidenceFact[] = [];
  const makeFact = (metricId: string, value: string | number | null, sourceIds: string[], periodRef: "current" | "comparison" | "today", displayTruncated: boolean): EvidenceFact => {
    const metric = getMetric(metricId); if (!metric) throw new Error("Unknown legacy metric");
    return { id: `${metricId}.${periodRef}`, metricId, definitionVersion: metric.version, unit: metric.unit,
      value: valueString(value, metric.unit === "money"), currency: metric.unit === "money" ? currency : null, quantityUnit: null,
      basis: metric.basis, grain: metric.grain, sensitivity: metric.sensitivity, sourceIds, periodRef,
      finality: "not_applicable", displaySourcesTruncated: displayTruncated };
  };
  for (const kpi of brief.kpis) {
    const metric = getMetric(`legacy.${kpi.key}`);
    if (!metric || metric.formula !== kpi.definition || metric.unit !== kpi.unit) throw new Error("Legacy definition drift requires review");
    facts.push(makeFact(metric.id, kpi.value, sourcesFor(kpi.sources, `${kpi.key}.current`, !computationalCap), "current", kpi.sourcesTruncated));
    // v1 does not expose previous-period source rows. A manifest retains the reader/basis, not invented row IDs.
    facts.push(makeFact(metric.id, kpi.previousValue, sourcesFor([], `${kpi.key}.comparison`, !computationalCap), "comparison", true));
  }
  facts.push(makeFact("attention.approvals", brief.header.approvalsWaiting, sourcesFor([], "approvals", !brief.limits.actionsTruncated), "current", brief.needsYou.truncated));
  facts.push(makeFact("attention.exceptions", brief.header.exceptions, sourcesFor([], "exceptions", !brief.limits.actionsTruncated), "current", brief.needsYou.truncated));
  // Daily jobs retain their own grain/basis, rather than becoming a monthly financial observation.
  facts.push(makeFact("jobs.today", brief.today.jobsToday, sourcesFor(brief.today.sources, "jobs_today", !brief.limits.jobsTruncated), "today", false));
  const period = { startDate: brief.period.startDate, endDate: brief.period.endDate, timeZone: brief.period.timeZone,
    cohortKey: "legacy.company", filterKey: "legacy.default", comparisonMode: "complete_periods" as const };
  const dateParts = new Intl.DateTimeFormat("en-CA", { timeZone: brief.period.timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(brief.generatedAt));
  const localDay = ["year", "month", "day"].map((type) => dateParts.find((part) => part.type === type)?.value ?? "").join("-");
  const packet = packetSchema.parse({ version: EVIDENCE_VERSION, packetId: `legacy.${suffix}`, requestId: `legacy.request.${suffix}`,
    scope, generatedAt: brief.generatedAt, period, today: { ...period, startDate: localDay, endDate: localDay, comparisonMode: "none" },
    comparison: { ...period, startDate: brief.period.compareStartDate, endDate: brief.period.compareEndDate }, requiredCapabilities: ["brief"],
    reads: [{ scopeBinding: { tenantId: scope.tenantId, actorId: scope.actorId, scopeKey: scope.scopeKey, authorizationVersion: scope.authorizationVersion }, capabilityId: "brief", status: "ok", asOf: brief.generatedAt,
      quality: { completeness: computationalCap ? "partial" : "complete", freshness: "fresh", reconciliation: "not_applicable", finality: "not_applicable", computationTruncated: computationalCap },
      sources: [...sourceMap.values()], facts, nextCursor: null }] });
  return { packet, legacySnapshot: structuredClone(brief),
    reviewItems: brief.needsYou.items.map((item) => ({ actionId: item.actionId, expectedVersion: item.version, state: item.state,
      reviewRoute: `/command-center/approvals?id=${encodeURIComponent(item.actionId)}` })),
    displayTruncated: brief.needsYou.truncated || brief.kpis.some((k) => k.sourcesTruncated) || brief.loop.some((l) => l.sourcesTruncated) };
}
