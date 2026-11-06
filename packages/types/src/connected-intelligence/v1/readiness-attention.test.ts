import { describe, expect, it } from "vitest";
import { formReadiness, launchReadiness, migrationReadiness } from "./readiness.js";
import { payInputReadiness } from "./workforce.js";
import { groupAttention } from "./attention.js";
import { NOW, TENANT, formFixture, launchFixture, migrationFixture, payrollFixture, scopeFixture } from "../../../test-fixtures/connected-intelligence.js";

const policy = { maxAgeMs: 60000, policyVersion: "synthetic.v1", allowCriticalSnooze: false };
const event = () => ({ eventId: "event.1", situationId: "job.1", issueId: "material.1", tenantId: TENANT, observedAt: NOW, status: "open", severity: "important", evidenceIds: ["source.1"], fresh: true });
describe("RCI H10 workforce fixtures", () => {
  it("accepts approved inputs but does not claim paid/net-pay result", () => expect(payInputReadiness(payrollFixture())).toEqual({ ready: true, requiresAmendment: false, blockers: [] }));
  it("missing rates block complete preparation", () => { const f = payrollFixture(); f.rates[0]!.hourlyRate = null; expect(payInputReadiness(f).blockers).toContain("required_rate_missing"); });
  it("rate change during an entry requires explicit splitting", () => { const f = payrollFixture(); f.rates[0]!.effectiveUntil = "2026-11-06T15:00:00.000Z"; expect(payInputReadiness(f).blockers).toContain("effective_rate_requires_split"); });
  it("approved entry cannot silently use a different rate version", () => { const f = payrollFixture(); f.entries[0]!.rateVersion = "rate.v2"; expect(payInputReadiness(f).ready).toBe(false); });
  it("overlapping time cannot count twice across jobs", () => { const f = payrollFixture(); f.entries.push({ ...f.entries[0]!, id: "time.2", jobId: "job.2" }); expect(payInputReadiness(f).blockers).toContain("overlapping_time"); });
  it("unapproved time and post-export correction remain exceptions", () => { const f = payrollFixture(); f.entries[0]!.approval = "pending"; f.exportedInputsVersion = "inputs.v0"; expect(payInputReadiness(f).requiresAmendment).toBe(true); expect(payInputReadiness(f).blockers).toContain("time_not_approved"); });
  it("period-spanning time requires an explicit split", () => { const f = payrollFixture(); f.entries[0]!.interval.end = "2026-11-09T00:00:00.000Z"; expect(payInputReadiness(f).blockers).toContain("time_outside_period_requires_split"); });
  it("paid activity is supplied policy, not a universal break assumption", () => { const f = payrollFixture(); f.entries[0]!.activityKind = "break"; f.rates[0]!.hourlyRate = null; expect(payInputReadiness(f).ready).toBe(true); f.paidActivityKinds.push("break"); expect(payInputReadiness(f).ready).toBe(false); });
});
describe("RCI H11 field, import and launch contracts", () => {
  it("accepts reviewed pinned form with confirmed artifacts", () => expect(formReadiness(formFixture()).ready).toBe(true));
  it("later template edits do not make an old pinned submission wrong", () => { const f = formFixture(); expect(formReadiness(f).ready).toBe(true); expect(formReadiness({ ...f, submissionVersion: "v2" }).blockers).toContain("template_version_conflict"); });
  it.each(["requiredFields", "requiredArtifacts"])("unmet %s blocks closeout", (field) => { const f = formFixture(); const changed = field === "requiredFields" ? { ...f, answeredFields: [] } : { ...f, confirmedArtifacts: [] }; expect(formReadiness(changed).ready).toBe(false); });
  it("failed/returned inspection cannot appear complete", () => expect(formReadiness({ ...formFixture(), reviewedPass: false, status: "returned" }).ready).toBe(false));
  it("reconciles source/accepted/rejected/duplicate counts", () => { expect(migrationReadiness(migrationFixture()).accepted).toBe(true); expect(migrationReadiness({ ...migrationFixture(), accepted: 9 }).blockers).toContain("count_mismatch"); });
  it("CI-A24 committing and unreconciled imports are not accepted", () => { expect(migrationReadiness({ ...migrationFixture(), status: "committing" }).accepted).toBe(false); expect(migrationReadiness({ ...migrationFixture(), amountsReconciled: false }).accepted).toBe(false); });
  it("downstream use prevents isolated rollback eligibility", () => expect(migrationReadiness({ ...migrationFixture(), downstreamChanged: true }).rollbackEligibleForReview).toBe(false));
  it("fresh-start may omit only the migration requirement", () => { const f = launchFixture(); f.freshStart = true; f.gates = f.gates.filter((g) => g.id !== "migration"); expect(launchReadiness(f).ready).toBe(true); f.gates = []; expect(launchReadiness(f).ready).toBe(false); });
  it("stale configuration and absent owner acceptance block launch", () => { const f = launchFixture(); f.gates[0]!.currentVersion = "v2"; expect(launchReadiness(f).blockers).toContain("configuration"); expect(launchReadiness({ ...launchFixture(), ownerAccepted: false }).ready).toBe(false); });
  it("missing mandatory gate cannot be concealed by omitting it", () => { const f = launchFixture(); f.gates = f.gates.filter((g) => g.id !== "configuration"); expect(launchReadiness(f).blockers).toContain("missing_requirement:configuration"); });
});
describe("RCI H13 situation grouping", () => {
  it("CI-A23 deduplicates repeated events and groups related issues", () => { const e = event(); const rows = groupAttention([e, e, { ...e, eventId: "event.2", issueId: "form.1" }], scopeFixture(), scopeFixture(), NOW, policy, true); expect(rows).toHaveLength(1); expect(rows[0]?.issueIds).toHaveLength(2); expect(rows[0]?.status).toBe("open"); });
  it("a proposed fix cannot resolve the issue", () => { const e = event(); const rows = groupAttention([e, { ...e, eventId: "suggestion", status: "suggested_fix" }], scopeFixture(), scopeFixture(), NOW, policy, true); expect(rows[0]?.status).toBe("open"); });
  it("only complete fresh observed recovery resolves", () => { const e = { ...event(), status: "verified_resolved" }; expect(groupAttention([e], scopeFixture(), scopeFixture(), NOW, policy, true)[0]?.status).toBe("resolved"); expect(groupAttention([e], scopeFixture(), scopeFixture(), NOW, policy, false)[0]?.status).toBe("unverified"); expect(groupAttention([{ ...e, fresh: false }], scopeFixture(), scopeFixture(), NOW, policy, true)[0]?.status).toBe("unverified"); });
  it("honors supplied snooze policy without hiding criticals by default", () => { const until = { "job.1": "2026-11-06T16:00:00.000Z" }; expect(groupAttention([event()], scopeFixture(), scopeFixture(), NOW, policy, true, until)[0]?.status).toBe("snoozed"); expect(groupAttention([{ ...event(), severity: "critical" }], scopeFixture(), scopeFixture(), NOW, policy, true, until)[0]?.status).toBe("open"); });
  it("rejects conflicting replay and scope changes", () => { expect(() => groupAttention([event(), { ...event(), status: "verified_resolved" }], scopeFixture(), scopeFixture(), NOW, policy, true)).toThrow("Conflicting"); expect(groupAttention([event()], scopeFixture(), { ...scopeFixture(), authorizationVersion: "v0" }, NOW, policy, true)).toEqual([]); });
});
