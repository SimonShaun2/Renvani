import { createHash } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import {
  type JobServiceBriefV1,
  ServiceJobBriefProposeParamsV1Schema,
  buildServiceJobBriefIdempotencyKey
} from "@fsm/types";

const AGENT_POLICY_V1 = "agent-policy-v1";

import { db } from "./client.js";
import { emitEventWithExecutor } from "./events.js";
import { agentActions, jobs } from "./schema.js";
import {
  assembleJobServiceBriefDraft,
  buildServiceJobBriefProposalParameters
} from "./service-job-brief-assembler.js";

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashPayload(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function buildJobTargetRecordVersion(updatedAt: Date): string {
  return `rv1:job:${updatedAt.toISOString()}`;
}

export async function createServiceJobBriefAgentProposal(input: {
  companyId: string;
  jobId: string;
  sourceEventIds?: string[];
  brief?: JobServiceBriefV1;
}): Promise<{ created: boolean; actionId: string }> {
  const brief = input.brief ?? (await assembleJobServiceBriefDraft(input.companyId, input.jobId));
  if (!brief) {
    throw new Error("Job not found for service brief proposal");
  }

  const [job] = await db
    .select({ updatedAt: jobs.updatedAt })
    .from(jobs)
    .where(
      and(eq(jobs.companyId, input.companyId), eq(jobs.id, input.jobId), isNull(jobs.deletedAt))
    )
    .limit(1);

  if (!job) {
    throw new Error("Job not found for service brief proposal");
  }

  const parameters = buildServiceJobBriefProposalParameters(brief);
  ServiceJobBriefProposeParamsV1Schema.parse(parameters);

  const idempotencyKey = buildServiceJobBriefIdempotencyKey(input.companyId, input.jobId);
  const target = {
    entityType: "job" as const,
    entityId: input.jobId,
    recordVersion: buildJobTargetRecordVersion(job.updatedAt)
  };

  const payloadHash = hashPayload({
    actionType: "service.job_brief.propose",
    parameters,
    target
  });

  const expiresAt = new Date(Date.now() + DEFAULT_TTL_MS);

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: agentActions.id, payloadHash: agentActions.payloadHash })
      .from(agentActions)
      .where(
        and(
          eq(agentActions.companyId, input.companyId),
          eq(agentActions.idempotencyKey, idempotencyKey),
          isNull(agentActions.deletedAt)
        )
      )
      .limit(1);

    if (existing) {
      return { created: false, actionId: existing.id };
    }

    const inserted = await tx
      .insert(agentActions)
      .values({
        companyId: input.companyId,
        agentProduct: "service",
        actionType: "service.job_brief.propose",
        parameters,
        target,
        sourceEventIds: input.sourceEventIds ?? [],
        idempotencyKey,
        payloadHash,
        policyVersion: AGENT_POLICY_V1,
        requiresApproval: true,
        state: "awaiting_approval",
        reason: parameters.summary,
        expiresAt
      })
      .returning({ id: agentActions.id });

    const actionId = inserted[0]?.id;
    if (!actionId) {
      throw new Error("Failed to insert service job brief agent action");
    }

    await emitEventWithExecutor(tx, {
      companyId: input.companyId,
      actorType: "system",
      eventType: "job.service_brief.proposed",
      entityType: "job",
      entityId: input.jobId,
      jobId: input.jobId,
      payload: {
        agentActionId: actionId,
        sectionCount: brief.sections.length,
        idempotencyKey
      },
      summary: "Service agent proposed job brief for staff approval"
    });

    return { created: true, actionId };
  });
}
