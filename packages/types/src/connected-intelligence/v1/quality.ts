import { getCapability, getMetric, type CapabilityId } from "./catalog.js";
import { instantSchema, packetSchema, scopeSchema, type EvidenceFact, type EvidencePacket, type EvidencePeriod, type EvidenceScope, type EvidenceSource, type InsightAnswer } from "./contracts.js";

export type Limitation = InsightAnswer["limitations"][number];
const sorted = (items: readonly string[]): string => JSON.stringify([...new Set(items)].sort());
/** Equality of a previously bound scope and CURRENT verified server scope, not a substitute for verification. */
export function sameScope(left: EvidenceScope, right: EvidenceScope): boolean {
  return left.tenantId === right.tenantId && left.actorId === right.actorId && left.scopeKey === right.scopeKey &&
    left.authorizationVersion === right.authorizationVersion && sorted(left.locationIds) === sorted(right.locationIds) &&
    sorted(left.permissions) === sorted(right.permissions) && sorted(left.sensitivities) === sorted(right.sensitivities);
}
export interface SafeEvidenceView {
  packetId: string; generatedAt: string; period: EvidencePeriod | null; comparison: EvidencePeriod | null; today: EvidencePeriod | null;
  facts: EvidenceFact[]; sources: EvidenceSource[]; limited: boolean;
}
export interface EvidenceAssessment { state: InsightAnswer["state"]; canConcludeRequired: boolean; limitations: Limitation[]; view: SafeEvidenceView; }
export type FreshnessPolicy = Partial<Record<CapabilityId, number>>;

/** No tenant IDs, permission lists, denied source IDs/counts, notes or arbitrary URLs leave this projection. */
export function assessEvidence(packetInput: unknown, currentScopeInput: unknown, nowInput: string, maxAgeMs: FreshnessPolicy): EvidenceAssessment {
  const packet = packetSchema.parse(packetInput); const scope = scopeSchema.parse(currentScopeInput);
  const now = Date.parse(instantSchema.parse(nowInput));
  const empty: SafeEvidenceView = { packetId: "unavailable", generatedAt: nowInput, period: null, comparison: null, today: null, facts: [], sources: [], limited: true };
  if (!sameScope(packet.scope, scope)) return { state: "unavailable", canConcludeRequired: false, limitations: ["unavailable_evidence"], view: empty };
  const facts: EvidenceFact[] = []; const sources: EvidenceSource[] = []; const issues = new Set<Limitation>();
  const validRequired = new Set<CapabilityId>();
  const potentiallyVisible = new Set(packet.reads.flatMap((read) => {
    const capability = getCapability(read.capabilityId);
    if (read.status !== "ok" || !scope.permissions.includes(capability.permission) || !scope.sensitivities.includes(capability.sensitivity)) return [];
    const sourceIds = new Set(read.sources.filter((source) => scope.sensitivities.includes(source.sensitivity)).map((source) => source.id));
    return read.facts.filter((fact) => scope.sensitivities.includes(fact.sensitivity) && fact.sourceIds.every((id) => sourceIds.has(id))).map((fact) => fact.id);
  }));
  const blockedDerived = new Set<string>();
  for (const calculation of packet.calculations) {
    if (calculation.verification !== "verified_by_reader" || calculation.inputFactIds.some((id) => blockedDerived.has(id) || !potentiallyVisible.has(id))) blockedDerived.add(calculation.resultFactId);
  }
  if (blockedDerived.size > 0) issues.add("unavailable_evidence");
  for (const read of packet.reads) {
    const descriptor = getCapability(read.capabilityId);
    if (!scope.permissions.includes(descriptor.permission) || !scope.sensitivities.includes(descriptor.sensitivity) || read.status !== "ok") {
      issues.add("unavailable_evidence"); continue;
    }
    const visibleSources = read.sources.filter((s) => scope.sensitivities.includes(s.sensitivity));
    const sourceIds = new Set(visibleSources.map((s) => s.id));
    const visibleFacts = read.facts.filter((f) => !blockedDerived.has(f.id) && scope.sensitivities.includes(f.sensitivity) && f.sourceIds.every((id) => sourceIds.has(id)));
    if (visibleFacts.length !== read.facts.length) issues.add("unavailable_evidence");
    const policy = maxAgeMs[read.capabilityId];
    const age = now - Date.parse(read.asOf);
    const freshnessValid = policy !== undefined && Number.isFinite(policy) && policy >= 0 && age >= 0 && age <= policy &&
      read.quality.freshness === "fresh" && visibleSources.every((s) => Date.parse(s.observedAt) <= Date.parse(read.asOf) && now - Date.parse(s.observedAt) <= policy);
    if (!freshnessValid) issues.add("stale_or_unknown_freshness");
    const complete = read.quality.completeness === "complete" && !read.quality.computationTruncated && read.nextCursor === null &&
      read.sources.every((s) => s.queryManifest === null || s.queryManifest.complete);
    if (!complete) issues.add("limited_coverage");
    const known = visibleFacts.every((f) => f.value !== null);
    if (!known) issues.add("unavailable_evidence");
    if (read.quality.reconciliation === "unreconciled") issues.add("unreconciled");
    if (read.quality.finality === "provisional" || visibleFacts.some((f) => f.finality === "provisional")) issues.add("provisional");
    const resolved = read.quality.reconciliation !== "unreconciled" && read.quality.finality !== "provisional" && visibleFacts.every((f) => f.finality !== "provisional");
    // An empty read cannot establish a required answer. A verified zero must be a cited explicit fact.
    if (complete && freshnessValid && known && resolved && visibleFacts.length > 0 && visibleFacts.length === read.facts.length) validRequired.add(read.capabilityId);
    facts.push(...visibleFacts);
    const used = new Set(visibleFacts.flatMap((f) => f.sourceIds));
    sources.push(...visibleSources.filter((s) => used.has(s.id)));
  }
  const canConcludeRequired = packet.requiredCapabilities.every((id) => validRequired.has(id));
  if (!canConcludeRequired) issues.add("unavailable_evidence");
  const uniqueSources = new Map<string, EvidenceSource>();
  for (const source of sources) {
    const old = uniqueSources.get(source.id);
    if (old && JSON.stringify(old) !== JSON.stringify(source)) throw new Error("Conflicting cross-read source reference");
    uniqueSources.set(source.id, source);
  }
  const state = facts.some((f) => f.value !== null) ? canConcludeRequired && issues.size === 0 ? "complete" : "partial" : "unavailable";
  return { state, canConcludeRequired, limitations: [...issues].sort(),
    view: { packetId: packet.packetId, generatedAt: packet.generatedAt, period: packet.period, comparison: packet.comparison, today: packet.today,
      facts, sources: [...uniqueSources.values()], limited: issues.size > 0 } };
}

