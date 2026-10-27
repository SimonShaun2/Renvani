import { z } from "zod";

import { UuidSchema } from "../agent-control-plane/v1/zod-shared.js";

export const JOB_SERVICE_BRIEF_CONTRACT_VERSION = "1.0.0";

export const BriefSectionSourceKindSchema = z.enum([
  "customer_supplied",
  "business_policy",
  "agent_inference",
  "staff_entered",
  "imported_history"
]);

export type BriefSectionSourceKind = z.infer<typeof BriefSectionSourceKindSchema>;

export const JobServiceBriefSectionV1Schema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(8000),
  sourceKind: BriefSectionSourceKindSchema,
  confidence: z.number().min(0).max(1).optional(),
  policyRef: z.string().max(200).optional()
});

export type JobServiceBriefSectionV1 = z.infer<typeof JobServiceBriefSectionV1Schema>;

export const JobServiceBriefChecklistSummaryV1Schema = z.object({
  total: z.number().int().nonnegative(),
  requiredPending: z.number().int().nonnegative()
});

export const JobServiceBriefV1Schema = z.object({
  contractVersion: z.literal(JOB_SERVICE_BRIEF_CONTRACT_VERSION),
  jobId: UuidSchema,
  companyId: UuidSchema,
  resourceVersion: z.string().min(1).max(128),
  sections: z.array(JobServiceBriefSectionV1Schema),
  checklistSummary: JobServiceBriefChecklistSummaryV1Schema
});

export type JobServiceBriefV1 = z.infer<typeof JobServiceBriefV1Schema>;

export const ServiceJobBriefProposeParamsV1Schema = z.object({
  brief: JobServiceBriefV1Schema,
  summary: z.string().min(1).max(500)
});

export type ServiceJobBriefProposeParamsV1 = z.infer<typeof ServiceJobBriefProposeParamsV1Schema>;

export const JobPreparationStatusV1Schema = z.object({
  readyForField: z.boolean(),
  blockers: z.array(z.string().max(500))
});

export type JobPreparationStatusV1 = z.infer<typeof JobPreparationStatusV1Schema>;

export const JobNoteKindV1Schema = z.enum(["internal", "field"]);

export type JobNoteKindV1 = z.infer<typeof JobNoteKindV1Schema>;

/**
 * Includes the job resource version so a brief for a changed job is not suppressed as a duplicate
 * of an earlier proposal (FS-25 follow-up).
 */
export function buildServiceJobBriefIdempotencyKey(
  companyId: string,
  jobId: string,
  resourceVersion: string
): string {
  return `service-job-brief:${companyId}:${jobId}:${resourceVersion}`;
}

/** BullMQ job ids must not contain ':'; the version is reduced to a safe token. */
export function buildServiceJobBriefBuildJobId(
  companyId: string,
  jobId: string,
  resourceVersion: string
): string {
  const versionToken = resourceVersion.replace(/[^A-Za-z0-9_-]/g, "-");
  return `service-build-job-brief-${companyId}-${jobId}-${versionToken}`;
}
