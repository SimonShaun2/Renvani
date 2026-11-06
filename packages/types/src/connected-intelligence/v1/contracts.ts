import { z } from "zod";
import { CAPABILITY_IDS, EVIDENCE_VERSION, SENSITIVITIES, getMetric } from "./catalog.js";

const token = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
export const moneySchema = z.string().regex(/^-?(?:0|[1-9]\d{0,15})\.\d{2}$/u).refine((s) => s !== "-0.00", "Negative zero is not canonical");
export const decimalSchema = z.string().regex(/^-?(?:0|[1-9]\d{0,15})(?:\.\d{1,6})?$/u);
export const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u).refine((s) => {
  const d = new Date(`${s}T00:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === s;
});
export const instantSchema = z.string().datetime({ offset: true });
export const zoneSchema = z.string().min(1).max(64).refine((s) => { try { new Intl.DateTimeFormat("en", { timeZone: s }); return true; } catch { return false; } });
export const periodSchema = z.object({ startDate: localDateSchema, endDate: localDateSchema, timeZone: zoneSchema,
  cohortKey: token, filterKey: token, comparisonMode: z.enum(["none", "elapsed_aligned", "complete_periods"]) }).strict()
  .refine((p) => p.startDate <= p.endDate, "Period is reversed");
/** Shape validation is NOT authentication. Only C04 may construct this from its verified current server identity. */
export const scopeSchema = z.object({ tenantId: z.string().uuid(), actorId: z.string().uuid(), scopeKey: token, authorizationVersion: token,
  locationIds: z.array(z.string().uuid()).max(100), permissions: z.array(token).max(100), sensitivities: z.array(z.enum(SENSITIVITIES)).max(5) }).strict();
export const querySchema = z.object({ recipeId: z.string().regex(/^CI-Q(?:0[1-9]|1[0-2])$/u), period: periodSchema,
  subject: z.object({ kind: z.enum(["company", "job", "customer", "pay_period", "import", "implementation"]), id: z.string().uuid().nullable() }).strict(),
  accountingConnection: z.enum(["qbo", "qbd"]).optional(), freshStart: z.boolean().optional() }).strict();
export const qualitySchema = z.object({ completeness: z.enum(["complete", "partial", "unknown"]),
  freshness: z.enum(["fresh", "stale", "unknown"]), reconciliation: z.enum(["reconciled", "unreconciled", "not_applicable"]),
  finality: z.enum(["final", "provisional", "not_applicable"]), computationTruncated: z.boolean() }).strict();
export const SOURCE_KINDS = ["booking_request", "call_record", "job", "invoice", "customer", "agent_action", "maintenance_plan", "crew", "campaign", "time_entry", "timesheet", "stock_level", "stock_movement", "purchase_order", "cost_posting", "form_submission", "import_batch", "implementation", "query_manifest"] as const;
export const sourceSchema = z.object({ id: token, kind: z.enum(SOURCE_KINDS), entityId: z.string().uuid().nullable(),
  recordVersion: token, observedAt: instantSchema, effectiveAt: instantSchema.nullable(),
  sensitivity: z.enum(SENSITIVITIES), origin: z.enum(["native", "imported", "aggregate"]), importBatchId: z.string().uuid().nullable(),
  queryManifest: z.object({ queryId: token, definitionVersion: token, filterKey: token, cohortKey: token,
    matchedCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), complete: z.boolean() }).strict().nullable() }).strict().superRefine((s, ctx) => {
    if ((s.kind === "query_manifest") !== (s.queryManifest !== null)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Manifest reference mismatch" });
    if (s.kind !== "query_manifest" && s.entityId === null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Record identity required" });
    if (s.origin === "imported" && !s.importBatchId) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Imported lineage required" });
  });
export const factSchema = z.object({ id: token, metricId: token, definitionVersion: token, value: decimalSchema.nullable(),
  unit: z.enum(["count", "money", "percent", "quantity"]), currency: z.string().regex(/^[A-Z]{3}$/u).nullable(),
  quantityUnit: token.nullable(), basis: token, grain: token, sensitivity: z.enum(SENSITIVITIES), sourceIds: z.array(token).min(1).max(500),
  periodRef: z.enum(["current", "comparison"]), finality: z.enum(["final", "provisional", "not_applicable"]),
  displaySourcesTruncated: z.boolean() }).strict().superRefine((f, ctx) => {
    const m = getMetric(f.metricId);
    if (!m || m.version !== f.definitionVersion || m.unit !== f.unit || m.basis !== f.basis || m.grain !== f.grain || m.sensitivity !== f.sensitivity)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unknown or incompatible metric contract" });
    if (f.unit === "money" && (f.currency === null || (f.value !== null && !moneySchema.safeParse(f.value).success)))
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Money requires canonical amount and currency" });
    if (f.unit !== "money" && f.currency !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unexpected currency" });
    if ((f.unit === "quantity") !== (f.quantityUnit !== null)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quantity unit mismatch" });
    if (f.unit === "count" && f.value !== null && !/^(?:0|[1-9]\d*)$/u.test(f.value)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Count must be nonnegative integer" });
  });
const successfulRead = z.object({ capabilityId: z.enum(CAPABILITY_IDS), status: z.literal("ok"), asOf: instantSchema,
  quality: qualitySchema, sources: z.array(sourceSchema).max(2000), facts: z.array(factSchema).max(500),
  nextCursor: token.nullable() }).strict().superRefine((r, ctx) => {
    const ids = new Set(r.sources.map((s) => s.id));
    if (ids.size !== r.sources.length || new Set(r.facts.map((f) => f.id)).size !== r.facts.length)
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate evidence IDs" });
    for (const f of r.facts) if (f.sourceIds.some((id) => !ids.has(id))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unbound source reference" });
    if (r.quality.completeness === "complete" && (r.nextCursor !== null || r.quality.computationTruncated)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Incomplete traversal cannot claim completeness" });
    if (r.quality.finality === "final" && r.facts.some((f) => f.value === null || f.finality === "provisional")) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Incomplete facts cannot be final" });
  });
const deniedRead = z.object({ capabilityId: z.enum(CAPABILITY_IDS), status: z.literal("denied") }).strict();
const unavailableRead = z.object({ capabilityId: z.enum(CAPABILITY_IDS), status: z.literal("unavailable"),
  reason: z.enum(["unsupported", "not_configured", "not_validated", "timeout", "source_failed", "missing_policy"]) }).strict();
export const readResultSchema = z.union([successfulRead, deniedRead, unavailableRead]);
export const packetSchema = z.object({ version: z.literal(EVIDENCE_VERSION), packetId: token, requestId: token, scope: scopeSchema,
  generatedAt: instantSchema, period: periodSchema, comparison: periodSchema.nullable(),
  requiredCapabilities: z.array(z.enum(CAPABILITY_IDS)).min(1).max(16), reads: z.array(readResultSchema).max(16) }).strict().superRefine((p, ctx) => {
    if (new Set(p.reads.map((r) => r.capabilityId)).size !== p.reads.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate capability read" });
    const facts = p.reads.flatMap((r) => r.status === "ok" ? r.facts : []);
    if (new Set(facts.map((f) => f.id)).size !== facts.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Duplicate cross-read fact ID" });
    if (!p.comparison && facts.some((f) => f.periodRef === "comparison")) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Unbound comparison period" });
    for (const r of p.reads) if (r.status === "ok" && Date.parse(r.asOf) > Date.parse(p.generatedAt)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source cutoff after generation" });
  });
/** A verifier accepts structured claims, not arbitrary prose that merely contains a citation. */
export const claimSchema = z.object({ id: token, kind: z.enum(["fact", "association", "hypothesis", "forecast", "recommendation"]),
  factIds: z.array(token).min(1).max(20), assertedValues: z.array(z.object({ factId: token, value: decimalSchema.nullable() }).strict()).max(20),
  strength: z.enum(["observed", "provisional", "possible", "predicted", "suggested"]),
  template: z.enum(["fact_value", "observed_together", "needs_investigation", "review_records", "forecast_unavailable"]),
  effect: z.literal("none") }).strict();
export const proposalReferenceSchema = z.object({ proposalId: token, actionType: token, evidencePacketId: token,
  policyVersion: token, expectedVersion: token, requiredPermission: token, state: z.literal("proposed"), executable: z.literal(false) }).strict();
export const answerSchema = z.object({ version: z.literal(EVIDENCE_VERSION), packetId: token,
  state: z.enum(["complete", "partial", "unavailable"]), claims: z.array(claimSchema).max(100),
  limitations: z.array(z.enum(["limited_coverage", "stale_or_unknown_freshness", "unreconciled", "provisional", "unavailable_evidence", "invalid_narrative"])).max(6),
  nextStep: z.enum(["inspect_sources", "refresh_or_review", "verify_access_or_sources"]), writesPerformed: z.literal(false) }).strict();
export type EvidenceScope = z.infer<typeof scopeSchema>;
export type InsightQuery = z.infer<typeof querySchema>;
export type EvidencePeriod = z.infer<typeof periodSchema>;
export type EvidenceFact = z.infer<typeof factSchema>;
export type EvidenceSource = z.infer<typeof sourceSchema>;
export type ReadResult = z.infer<typeof readResultSchema>;
export type EvidencePacket = z.infer<typeof packetSchema>;
export type NarrativeClaim = z.infer<typeof claimSchema>;
export type InsightAnswer = z.infer<typeof answerSchema>;