export function comparableFacts(a: EvidenceFact, aPeriod: EvidencePeriod, b: EvidenceFact, bPeriod: EvidencePeriod): { compatible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  for (const key of ["metricId", "definitionVersion", "currency", "quantityUnit", "basis", "grain", "unit"] as const) if (a[key] !== b[key]) reasons.push(key);
  if (aPeriod.timeZone !== bPeriod.timeZone) reasons.push("timeZone");
  if (aPeriod.cohortKey !== bPeriod.cohortKey || aPeriod.filterKey !== bPeriod.filterKey) reasons.push("cohort_or_filters");
  if (aPeriod.comparisonMode !== bPeriod.comparisonMode || aPeriod.comparisonMode === "none") reasons.push("comparison_policy");
  if (aPeriod.comparisonMode === "elapsed_aligned") {
    const days = (p: EvidencePeriod): number => (Date.parse(`${p.endDate}T00:00:00Z`) - Date.parse(`${p.startDate}T00:00:00Z`)) / 86400000;
    if (days(aPeriod) !== days(bPeriod)) reasons.push("elapsed_window");
  }
  if (a.value === null || b.value === null) reasons.push("missing_value");
  if (a.finality === "provisional" || b.finality === "provisional") reasons.push("provisional");
  return { compatible: reasons.length === 0, reasons };
}

/** Pure de-duplication: different revisions must be reconciled by their domain, never last-write-wins here. */
export function deduplicateFacts(facts: readonly EvidenceFact[]): EvidenceFact[] {
  const byKey = new Map<string, EvidenceFact>();
  for (const fact of facts) {
    const key = JSON.stringify([fact.metricId, fact.definitionVersion, fact.periodRef, [...fact.sourceIds].sort()]);
    const old = byKey.get(key);
    if (old && (old.value !== fact.value || old.currency !== fact.currency || old.basis !== fact.basis || old.finality !== fact.finality)) throw new Error("Conflicting economic observation");
    if (!old) byKey.set(key, fact);
  }
  return [...byKey.values()];
}

export function safeSourceRoute(source: EvidenceSource): string | null {
  if (!source.entityId) return null;
  const id = encodeURIComponent(source.entityId);
  switch (source.kind) {
    case "booking_request": return `/booking-requests?id=${id}`;
    case "call_record": return `/growth/call-tracking?call=${id}`;
    case "job": return `/jobs/${id}`;
    case "invoice": return `/invoices/${id}`;
    case "customer": return `/customers/${id}`;
    case "agent_action": return `/command-center/approvals?id=${id}`;
    case "maintenance_plan": return `/service-agreements/${id}`;
    case "crew": return `/dispatch?crew=${id}`;
    case "campaign": return `/growth?campaign=${id}`;
    default: return null; // New domain links require a verified route and separate access check in C04.
  }
}
export function safeFactLabel(fact: EvidenceFact): string { return getMetric(fact.metricId)?.label ?? "Unavailable metric"; }

/** Equality for answer/report parity, not a persisted cache authorization mechanism. */
export function reportParity(aInput: unknown, bInput: unknown): "equal" | "different_values" | "different_snapshot" {
  const a = packetSchema.parse(aInput); const b = packetSchema.parse(bInput);
  const signature = (p: EvidencePacket): string => JSON.stringify({ scope: { ...p.scope, permissions: [...p.scope.permissions].sort(), sensitivities: [...p.scope.sensitivities].sort(), locationIds: [...p.scope.locationIds].sort() },
    generatedAt: p.generatedAt, period: p.period, comparison: p.comparison, today: p.today, calculations: p.calculations, required: [...p.requiredCapabilities].sort(),
    reads: [...p.reads].sort((l, r) => l.capabilityId.localeCompare(r.capabilityId)).map((r) => r.status !== "ok" ? r : ({ capabilityId: r.capabilityId, status: r.status, asOf: r.asOf, quality: r.quality, nextCursor: r.nextCursor,
      sources: [...r.sources].sort((l, s) => l.id.localeCompare(s.id)), facts: [...r.facts].sort((l, f) => l.id.localeCompare(f.id)).map((fact) => ({ ...fact, value: null, sourceIds: [...fact.sourceIds].sort() })) })) });
  if (signature(a) !== signature(b)) return "different_snapshot";
  const values = (p: EvidencePacket): string => JSON.stringify(p.reads.flatMap((r) => r.status === "ok" ? r.facts.map((f) => [f.id, f.value]) : []).sort((l, r) => String(l[0]).localeCompare(String(r[0]))));
  return values(a) === values(b) ? "equal" : "different_values";
}
