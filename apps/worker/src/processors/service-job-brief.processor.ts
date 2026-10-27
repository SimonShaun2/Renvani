import type { Job } from "bullmq";
import pino from "pino";

import { featureFlags } from "@fsm/config/feature-flags";
import { createServiceJobBriefAgentProposal } from "@fsm/db";
import { type ServiceBuildJobBriefJobData } from "@fsm/types";

const logger = pino({
  name: "service-job-brief-processor"
});

function isValidPayload(data: unknown): data is ServiceBuildJobBriefJobData {
  if (!data || typeof data !== "object") {
    return false;
  }
  const record = data as Record<string, unknown>;
  return (
    typeof record.companyId === "string" &&
    typeof record.jobId === "string" &&
    typeof record.idempotencyKey === "string" &&
    Array.isArray(record.sourceEventIds)
  );
}

export async function processServiceBuildJobBrief(
  job: Job<ServiceBuildJobBriefJobData>
): Promise<void> {
  const parsed = isValidPayload(job.data)
    ? { success: true as const, data: job.data }
    : { success: false as const, error: { issues: [] } };
  if (!parsed.success) {
    logger.warn({ jobId: job.id ?? null, issues: parsed.error.issues }, "Invalid service.build-job-brief payload");
    return;
  }

  if (!featureFlags.serviceJobBriefWorkerEnabled) {
    logger.info(
      { companyId: parsed.data.companyId, jobId: parsed.data.jobId },
      "Service job brief worker disabled; skipping"
    );
    return;
  }

  const result = await createServiceJobBriefAgentProposal({
    companyId: parsed.data.companyId,
    jobId: parsed.data.jobId,
    sourceEventIds: parsed.data.sourceEventIds
  });

  logger.info(
    {
      companyId: parsed.data.companyId,
      jobId: parsed.data.jobId,
      actionId: result.actionId,
      created: result.created
    },
    "Service job brief agent proposal processed"
  );
}
