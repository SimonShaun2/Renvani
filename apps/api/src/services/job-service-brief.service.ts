import { and, eq, isNull } from "drizzle-orm";

import { db, emitEventWithExecutor, jobServiceBriefs, jobs } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  type JobPreparationStatusV1,
  type JobServiceBriefV1,
  JobServiceBriefV1Schema,
  ServiceJobBriefProposeParamsV1Schema
} from "@fsm/types";

import { getJob } from "./job.service.js";

export async function getJobServiceBrief(
  companyId: string,
  jobId: string
): Promise<JobServiceBriefV1 | null> {
  await getJob(companyId, jobId);

  const [row] = await db
    .select()
    .from(jobServiceBriefs)
    .where(
      and(
        eq(jobServiceBriefs.companyId, companyId),
        eq(jobServiceBriefs.jobId, jobId),
        isNull(jobServiceBriefs.deletedAt)
      )
    )
    .limit(1);

  if (!row || !row.approvedAt) {
    return null;
  }

  return JobServiceBriefV1Schema.parse({
    contractVersion: "1.0.0",
    jobId: row.jobId,
    companyId: row.companyId,
    resourceVersion: row.resourceVersion,
    sections: row.sections,
    checklistSummary: row.checklistSummary
  });
}

export async function getJobPreparationStatus(
  companyId: string,
  jobId: string
): Promise<JobPreparationStatusV1> {
  const job = await getJob(companyId, jobId);
  const brief = await getJobServiceBrief(companyId, jobId);
  const blockers: string[] = [];

  if (!job.scheduledStart) {
    blockers.push("Job is not scheduled");
  }

  if (!brief) {
    blockers.push("Approved service brief is missing");
  } else if (brief.checklistSummary.requiredPending > 0) {
    blockers.push(`${brief.checklistSummary.requiredPending} required checklist item(s) pending`);
  }

  return {
    readyForField: blockers.length === 0,
    blockers
  };
}

export async function applyApprovedJobServiceBrief(input: {
  companyId: string;
  jobId: string;
  actorId: string;
  agentActionId: string;
  parameters: unknown;
}): Promise<void> {
  const parsed = ServiceJobBriefProposeParamsV1Schema.parse(input.parameters);
  const brief = parsed.brief;

  if (brief.jobId !== input.jobId || brief.companyId !== input.companyId) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "Brief job scope does not match action target");
  }

  await db.transaction(async (tx) => {
    const [job] = await tx
      .select({ id: jobs.id })
      .from(jobs)
      .where(
        and(eq(jobs.companyId, input.companyId), eq(jobs.id, input.jobId), isNull(jobs.deletedAt))
      )
      .limit(1);

    if (!job) {
      throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    }

    const now = new Date();
    await tx
      .insert(jobServiceBriefs)
      .values({
        companyId: input.companyId,
        jobId: input.jobId,
        sections: brief.sections,
        checklistSummary: brief.checklistSummary,
        resourceVersion: brief.resourceVersion,
        approvedAgentActionId: input.agentActionId,
        approvedById: input.actorId,
        approvedAt: now
      })
      .onConflictDoUpdate({
        target: [jobServiceBriefs.companyId, jobServiceBriefs.jobId],
        // Matches the partial unique index (deleted_at IS NULL) from 0049.
        targetWhere: isNull(jobServiceBriefs.deletedAt),
        set: {
          sections: brief.sections,
          checklistSummary: brief.checklistSummary,
          resourceVersion: brief.resourceVersion,
          approvedAgentActionId: input.agentActionId,
          approvedById: input.actorId,
          approvedAt: now,
          updatedAt: now
        }
      });

    await emitEventWithExecutor(tx, {
      companyId: input.companyId,
      actorId: input.actorId,
      actorType: "user",
      eventType: "job.service_brief.approved",
      entityType: "job",
      entityId: input.jobId,
      jobId: input.jobId,
      payload: {
        agentActionId: input.agentActionId,
        sectionCount: brief.sections.length
      },
      summary: "Staff approved job service brief for field use"
    });
  });
}
