import { z } from "zod";

const token = z.string().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/u);
export const formRequirementSchema = z.object({ templateId: token, pinnedVersion: token, submissionVersion: token,
  status: z.enum(["draft", "submitted", "reviewed", "returned"]), requiredFields: z.array(token).max(100),
  answeredFields: z.array(token).max(100), requiredArtifacts: z.array(token).max(100), confirmedArtifacts: z.array(token).max(100),
  reviewedPass: z.boolean().nullable() }).strict();
export function formReadiness(input: unknown): { ready: boolean; blockers: string[] } {
  const f = formRequirementSchema.parse(input); const blockers: string[] = [];
  if (f.submissionVersion !== f.pinnedVersion) blockers.push("template_version_conflict");
  if (f.requiredFields.some((id) => !f.answeredFields.includes(id))) blockers.push("required_field_missing");
  if (f.requiredArtifacts.some((id) => !f.confirmedArtifacts.includes(id))) blockers.push("artifact_not_confirmed");
  if (f.status !== "reviewed" || f.reviewedPass !== true) blockers.push("review_not_accepted");
  return { ready: blockers.length === 0, blockers };
}
export const migrationReadinessSchema = z.object({ status: z.enum(["uploaded", "committing", "completed", "failed"]),
  sourceCount: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), accepted: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  rejected: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), duplicates: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  relationshipsReconciled: z.boolean(), amountsReconciled: z.boolean(), unsupportedDisclosed: z.boolean(),
  exceptionsAccepted: z.boolean(), downstreamChanged: z.boolean() }).strict();
export function migrationReadiness(input: unknown): { accepted: boolean; safeIsolatedRollback: boolean; blockers: string[] } {
  const m = migrationReadinessSchema.parse(input); const blockers: string[] = [];
  if (m.status !== "completed") blockers.push("commit_not_completed");
  if (BigInt(m.sourceCount) !== BigInt(m.accepted) + BigInt(m.rejected) + BigInt(m.duplicates)) blockers.push("count_mismatch");
  if (!m.relationshipsReconciled || !m.amountsReconciled) blockers.push("unreconciled");
  if (!m.unsupportedDisclosed || !m.exceptionsAccepted) blockers.push("scope_or_exceptions_unaccepted");
  return { accepted: blockers.length === 0, safeIsolatedRollback: m.status === "completed" && !m.downstreamChanged, blockers };
}
export const launchReadinessSchema = z.object({ freshStart: z.boolean(), ownerAccepted: z.boolean(),
  gates: z.array(z.object({ id: token, mandatory: z.boolean(), accepted: z.boolean(), evidenceVersion: token.nullable(), currentVersion: token }).strict()).max(100) }).strict();
export function launchReadiness(input: unknown): { ready: boolean; blockers: string[] } {
  const launch = launchReadinessSchema.parse(input); const blockers: string[] = [];
  if (new Set(launch.gates.map((g) => g.id)).size !== launch.gates.length) throw new Error("Duplicate readiness gate");
  for (const gate of launch.gates) {
    if (gate.id === "migration" && launch.freshStart) continue;
    if (gate.mandatory && (!gate.accepted || gate.evidenceVersion === null || gate.evidenceVersion !== gate.currentVersion)) blockers.push(gate.id);
  }
  if (!launch.ownerAccepted) blockers.push("owner_cutover_not_accepted");
  if (launch.gates.length === 0) blockers.push("requirements_missing");
  return { ready: blockers.length === 0, blockers };
}
