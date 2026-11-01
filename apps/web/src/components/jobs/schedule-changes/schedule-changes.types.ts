/**
 * Response and request shapes for the FS-24 scheduling-agent change routes. These mirror
 * apps/api/src/services/scheduling-changes.service.ts and routes/scheduling-agent/changes-schemas.ts
 * (not exported from @fsm/types).
 */
export const SCHEDULE_EXCEPTION_KINDS = ["late_staff", "customer_conflict", "access_issue", "weather", "parts_delay", "other"] as const;
export type ScheduleExceptionKind = (typeof SCHEDULE_EXCEPTION_KINDS)[number];
export type ScheduleChangeAction = "reschedule" | "cancel" | "exception";

export interface JobScheduleState {
  jobId: string;
  status: string;
  technicianId: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  scheduleVersion: number;
}

type ScheduleSnapshot = Pick<JobScheduleState, "status" | "technicianId" | "scheduledStart" | "scheduledEnd">;

export interface ScheduleChangeRecord {
  id: string;
  action: ScheduleChangeAction;
  version: number;
  actorUserId: string | null;
  reason: string | null;
  previous: ScheduleSnapshot;
  next: ScheduleSnapshot;
  exception: { kind: ScheduleExceptionKind; delayMinutes: number | null; escalation: "human" } | null;
  occurredAt: string;
}

export interface JobScheduleDetailResponse {
  schedule: JobScheduleState;
  history: ScheduleChangeRecord[];
}

export interface ScheduleChangeResponse {
  schedule: JobScheduleState;
  change: ScheduleChangeRecord;
  replayed: boolean;
}

interface WriteBase {
  expectedVersion: number;
  idempotencyKey: string;
}
export interface RescheduleInput extends WriteBase {
  scheduledStart: string;
  scheduledEnd: string;
  technicianId?: string;
  reason: string;
}
export interface CancelVisitInput extends WriteBase {
  reason: string;
}
export interface ScheduleExceptionInput extends WriteBase {
  kind: ScheduleExceptionKind;
  note: string;
  delayMinutes?: number;
}
