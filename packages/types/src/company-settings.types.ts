export interface NotificationChannelPreferences {
  email: boolean;
  sms: boolean;
}

export interface CompanyNotificationSettings {
  estimateFollowUp?: NotificationChannelPreferences | null;
  invoiceRecovery?: NotificationChannelPreferences | null;
  reviewRequest?: NotificationChannelPreferences | null;
  bookingRequest?: NotificationChannelPreferences | null;
  paymentReceived?: NotificationChannelPreferences | null;
  serviceDueAlert?: NotificationChannelPreferences | null;
}

export interface CompanyBillingSettings {
  planName?: string | null;
  billingInterval?: string | null;
  monthlyPrice?: string | null;
  seatsIncluded?: number | null;
  seatsUsed?: number | null;
  jobsThisMonth?: number | null;
  smsCreditsUsed?: number | null;
  smsCreditsLimit?: number | null;
}

export interface CompanyClerkSettings {
  organizationId?: string | null;
}

/** STACK-13 — platform subscription snapshot in companies.settings */
export interface CompanyStripePlatformBillingSettings {
  status?: string | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  /** Flex ($299/mo + shop fee) vs Flat ($799/mo, no shop fee) */
  planTier?: "flex" | "flat" | null;
}

/** FS-132 — configurable pause / dunning policy (defaults in @fsm/config) */
export interface CompanyVipMembershipSettings {
  maxPauseMonths?: number | null;
  pastDueGraceDays?: number | null;
}

/** Growth: per-shop Google Business Profile sync opt-in (adapter is disabled until configured). */
export interface CompanyGoogleBusinessProfileSettings {
  optIn?: boolean | null;
  updatedAt?: string | null;
}

export interface CompanySettings {
  tradingName?: string | null;
  currency?: string | null;
  notifications?: CompanyNotificationSettings | null;
  billing?: CompanyBillingSettings | null;
  /** STACK-02 — maps Clerk org to tenant company */
  clerk?: CompanyClerkSettings | null;
  stripePlatformBilling?: CompanyStripePlatformBillingSettings | null;
  vipMembership?: CompanyVipMembershipSettings | null;
  googleBusinessProfile?: CompanyGoogleBusinessProfileSettings | null;
}
