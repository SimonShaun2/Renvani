import {
  type SendVipMembershipEmailJobPayload,
  sendVipMembershipEmailJobSchema,
  VIP_MEMBERSHIP_DUNNING_DAY_OFFSETS,
  type VipMembershipDunningDayOffset
} from "@fsm/types";

import { notificationsQueue } from "./queues.js";
import { buildDefaultEnqueueJobOptions } from "./queue-policy.js";

export const SEND_VIP_MEMBERSHIP_EMAIL_JOB_NAME = "send-vip-membership-email";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function buildVipWelcomeEmailJobId(stripeSubscriptionId: string): string {
  return `vip-welcome-${stripeSubscriptionId}`;
}

export function buildVipRenewalEmailJobId(stripeInvoiceId: string): string {
  return `vip-renewal-${stripeInvoiceId}`;
}

export function buildVipDunningEmailJobId(
  stripeSubscriptionId: string,
  stripeInvoiceId: string,
  dayOffset: VipMembershipDunningDayOffset
): string {
  return `vip-dunning-${stripeSubscriptionId}-${stripeInvoiceId}-d${dayOffset}`;
}

export async function enqueueVipMembershipEmail(
  payload: SendVipMembershipEmailJobPayload,
  options?: { jobId?: string; delayMs?: number }
): Promise<void> {
  const parsed = sendVipMembershipEmailJobSchema.parse(payload);
  const enqueueOptions = buildDefaultEnqueueJobOptions();

  const jobOptions = { ...enqueueOptions } as Record<string, unknown>;

  if (options?.jobId) {
    jobOptions.jobId = options.jobId;
  }

  if (options?.delayMs !== undefined && options.delayMs > 0) {
    jobOptions.delay = options.delayMs;
  }

  await notificationsQueue.add(SEND_VIP_MEMBERSHIP_EMAIL_JOB_NAME, parsed, jobOptions);
}

export async function scheduleVipMembershipDunningEmails(input: {
  companyId: string;
  customerId: string;
  stripeSubscriptionId: string;
  stripeInvoiceId: string;
  planName: string;
  amount: string;
  paymentUrl: string | null;
  graceEndsAtIso: string;
  nextRetryAtIso: string | null;
  graceDays: number;
}): Promise<void> {
  const offsets = VIP_MEMBERSHIP_DUNNING_DAY_OFFSETS.filter((day) => day < input.graceDays);
  const stepCount = offsets.length;

  for (let stepIndex = 0; stepIndex < offsets.length; stepIndex += 1) {
    const dayOffset = offsets[stepIndex] as VipMembershipDunningDayOffset;
    await enqueueVipMembershipEmail(
      {
        companyId: input.companyId,
        customerId: input.customerId,
        emailKind: "payment_failed_dunning",
        stripeSubscriptionId: input.stripeSubscriptionId,
        stripeInvoiceId: input.stripeInvoiceId,
        planName: input.planName,
        amount: input.amount,
        paymentUrl: input.paymentUrl ?? undefined,
        graceEndsAtIso: input.graceEndsAtIso,
        nextRetryAtIso: input.nextRetryAtIso ?? undefined,
        dunningStepIndex: stepIndex,
        dunningStepCount: stepCount
      },
      {
        jobId: buildVipDunningEmailJobId(input.stripeSubscriptionId, input.stripeInvoiceId, dayOffset),
        delayMs: dayOffset * MS_PER_DAY
      }
    );
  }
}

export async function cancelScheduledVipMembershipDunning(
  stripeSubscriptionId: string,
  stripeInvoiceId: string
): Promise<void> {
  for (const dayOffset of VIP_MEMBERSHIP_DUNNING_DAY_OFFSETS) {
    const jobId = buildVipDunningEmailJobId(stripeSubscriptionId, stripeInvoiceId, dayOffset);
    const job = await notificationsQueue.getJob(jobId);

    if (job) {
      await job.remove();
    }
  }
}
