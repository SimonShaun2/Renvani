import { z } from "zod";

import { webhooksQueue } from "./queues.js";

export const CLERK_WORKSPACE_CREATE_JOB_NAME = "clerk-workspace-create";
export const CLERK_WORKSPACE_RECONCILE_JOB_NAME = "clerk-workspace-reconcile";

export const ClerkWorkspaceJobPayloadSchema = z.object({
  intentId: z.string().uuid(),
  clerkUserId: z.string().min(1).max(255)
}).strict();

export type ClerkWorkspaceJobPayload = z.infer<typeof ClerkWorkspaceJobPayloadSchema>;

function createJobId(intentId: string): string {
  return `clerk-workspace-create-${intentId}`;
}

function reconcileJobId(intentId: string): string {
  return `clerk-workspace-reconcile-${intentId}`;
}

/**
 * Enqueue the single permitted provider create attempt for one durable intent.
 * The job is deliberately non-retryable: an unknown provider outcome must be
 * recovered by reconciliation, never by issuing another create call.
 */
export async function enqueueClerkWorkspaceCreateJob(input: ClerkWorkspaceJobPayload): Promise<void> {
  const payload = ClerkWorkspaceJobPayloadSchema.parse(input);
  await webhooksQueue.add(CLERK_WORKSPACE_CREATE_JOB_NAME, payload, {
    jobId: createJobId(payload.intentId),
    attempts: 1,
    removeOnComplete: true,
    removeOnFail: false
  });
}

/** Reconcile a claimed/uncertain intent from paginated, secret-key Clerk observations. */
export async function enqueueClerkWorkspaceReconcileJob(input: ClerkWorkspaceJobPayload): Promise<void> {
  const payload = ClerkWorkspaceJobPayloadSchema.parse(input);
  await webhooksQueue.add(CLERK_WORKSPACE_RECONCILE_JOB_NAME, payload, {
    jobId: reconcileJobId(payload.intentId),
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: true,
    removeOnFail: false
  });
}
