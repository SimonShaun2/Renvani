import { z } from "zod";

import { featureFlags } from "@fsm/config/feature-flags";

import { notificationsQueue } from "./queues.js";
import { buildDefaultEnqueueJobOptions } from "./queue-policy.js";

export const SEND_CUSTOMER_EMAIL_VERIFICATION_JOB_NAME = "send-customer-email-verification";

export const customerEmailVerificationJobSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  challengeId: z.string().uuid(),
}).strict();

export type CustomerEmailVerificationJob = z.infer<typeof customerEmailVerificationJobSchema>;

/** The queue carries IDs only. The trusted worker reconstructs the token after fresh DB checks. */
export async function enqueueCustomerEmailVerificationJob(raw: unknown): Promise<"disabled" | "queued"> {
  const payload = customerEmailVerificationJobSchema.parse(raw);
  if (!featureFlags.customerEmailVerificationDeliveryEnabled) return "disabled";
  await notificationsQueue.add(SEND_CUSTOMER_EMAIL_VERIFICATION_JOB_NAME, payload, {
    ...buildDefaultEnqueueJobOptions(),
    jobId: `fs234-email-${payload.challengeId}`,
  });
  return "queued";
}
