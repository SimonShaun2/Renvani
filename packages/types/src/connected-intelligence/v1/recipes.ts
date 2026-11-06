import { z } from "zod";
import { CAPABILITY_IDS, getCapability, type CapabilityId } from "./catalog.js";
import { querySchema, scopeSchema, type EvidenceScope, type InsightQuery, type ReadResult } from "./contracts.js";

export interface QuestionRecipe { id: string; question: string; required: readonly CapabilityId[]; optional: readonly CapabilityId[]; }
export const RECIPES: readonly QuestionRecipe[] = [
  { id: "CI-Q01", question: "What needs my attention today?", required: ["brief", "jobs"], optional: ["estimates", "invoices", "inventory", "forms"] },
  { id: "CI-Q02", question: "Are we on track for the monthly revenue goal?", required: ["goals", "jobs", "invoices"], optional: ["estimates", "inventory", "retention"] },
  { id: "CI-Q03", question: "Why are we busy but making less margin?", required: ["jobs", "costing", "invoices"], optional: ["workforce", "inventory", "retention"] },
  { id: "CI-Q04", question: "Is payroll ready?", required: ["workforce"], optional: [] },
  { id: "CI-Q05", question: "Can we fulfill next week's work?", required: ["jobs", "inventory"], optional: ["purchasing", "forms", "workforce"] },
  { id: "CI-Q06", question: "What should we order?", required: ["jobs", "inventory", "purchasing"], optional: [] },
  { id: "CI-Q07", question: "Why do accounting totals differ?", required: ["invoices", "migration"], optional: [] },
  { id: "CI-Q08", question: "Which customers need follow-up?", required: ["retention", "jobs"], optional: ["forms", "invoices"] },
  { id: "CI-Q09", question: "What blocks job closeout?", required: ["jobs", "forms"], optional: ["invoices", "inventory"] },
  { id: "CI-Q10", question: "Can I trust imported history?", required: ["migration"], optional: [] },
  { id: "CI-Q11", question: "What remains before go-live?", required: ["implementation"], optional: ["migration"] },
  { id: "CI-Q12", question: "Which sources produce fulfillable profitable work?", required: ["attribution", "jobs", "costing"], optional: ["inventory", "retention"] }
];
export const capabilityReadInputSchema = z.object({ capabilityId: z.enum(CAPABILITY_IDS), query: querySchema,
  limit: z.number().int().min(1).max(200), cursor: z.string().max(128).nullable() }).strict().superRefine((x, ctx) => {
    if (x.limit > getCapability(x.capabilityId).maxPageSize) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Source page limit exceeded" });
  });
export interface DomainReader { readonly capabilityId: CapabilityId; read(scope: EvidenceScope, input: z.infer<typeof capabilityReadInputSchema>): Promise<ReadResult>; }
export interface CapabilityReadiness { configured: boolean; validated: boolean; enabled: boolean; }
export interface ReadPlan { recipeId: string; state: "ready" | "partial" | "blocked" | "clarification_required";
  required: CapabilityId[]; selected: CapabilityId[]; unavailable: CapabilityId[]; limits: { maxReads: number; maxPagesPerRead: number }; writes: false; }

/** Does not authenticate or query. Readiness and scope MUST come from trusted server state at C04. */
export function resolveReadPlan(queryInput: unknown, scopeInput: unknown, readiness: Partial<Record<CapabilityId, CapabilityReadiness>>): ReadPlan {
  const query = querySchema.parse(queryInput); const scope = scopeSchema.parse(scopeInput);
  const recipe = RECIPES.find((r) => r.id === query.recipeId);
  if (!recipe) throw new Error("Unsupported recipe");
  const required = [...recipe.required]; let optional = [...recipe.optional];
  if (recipe.id === "CI-Q07") {
    if (!query.accountingConnection) return { recipeId: recipe.id, state: "clarification_required", required, selected: [], unavailable: [], limits: { maxReads: 8, maxPagesPerRead: 10 }, writes: false };
    required.push(query.accountingConnection);
  }
  if (recipe.id === "CI-Q11" && query.freshStart !== true) { required.push("migration"); optional = optional.filter((id) => id !== "migration"); }
  if (recipe.id === "CI-Q11" && query.freshStart === true) optional = optional.filter((id) => id !== "migration");
  const allowed = (id: CapabilityId): boolean => {
    const descriptor = getCapability(id); const r = readiness[id];
    return scope.permissions.includes(descriptor.permission) && scope.sensitivities.includes(descriptor.sensitivity) && r?.configured === true && r.validated === true && r.enabled === true;
  };
  const all = [...new Set([...required, ...optional])];
  const selected = all.filter(allowed); const unavailable = all.filter((id) => !allowed(id));
  return { recipeId: recipe.id, required, selected, unavailable,
    state: required.some((id) => !allowed(id)) ? "blocked" : unavailable.length ? "partial" : "ready",
    limits: { maxReads: 8, maxPagesPerRead: 10 }, writes: false };
}
export function unavailableReader(capabilityId: CapabilityId): DomainReader {
  return { capabilityId, async read(scope, input) {
    scopeSchema.parse(scope); const parsed = capabilityReadInputSchema.parse(input);
    if (parsed.capabilityId !== capabilityId) throw new Error("Reader capability mismatch");
    return { capabilityId, status: "unavailable", reason: "unsupported" };
  } };
}
/** Explicit context-preserving query chips; no language model and no automatic ambiguous intent inference. */
export function questionQuery(recipeId: string, period: InsightQuery["period"]): InsightQuery {
  return querySchema.parse({ recipeId, period, subject: { kind: "company", id: null } });
}
