import { z } from "zod";
import { instantSchema, moneySchema } from "./contracts.js";

const token = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
const interval = z.object({ start: instantSchema, end: instantSchema }).strict().refine((v) => Date.parse(v.start) < Date.parse(v.end), "Positive interval required");
export const payInputsSchema = z.object({ period: interval, policyVersion: token, paidActivityKinds: z.array(token).min(1).max(20), unpaidActivityKinds: z.array(token).max(20),
  inputsVersion: token, exportedInputsVersion: token.nullable(),
  entries: z.array(z.object({ id: token, employeeId: token, jobId: token.nullable(), interval,
    activityKind: token, approval: z.enum(["approved", "pending", "rejected"]), rateVersion: token.nullable() }).strict()).max(500),
  rates: z.array(z.object({ employeeId: token, version: token, effectiveFrom: instantSchema, effectiveUntil: instantSchema.nullable(), hourlyRate: moneySchema.refine((rate) => !rate.startsWith("-"), "Base rate must be nonnegative").nullable() }).strict()).max(500)
}).strict();
/** Eligibility/correctness diagnostics for supplied synthetic/authorized inputs, not payroll calculation or legal policy. */
export function payInputReadiness(input: unknown): { ready: boolean; requiresAmendment: boolean; blockers: string[] } {
  const data = payInputsSchema.parse(input); const blockers = new Set<string>();
  if (new Set(data.entries.map((e) => e.id)).size !== data.entries.length) blockers.add("duplicate_time_entry");
  const versions = data.rates.map((r) => JSON.stringify([r.employeeId, r.version]));
  if (new Set(versions).size !== versions.length) blockers.add("duplicate_rate_version");
  if (data.paidActivityKinds.some((kind) => data.unpaidActivityKinds.includes(kind))) blockers.add("ambiguous_activity_policy");
  const byEmployee = new Map<string, (typeof data.entries)[number][]>();
  for (const entry of data.entries) {
    const start = Date.parse(entry.interval.start); const end = Date.parse(entry.interval.end);
    if (start < Date.parse(data.period.start) || end > Date.parse(data.period.end)) blockers.add("time_outside_period_requires_split");
    if (!data.paidActivityKinds.includes(entry.activityKind) && !data.unpaidActivityKinds.includes(entry.activityKind)) blockers.add("unknown_activity_policy");
    if (entry.approval !== "approved") blockers.add("time_not_approved");
    if (data.paidActivityKinds.includes(entry.activityKind)) {
      const rate = data.rates.find((r) => r.employeeId === entry.employeeId && r.version === entry.rateVersion);
      if (!rate || rate.hourlyRate === null) blockers.add("required_rate_missing");
      else if (Date.parse(rate.effectiveFrom) > start || (rate.effectiveUntil !== null && Date.parse(rate.effectiveUntil) < end)) blockers.add("effective_rate_requires_split");
    }
    byEmployee.set(entry.employeeId, [...(byEmployee.get(entry.employeeId) ?? []), entry]);
  }
  for (const entries of byEmployee.values()) {
    const ordered = [...entries].sort((a, b) => Date.parse(a.interval.start) - Date.parse(b.interval.start));
    let end = -Infinity;
    for (const entry of ordered) { if (Date.parse(entry.interval.start) < end) blockers.add("overlapping_time"); end = Math.max(end, Date.parse(entry.interval.end)); }
  }
  const requiresAmendment = data.exportedInputsVersion !== null && data.exportedInputsVersion !== data.inputsVersion;
  if (requiresAmendment) blockers.add("exported_inputs_require_amendment");
  return { ready: blockers.size === 0, requiresAmendment, blockers: [...blockers].sort() };
}
