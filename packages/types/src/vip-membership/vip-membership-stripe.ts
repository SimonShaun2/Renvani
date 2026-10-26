import { z } from "zod";

export const VIP_MEMBERSHIP_BILLING_KIND = "vip_membership" as const;

export const VIP_MEMBERSHIP_DEFAULT_GRACE_DAYS = 7;

/** Dunning email offsets (days from first failure) within the grace window. */
export const VIP_MEMBERSHIP_DUNNING_DAY_OFFSETS = [0, 3, 6] as const;

export type VipMembershipDunningDayOffset = (typeof VIP_MEMBERSHIP_DUNNING_DAY_OFFSETS)[number];

export const vipMembershipEmailKindSchema = z.enum([
  "welcome",
  "renewal_receipt",
  "payment_failed_dunning"
]);

export type VipMembershipEmailKind = z.infer<typeof vipMembershipEmailKindSchema>;

export const sendVipMembershipEmailJobSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  emailKind: vipMembershipEmailKindSchema,
  stripeSubscriptionId: z.string().min(1),
  stripeInvoiceId: z.string().min(1).optional(),
  planName: z.string().min(1),
  amount: z.string().optional(),
  paymentUrl: z.string().url().optional(),
  graceEndsAtIso: z.string().optional(),
  nextRetryAtIso: z.string().optional(),
  dunningStepIndex: z.number().int().min(0).max(10).optional(),
  dunningStepCount: z.number().int().min(1).max(10).optional()
});

export type SendVipMembershipEmailJobPayload = z.infer<typeof sendVipMembershipEmailJobSchema>;

export function getStripeMetadataString(
  metadata: Record<string, string | undefined> | null | undefined,
  key: string
): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function isVipMembershipBillingMetadata(
  metadata: Record<string, string | undefined> | null | undefined
): boolean {
  return getStripeMetadataString(metadata, "billingKind") === VIP_MEMBERSHIP_BILLING_KIND;
}

export function extractVipMembershipContext(
  metadata: Record<string, string | undefined> | null | undefined
): { companyId: string; customerId: string; planName: string } | null {
  if (!isVipMembershipBillingMetadata(metadata)) {
    return null;
  }

  const companyId = getStripeMetadataString(metadata, "companyId");
  const customerId = getStripeMetadataString(metadata, "customerId");

  if (!companyId || !customerId) {
    return null;
  }

  const planName =
    getStripeMetadataString(metadata, "planName") ??
    getStripeMetadataString(metadata, "membershipPlan") ??
    "VIP Plus";

  return { companyId, customerId, planName };
}

export function resolveVipGraceDaysFromCompanySettings(
  settings: unknown,
  fallbackDays: number = VIP_MEMBERSHIP_DEFAULT_GRACE_DAYS
): number {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return fallbackDays;
  }

  const vipMembership = (settings as { vipMembership?: { pastDueGraceDays?: number } }).vipMembership;
  const days = vipMembership?.pastDueGraceDays;

  if (typeof days === "number" && Number.isInteger(days) && days >= 1 && days <= 90) {
    return days;
  }

  return fallbackDays;
}
