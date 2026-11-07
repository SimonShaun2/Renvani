import { z } from "zod";
import { instantSchema, scopeSchema, type EvidenceScope } from "./contracts.js";
import { sameScope } from "./quality.js";

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
export const attentionObservationSchema = z.object({ eventId: id, situationId: id, issueId: id,
  tenantId: z.string().uuid(), observedAt: instantSchema, status: z.enum(["open", "verified_resolved", "suggested_fix"]),
  severity: z.enum(["routine", "important", "critical"]), evidenceIds: z.array(id).min(1).max(30), fresh: z.boolean() }).strict();
export interface AttentionSituation { situationId: string; status: "open" | "unverified" | "resolved" | "snoozed";
  severity: "routine" | "important" | "critical"; issueIds: string[]; evidenceIds: string[]; observedAt: string; }
export interface AttentionPolicy { maxAgeMs: number; policyVersion: string; allowCriticalSnooze: boolean; }
/** Caller must supply an authorized COMPLETE snapshot of issue observations, not a partial event stream. */
export function groupAttention(input: readonly unknown[], currentScopeInput: unknown, capturedScopeInput: unknown,
  now: string, policy: AttentionPolicy, completeSnapshot: boolean, snoozedUntil: Readonly<Record<string, string>> = {}): AttentionSituation[] {
  const current = scopeSchema.parse(currentScopeInput); const captured = scopeSchema.parse(capturedScopeInput);
  if (!sameScope(current, captured)) return [];
  const at = Date.parse(instantSchema.parse(now));
  if (!Number.isFinite(policy.maxAgeMs) || policy.maxAgeMs < 0 || !policy.policyVersion) throw new Error("Reviewed attention policy required");
  const observations = input.map((value) => attentionObservationSchema.parse(value));
  if (observations.some((o) => o.tenantId !== current.tenantId)) throw new Error("Scope mismatch");
  const uniqueEvents = new Map<string, z.infer<typeof attentionObservationSchema>>();
  for (const observation of observations) {
    const prior = uniqueEvents.get(observation.eventId);
    if (prior && JSON.stringify(prior) !== JSON.stringify(observation)) throw new Error("Conflicting event replay");
    uniqueEvents.set(observation.eventId, observation);
  }
  const issues = new Map<string, z.infer<typeof attentionObservationSchema>>();
  for (const observation of uniqueEvents.values()) {
    if (observation.status === "suggested_fix") continue;
    const key = JSON.stringify([observation.situationId, observation.issueId]); const prior = issues.get(key);
    if (!prior || Date.parse(observation.observedAt) > Date.parse(prior.observedAt)) issues.set(key, observation);
    else if (prior.observedAt === observation.observedAt && prior.status !== observation.status) throw new Error("Ambiguous issue revision");
  }
  const groups = new Map<string, z.infer<typeof attentionObservationSchema>[]>();
  for (const observation of issues.values()) groups.set(observation.situationId, [...(groups.get(observation.situationId) ?? []), observation]);
  const rank = { routine: 0, important: 1, critical: 2 } as const;
  return [...groups].map(([situationId, rows]): AttentionSituation => {
    const fresh = rows.every((r) => r.fresh && at >= Date.parse(r.observedAt) && at - Date.parse(r.observedAt) <= policy.maxAgeMs);
    const resolved = completeSnapshot && fresh && rows.every((r) => r.status === "verified_resolved");
    const until = snoozedUntil[situationId]; const snoozed = until !== undefined && Date.parse(instantSchema.parse(until)) > at;
    const severity = rows.reduce<AttentionSituation["severity"]>((value, r) => rank[r.severity] > rank[value] ? r.severity : value, "routine");
    return { situationId, status: resolved ? "resolved" : !fresh || !completeSnapshot ? "unverified" : snoozed && (severity !== "critical" || policy.allowCriticalSnooze) ? "snoozed" : "open",
      severity, issueIds: rows.map((r) => r.issueId).sort(), evidenceIds: [...new Set(rows.flatMap((r) => r.evidenceIds))].sort(),
      observedAt: rows.map((r) => r.observedAt).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? now };
  }).sort((a, b) => rank[b.severity] - rank[a.severity] || a.situationId.localeCompare(b.situationId));
}
/** A data/permission change requires a new evaluation, not reuse of a stored privileged answer. */
export function canReuseScope(captured: EvidenceScope, current: EvidenceScope): boolean { return sameScope(captured, current); }
