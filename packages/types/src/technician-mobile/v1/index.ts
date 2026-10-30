/**
 * FS-169 — technician mobile API contract (v1).
 *
 * Versioning: every job / checklist item resource carries `recordVersion`, an
 * opaque optimistic-lock token built by {@link buildRecordVersionV1} from the
 * row's `updatedAt` (same token format the field-work sync batch API uses).
 * Mutating calls accept an optional `recordVersion`; if present and stale the
 * API answers 409 with `{ error: "CONFLICT", reason: "stale_record_version",
 * current }` where `current` is the live resource. Omit it to keep
 * last-write-wins behaviour (backward compatible).
 */
import { z } from "zod";

export const TECHNICIAN_MOBILE_CONTRACT_VERSION = "1.0.0" as const;

export const MobileJobStatusSchema = z.enum([
  "lead",
  "estimate_requested",
  "estimate_sent",
  "estimate_approved",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "completed",
  "invoiced",
  "paid",
  "cancelled",
  "closed"
]);
export type MobileJobStatus = z.infer<typeof MobileJobStatusSchema>;

/** Statuses a technician may set via PATCH /mobile/jobs/:id/status (completion uses POST /jobs/:id/complete). */
export const MobileSettableJobStatusSchema = z.enum(["dispatched", "in_progress", "on_hold"]);

export const MobileChecklistStatusSchema = z.enum(["pending", "in_progress", "completed", "skipped"]);

const RecordVersionInputSchema = z.string().min(1).max(512);

export const MobileTodayQuerySchema = z.object({
  /** YYYY-MM-DD, interpreted as a UTC calendar day. Defaults to today (UTC). */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Non-technician roles only; technicians are always resolved from their own login. */
  technicianId: z.string().uuid().optional()
});
export type MobileTodayQuery = z.infer<typeof MobileTodayQuerySchema>;

export const MobileJobIdParamsSchema = z.object({ id: z.string().uuid() });
export const MobileChecklistItemParamsSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid()
});

export const MobileOnTheWayBodySchema = z.object({
  recordVersion: RecordVersionInputSchema.optional(),
  estimatedArrivalMinutes: z.number().int().min(0).max(24 * 60).optional(),
  technicianLat: z.number().min(-90).max(90).optional(),
  technicianLng: z.number().min(-180).max(180).optional()
});
export type MobileOnTheWayBody = z.infer<typeof MobileOnTheWayBodySchema>;

export const MobileStatusBodySchema = z.object({
  status: MobileSettableJobStatusSchema,
  reason: z.string().max(2000).optional(),
  recordVersion: RecordVersionInputSchema.optional()
});
export type MobileStatusBody = z.infer<typeof MobileStatusBodySchema>;

export const MobileChecklistUpdateBodySchema = z
  .object({
    status: MobileChecklistStatusSchema.optional(),
    notes: z.string().max(5000).optional(),
    actualMinutes: z.number().int().min(0).max(24 * 60).optional(),
    recordVersion: RecordVersionInputSchema.optional()
  })
  .refine((v) => v.status !== undefined || v.notes !== undefined || v.actualMinutes !== undefined, {
    message: "At least one of status, notes, actualMinutes is required"
  });
export type MobileChecklistUpdateBody = z.infer<typeof MobileChecklistUpdateBodySchema>;

export const MOBILE_ISSUE_CATEGORIES = [
  "access",
  "customer_not_home",
  "safety",
  "parts_needed",
  "equipment",
  "scope_change",
  "other"
] as const;

export const MobileReportIssueBodySchema = z.object({
  category: z.enum(MOBILE_ISSUE_CATEGORIES),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
  description: z.string().trim().min(1).max(5000),
  /** Optional: also move the job to on_hold (e.g. blocked on parts). */
  putOnHold: z.boolean().optional(),
  recordVersion: RecordVersionInputSchema.optional()
});
export type MobileReportIssueBody = z.infer<typeof MobileReportIssueBodySchema>;

export interface MobileChecklistItem {
  id: string;
  jobId: string;
  title: string;
  description: string | null;
  status: z.infer<typeof MobileChecklistStatusSchema>;
  isRequired: boolean;
  sortOrder: number;
  notes: string | null;
  actualMinutes: number | null;
  completedAt: string | null;
  updatedAt: string;
  recordVersion: string;
}

export interface MobileJob {
  id: string;
  jobNumber: string;
  title: string | null;
  status: MobileJobStatus;
  priority: string | null;
  technicianId: string | null;
  customerId: string;
  propertyId: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  actualStart: string | null;
  /** Latest on-the-way timestamp for this job, if any. */
  onTheWayAt: string | null;
  updatedAt: string;
  recordVersion: string;
  checklist: MobileChecklistItem[];
}

export interface MobileTodayResponse {
  contractVersion: typeof TECHNICIAN_MOBILE_CONTRACT_VERSION;
  date: string;
  technicianId: string;
  /** Ordered by route: scheduledStart ascending, unscheduled last, then jobNumber. */
  jobs: MobileJob[];
}

export interface MobileJobResponse {
  job: MobileJob;
}

export interface MobileChecklistItemResponse {
  item: MobileChecklistItem;
}

export interface MobileIssue {
  id: string;
  jobId: string;
  category: (typeof MOBILE_ISSUE_CATEGORIES)[number];
  severity: "low" | "medium" | "high";
  description: string;
  reportedById: string;
  createdAt: string;
}

export interface MobileReportIssueResponse {
  issue: MobileIssue;
  job: MobileJob;
}

/** 409 body for stale recordVersion. */
export interface MobileVersionConflictResponse<T = MobileJob | MobileChecklistItem> {
  error: "CONFLICT";
  reason: "stale_record_version";
  message: string;
  current: T;
}
