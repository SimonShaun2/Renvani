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
    // If infrastructure fails before the CAS claim, a later POST must be able to enqueue again.
    // Once claimed, state is never pending again, so re-enqueue cannot repeat the provider call.
    removeOnFail: true
  });
}

/** Reconcile a claimed/uncertain intent from paginated, secret-key Clerk observations. */
export async function enqueueClerkWorkspaceReconcileJob(input: ClerkWorkspaceJobPayload): Promise<void> {
  const payload = ClerkWorkspaceJobPayloadSchema.parse(input);
  const jobId = reconcileJobId(payload.intentId);
  const existing = await webhooksQueue.getJob(jobId);
  if (existing) {
    if (await existing.getState() === "failed") {
      try {
        // Reuse the failed job rather than removing its recorded failure. BullMQ
        // retains its stacktrace while resetting the bounded attempt count.
        await existing.retry("failed", { resetAttemptsMade: true });
      } catch (error) {
        // A concurrent request may already have moved this failed job to waiting.
        const state = await existing.getState();
        if (state !== "waiting" && state !== "active" && state !== "delayed" && state !== "waiting-children") {
          throw error;
        }
      }
    }
    return;
  }
  await webhooksQueue.add(CLERK_WORKSPACE_RECONCILE_JOB_NAME, payload, {
    jobId,
    attempts: 5,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: true,
    removeOnFail: false
  });
}
