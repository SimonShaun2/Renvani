import { z } from "zod";

/**
 * FS-22 Revenue outcome instrumentation (Command Center). Read-only aggregates for field/home service
 * businesses (HVAC, plumbing, electrical): inquiry -> qualified -> estimate -> confirmed/completed job ->
 * repeat revenue. Ids and aggregates only, never customer contact details.
 *
 * Stages and segments are registries (plain arrays), not enums: append an entry to extend them.
 */

const revenueOutcomesIsoDate = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: "must be a valid ISO date or date-time"
  });

export const revenueOutcomesQuerySchema = z
  .object({
    startDate: revenueOutcomesIsoDate,
    endDate: revenueOutcomesIsoDate
  })
  .strict();

export type RevenueOutcomesQuery = z.infer<typeof revenueOutcomesQuerySchema>;

export interface RevenueOutcomeRegistryEntry {
  key: string;
  label: string;
  definition: string;
}

export const REVENUE_FUNNEL_STAGE_REGISTRY: readonly RevenueOutcomeRegistryEntry[] = [
  {
    key: "inquiries",
    label: "Inquiries",
    definition: "Booking requests (web, phone or agent intake) created in the period."
  },
  {
    key: "qualified",
    label: "Qualified",
    definition:
      "Distinct booking requests with a revenue.inquiry_qualified audit event in the period, or confirmed in the period."
  },
  {
    key: "estimates_sent",
    label: "Estimates sent",
    definition: "Estimates with sentAt in the period."
  },
  {
    key: "estimates_approved",
    label: "Estimates approved",
    definition: "Estimates with approvedAt in the period."
  },
  {
    key: "jobs_confirmed",
    label: "Confirmed jobs",
    definition:
      "Jobs in a booked status (estimate_approved through paid, plus closed) whose scheduled start (else created time) is in the period."
  },
  {
    key: "jobs_completed",
    label: "Completed jobs",
    definition: "Confirmed jobs in status completed, invoiced, paid or closed."
  },
  {
    key: "repeat_jobs",
    label: "Repeat-customer jobs",
    definition:
      "Confirmed jobs whose customer had an earlier booked job (before the period, or an earlier scheduled start in the period)."
  }
];

export const REVENUE_CUSTOMER_SEGMENT_REGISTRY: readonly RevenueOutcomeRegistryEntry[] = [
  { key: "new", label: "New customers", definition: "First booked job for the customer." },
  { key: "repeat", label: "Repeat customers", definition: "Customer had an earlier booked job." }
];

export const REVENUE_ASSISTANCE_SEGMENT_REGISTRY: readonly RevenueOutcomeRegistryEntry[] = [
  {
    key: "agent_assisted",
    label: "Agent-assisted",
    definition:
      "A Renvani agent proposal in the period targeted the job or its booking request and was approved, executed or succeeded."
  },
  { key: "manual", label: "Owner/team only", definition: "No accepted agent proposal targeted the job." }
];

export interface RevenueFunnelStage {
  stage: string;
  label: string;
  count: number;
}

export interface RevenueOutcomeSegment {
  segment: string;
  label: string;
  confirmedJobs: number;
  completedJobs: number;
  /** Decimal string, 2 places. Completed-job revenue (paid, else invoiced, else estimate total). */
  completedRevenue: string;
}

export interface RevenueOutcomesSummary {
  period: { startDate: string; endDate: string; timeZone: string; dateInterpretation: string };
  funnel: RevenueFunnelStage[];
  revenue: {
    completedRevenue: string;
    newCustomerRevenue: string;
    repeatCustomerRevenue: string;
    /** 0-100, 2 decimals. */
    repeatRevenueSharePercent: number;
  };
  segments: {
    customerType: RevenueOutcomeSegment[];
    agentAssistance: RevenueOutcomeSegment[];
  };
  profit: {
    costBasis: "materials_only";
    completedJobCount: number;
    completedRevenue: string;
    materialCost: string;
    contributionProfit: string;
    /** null when there are no completed jobs. */
    contributionProfitPerCompletedJob: string | null;
    /** Completed jobs with at least one material line whose catalog item has no cost. */
    jobsWithIncompleteCostData: number;
  };
  guardrails: {
    agentProposals: number;
    accepted: number;
    rejected: number;
    escalated: number;
    failed: number;
    edited: number;
    /** 0-100, null when there were no decided proposals. */
    acceptanceRatePercent: number | null;
    overrideRatePercent: number | null;
    errorRatePercent: number | null;
  };
  attribution: {
    unknownSourceJobCount: number;
    unknownSourceDefinition: string;
  };
  definitions: RevenueOutcomeRegistryEntry[];
}
