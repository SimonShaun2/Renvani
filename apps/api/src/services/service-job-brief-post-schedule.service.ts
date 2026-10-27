import { featureFlags } from "@fsm/config/feature-flags";
import { enqueueBuildJobServiceBriefJob } from "@fsm/jobs";

export type EnqueueServiceJobBriefAfterScheduleInput = {
  companyId: string;
  jobId: string;
  sourceEventIds?: string[];
};

export async function enqueueServiceJobBriefAfterSchedule(
  input: EnqueueServiceJobBriefAfterScheduleInput
): Promise<"scheduled" | "skipped_disabled"> {
  if (!featureFlags.serviceJobBriefWorkerEnabled) {
    return "skipped_disabled";
  }

  await enqueueBuildJobServiceBriefJob({
    companyId: input.companyId,
    jobId: input.jobId,
    ...(input.sourceEventIds ? { sourceEventIds: input.sourceEventIds } : {})
  });

  return "scheduled";
}
