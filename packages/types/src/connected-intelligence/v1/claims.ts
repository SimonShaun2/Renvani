import { EVIDENCE_VERSION } from "./catalog.js";
import { answerSchema, claimSchema, type InsightAnswer, type NarrativeClaim } from "./contracts.js";
import { safeFactLabel, type EvidenceAssessment } from "./quality.js";

export interface ClaimValidation { valid: boolean; errors: string[]; claims: NarrativeClaim[]; }
/** Structural/numeric grounding only. A model's unrestricted prose is never treated as verified by this helper. */
export function validateClaims(input: readonly unknown[], assessment: EvidenceAssessment): ClaimValidation {
  const facts = new Map(assessment.view.facts.map((f) => [f.id, f]));
  const claims: NarrativeClaim[] = []; const errors: string[] = []; const seen = new Set<string>();
  if (input.length > 100) return { valid: false, errors: ["claim_limit"], claims: [] };
  for (const item of input) {
    const parsed = claimSchema.safeParse(item);
    if (!parsed.success) { errors.push("invalid_shape"); continue; }
    const c = parsed.data;
    if (seen.has(c.id)) errors.push("duplicate_claim");
    seen.add(c.id);
    if (c.factIds.some((id) => !facts.has(id))) errors.push("unbound_fact");
    if (c.assertedValues.some((v) => !c.factIds.includes(v.factId) || !facts.has(v.factId) || facts.get(v.factId)?.value !== v.value)) errors.push("unverified_value");
    if (new Set(c.assertedValues.map((v) => v.factId)).size !== c.assertedValues.length) errors.push("duplicate_assertion");
    if (c.kind === "forecast") errors.push("forecast_capability_not_accepted");
    if (c.kind === "fact" && (c.template !== "fact_value" || !["observed", "provisional"].includes(c.strength) || c.factIds.length !== 1 || c.assertedValues.length !== 1)) errors.push("invalid_fact_claim");
    if (c.kind === "association" && (c.template !== "observed_together" || c.strength !== "observed" || c.factIds.length < 2)) errors.push("invalid_association");
    if (c.kind === "hypothesis" && (c.template !== "needs_investigation" || c.strength !== "possible")) errors.push("invalid_hypothesis");
    if (c.kind === "recommendation" && (c.template !== "review_records" || c.strength !== "suggested")) errors.push("invalid_recommendation");
    if (c.strength === "observed" && c.factIds.some((id) => facts.get(id)?.value === null || facts.get(id)?.finality === "provisional")) errors.push("overstated_finality");
    if (assessment.state === "unavailable") errors.push("unavailable_evidence");
    claims.push(c);
  }
  return errors.length ? { valid: false, errors: [...new Set(errors)], claims: [] } : { valid: true, errors: [], claims };
}

export function factualFallback(assessment: EvidenceAssessment, invalidNarrative = false): InsightAnswer {
  const limitations = [...assessment.limitations];
  if (invalidNarrative && !limitations.includes("invalid_narrative")) limitations.push("invalid_narrative");
  if (assessment.view.facts.filter((fact) => fact.value !== null).length > 100) limitations.push("display_truncated");
  return answerSchema.parse({ version: EVIDENCE_VERSION, packetId: assessment.view.packetId, state: assessment.state,
    claims: assessment.view.facts.filter((f) => f.value !== null).slice(0, 100).map((f, i): NarrativeClaim => ({
      id: `fallback.${i}`, kind: "fact", factIds: [f.id], assertedValues: [{ factId: f.id, value: f.value }],
      strength: f.finality === "provisional" ? "provisional" : "observed", template: "fact_value", effect: "none"
    })), limitations, nextStep: assessment.state === "complete" ? "inspect_sources" : assessment.state === "partial" ? "refresh_or_review" : "verify_access_or_sources", writesPerformed: false });
}

export function composeAnswer(claims: readonly unknown[], assessment: EvidenceAssessment): InsightAnswer {
  const validation = validateClaims(claims, assessment);
  if (!validation.valid || validation.claims.length === 0) return factualFallback(assessment, claims.length > 0);
  return answerSchema.parse({ version: EVIDENCE_VERSION, packetId: assessment.view.packetId, state: assessment.state,
    claims: validation.claims, limitations: assessment.limitations,
    nextStep: assessment.state === "complete" ? "inspect_sources" : "refresh_or_review", writesPerformed: false });
}

/** Fixed templates use only registered labels and typed numeric facts; no source note is executed or interpolated. */
export function renderClaim(claim: NarrativeClaim, assessment: EvidenceAssessment): string {
  const result = validateClaims([claim], assessment);
  if (!result.valid) throw new Error("Unsupported claim");
  const fact = assessment.view.facts.find((f) => f.id === claim.factIds[0]);
  if (!fact) throw new Error("Missing fact");
  switch (claim.template) {
    case "fact_value": return `${safeFactLabel(fact)}: ${fact.value ?? "unavailable"}${fact.currency ? ` ${fact.currency}` : fact.quantityUnit ? ` ${fact.quantityUnit}` : fact.unit === "percent" ? "%" : ""}${fact.finality === "provisional" ? " (provisional)" : ""}.`;
    case "observed_together": return "These observations are present in the selected evidence; this does not establish causation.";
    case "needs_investigation": return "These records warrant investigation; a cause has not been established.";
    case "review_records": return "Review the supporting records. No action has been executed.";
    default: throw new Error("Forecast explanation unavailable");
  }
}
