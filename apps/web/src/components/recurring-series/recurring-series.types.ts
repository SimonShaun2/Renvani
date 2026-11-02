/**
 * FS-60 recurring series control shapes. These mirror apps/api/src/services/recurring-series-controls.service.ts and
 * routes/scheduling-agent/series-schemas.ts (not exported from @fsm/types).
 */
export type SeriesChange =
  | { action: "pause"; reason: string }
  | { action: "resume"; reason: string }
  | { action: "end"; reason: string }
  | { action: "skip_occurrence"; occurrenceId: string; reason: string }
  | { action: "reschedule_occurrence"; occurrenceId: string; localDate: string; reason: string }
  | { action: "reschedule_future"; localTime: string; reason: string };
export type SeriesAction = SeriesChange["action"];

export interface OccurrenceState {
  id: string;
  occurrenceIndex: number;
  status: string;
  localDate: string;
  scheduledAtUtc: string;
  jobId: string | null;
}

export interface SeriesState {
  seriesId: string;
  status: string;
  frequency: string;
  localTime: string;
  timeZone: string;
  seriesVersion: number;
}

export interface OccurrenceDiff {
  occurrenceId: string;
  occurrenceIndex: number;
  before: { status: string; localDate: string; scheduledAtUtc: string };
  after: { status: string; localDate: string; scheduledAtUtc: string };
}

export interface SeriesException {
  occurrenceId: string;
  reason: "linked_job";
  jobId: string;
  escalation: "human";
}

export interface SeriesPreview {
  action: SeriesAction;
  series: { before: { status: string; localTime: string }; after: { status: string; localTime: string } };
  occurrences: OccurrenceDiff[];
  exceptions: SeriesException[];
}

export interface PreviewResponse {
  series: SeriesState;
  preview: SeriesPreview;
  previewHash: string;
}

export interface SeriesChangeRecord {
  id: string;
  action: SeriesAction;
  version: number;
  actorUserId: string | null;
  reason: string;
  preview: SeriesPreview;
  occurredAt: string;
}

export interface ExecuteResponse {
  series: SeriesState;
  change: SeriesChangeRecord;
  replayed: boolean;
}

export interface SeriesDetailResponse {
  series: SeriesState;
  occurrences: OccurrenceState[];
  history: SeriesChangeRecord[];
  openExceptions: Array<SeriesException & { action: string; recordedAt: string }>;
}

export interface ExecuteSeriesChangeInput {
  expectedVersion: number;
  idempotencyKey: string;
  previewHash: string;
  change: SeriesChange;
}
