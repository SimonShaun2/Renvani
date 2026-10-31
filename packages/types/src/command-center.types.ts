import { z } from "zod";

/**
 * FS-29 Owner Command Center brief (GET /api/v1/command-center/brief). Read-only, deterministic composition of
 * tenant records (no LLM, no provider calls). Every number cites its records via `sources[]`; labels are record
 * ids/numbers only, never customer names or contact details. v1: owner/admin only, calendar month period with the
 * previous calendar month as comparison, facts vs suggestions (no confidence display).
 */

const localDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, "must be YYYY-MM-DD").refine(
  (value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value),
  { message: "must be a valid calendar date" }
);

export function isValidIanaTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const commandCenterBriefQuerySchema = z
  .object({
    date: localDateSchema.optional(),
    timeZone: z.string().trim().min(1).max(64).refine(isValidIanaTimeZone, { message: "must be an IANA time zone" }).optional(),
    period: z.enum(["month"]).optional()
  })
  .strict();

export type CommandCenterBriefQuery = z.infer<typeof commandCenterBriefQuerySchema>;

export const COMMAND_CENTER_SOURCE_KINDS = [
  "booking_request",
  "call_record",
  "job",
  "invoice",
  "customer",
  "agent_action",
  "maintenance_plan",
  "crew",
  "campaign"
] as const;
export type CommandCenterSourceKind = (typeof COMMAND_CENTER_SOURCE_KINDS)[number];

export interface CommandCenterSource {
  kind: CommandCenterSourceKind;
  id: string;
  /** Record number or short id label (e.g. "J-4519", "INQ-1a2b3c4d"). Never a customer name or contact detail. */
  label: string;
  /** Web route for the record. */
  route: string;
  occurredAt: string | null;
}

export type CommandCenterKpiKey = "direct_inquiries" | "inquiry_to_booked" | "first_to_recurring" | "marketing_revenue";

export interface CommandCenterKpi {
  key: CommandCenterKpiKey;
  label: string;
  unit: "count" | "percent" | "money";
  /** count: integer; percent: 0-100 (2dp); money: decimal string (2dp). null = no data (denominator 0). */
  value: number | string | null;
  numerator: number | null;
  denominator: number | null;
  previousValue: number | string | null;
  detail: string | null;
  sourceLabel: string;
  definition: string;
  sources: CommandCenterSource[];
  sourcesTruncated: boolean;
}

export type CommandCenterNeedsYouState = "awaiting_approval" | "escalated" | "execution_failed" | "delivery_failed";

export interface CommandCenterNeedsYouItem {
  /** "suggestion" = an agent proposal awaiting a decision; "fact" = something that already happened (failure, escalation). */
  kind: "fact" | "suggestion";
  state: CommandCenterNeedsYouState;
  agentProduct: string;
  actionId: string;
  actionType: string;
  /** Optimistic-concurrency version (updatedAt ms) to send as expectedVersion. */
  version: number;
  title: string;
  primaryAction: "approve" | "review" | "open";
  occurredAt: string;
  sources: CommandCenterSource[];
}

export interface CommandCenterLoopStage {
  stage: "discover" | "book" | "complete" | "rebook";
  label: string;
  count: number;
  sources: CommandCenterSource[];
  sourcesTruncated: boolean;
}

export interface CommandCenterCrewToday {
  crewId: string;
  name: string;
  jobCount: number;
  nextStartAt: string | null;
  status: "on_route" | "exception" | "off" | "scheduled";
  sources: CommandCenterSource[];
}

export type CommandCenterMissingData = "inquiries" | "jobs" | "agent_actions" | "crews";

export interface CommandCenterBrief {
  generatedAt: string;
  period: {
    date: string;
    period: "month";
    startDate: string;
    endDate: string;
    timeZone: string;
    compareStartDate: string;
    compareEndDate: string;
  };
  header: { approvalsWaiting: number; exceptions: number };
  kpis: CommandCenterKpi[];
  needsYou: {
    counts: { approvals: number; exceptions: number };
    items: CommandCenterNeedsYouItem[];
    truncated: boolean;
  };
  loop: CommandCenterLoopStage[];
  crewsToday: CommandCenterCrewToday[];
  today: { jobsToday: number; sources: CommandCenterSource[] };
  emptyStates: { hasAnyData: boolean; missing: CommandCenterMissingData[] };
}

export interface CommandCenterKpiDefinition {
  key: CommandCenterKpiKey;
  label: string;
  unit: CommandCenterKpi["unit"];
  sourceLabel: string;
  definition: string;
}

export const COMMAND_CENTER_KPI_REGISTRY: readonly CommandCenterKpiDefinition[] = [
  {
    key: "direct_inquiries",
    label: "Direct inquiries",
    unit: "count",
    sourceLabel: "Your branded site + app + tracked numbers",
    definition:
      "Booking requests created in the period, plus inbound calls to tracked numbers in the period that do not match a booking request from the same caller within 24 hours."
  },
  {
    key: "inquiry_to_booked",
    label: "Inquiry → booked",
    unit: "percent",
    sourceLabel: "Revenue Agent handoffs",
    definition:
      "Booking requests created in the period that are linked to a booked job (estimate approved through paid, or closed), divided by booking requests created in the period."
  },
  {
    key: "first_to_recurring",
    label: "First → recurring",
    unit: "percent",
    sourceLabel: "Retention offers accepted",
    definition:
      "Customers whose first booked job is in the period that now hold an active maintenance plan, agreement or VIP plan, or have a later booked job, divided by customers whose first booked job is in the period."
  },
  {
    key: "marketing_revenue",
    label: "Marketing revenue",
    unit: "money",
    sourceLabel: "Automations + win-back",
    definition:
      "Payments on invoices paid in the period whose job is a rebooking (maintenance-plan visit or repeat customer) or carries a campaign attribution (utm_campaign)."
  }
];
