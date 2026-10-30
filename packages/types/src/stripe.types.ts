export interface StripePlatformBillingStatus {
  enabled: boolean;
  subscribed: boolean;
  status?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  planTier?: "flex" | "flat" | null;
  checkoutAvailable: boolean;
}

export interface StripeConnectStatus {
  connected: boolean;
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
  stripeAccountId?: string;
  accountName?: string | null;
  payoutSchedule?: string | null;
  lastPayoutAmount?: string | null;
  lastPayoutAt?: string | null;
  /** Flex: customer-paid platform fee % added at checkout (0 on Flat). */
  platformFeePercent?: number;
  /** Same value as platformFeePercent under the customer-facing "Service Fee" name. */
  serviceFeePercent?: number;
  renvaniPlanTier?: "flex" | "flat" | null;
}
