"use client";

import type {
  PayrollSummaryV1,
  TimeEntryV1,
  TimesheetStatus,
  TimesheetTotalsV1,
  TimesheetV1,
  UpdateTimeEntryBody
} from "@fsm/types";
import { ErrorCode } from "@fsm/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, ApiError, authorizedFetch } from "@/src/lib/api";

/** FS-182 web hooks for the FS-171 timesheets & payroll API (contract: @fsm/types timesheets/v1). */

export interface PeriodInput {
  periodStart: string;
  periodEnd: string;
}

/** Max entries fetched per period; the list shows a notice when the API reports more (hasMore). */
export const ENTRY_LIMIT = 200;

interface TimeEntriesResponse {
  entries: TimeEntryV1[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

interface TimesheetsResponse {
  timesheets: TimesheetV1[];
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface TimesheetDetailResponse {
  timesheet: TimesheetV1;
  entries: TimeEntryV1[];
  totals: TimesheetTotalsV1;
}

export type TimesheetAction = "submit" | "approve" | "reject" | "reopen";

export const timesheetKeys = {
  all: ["timesheets"] as const,
  entries: (technicianId: string, period: PeriodInput) => ["timesheets", "entries", technicianId, period.periodStart, period.periodEnd] as const,
  list: (technicianId: string, period: PeriodInput) => ["timesheets", "list", technicianId, period.periodStart, period.periodEnd] as const,
  payroll: (period: PeriodInput) => ["timesheets", "payroll", period.periodStart, period.periodEnd] as const
};

const qs = (params: Record<string, string | number | undefined>) =>
  new URLSearchParams(Object.entries(params).filter((e): e is [string, string | number] => e[1] !== undefined).map(([k, v]) => [k, String(v)])).toString();

export function useTimeEntries(technicianId: string | null, period: PeriodInput) {
  return useQuery({
    queryKey: timesheetKeys.entries(technicianId ?? "none", period),
    queryFn: () =>
      api.get<TimeEntriesResponse>(`/api/v1/time/entries?${qs({ technicianId: technicianId ?? undefined, from: period.periodStart, to: period.periodEnd, limit: ENTRY_LIMIT })}`),
    enabled: Boolean(technicianId)
  });
}

export function useTimesheets(technicianId: string | null, period: PeriodInput) {
  return useQuery({
    queryKey: timesheetKeys.list(technicianId ?? "none", period),
    queryFn: () =>
      api.get<TimesheetsResponse>(`/api/v1/timesheets?${qs({ technicianId: technicianId ?? undefined, from: period.periodStart, to: period.periodEnd })}`),
    enabled: Boolean(technicianId)
  });
}

export function usePayrollSummary(period: PeriodInput, enabled: boolean) {
  return useQuery({
    queryKey: timesheetKeys.payroll(period),
    queryFn: () => api.get<{ summary: PayrollSummaryV1 }>(`/api/v1/payroll/summary?${qs({ ...period })}`),
    enabled
  });
}

export function useUpdateTimeEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTimeEntryBody }) => api.patch<{ entry: TimeEntryV1 }>(`/api/v1/time/entries/${id}`, body),
    onSettled: () => client.invalidateQueries({ queryKey: timesheetKeys.all })
  });
}

export function useCreateTimesheet() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PeriodInput & { technicianId: string }) => api.post<{ timesheet: TimesheetV1 }>("/api/v1/timesheets", body),
    onSettled: () => client.invalidateQueries({ queryKey: timesheetKeys.all })
  });
}

export function useTimesheetAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action, reason, recordVersion }: { id: string; action: TimesheetAction; reason?: string; recordVersion?: string }) =>
      api.post<{ timesheet: TimesheetV1 }>(`/api/v1/timesheets/${id}/${action}`, reason !== undefined ? { reason, recordVersion } : { recordVersion }),
    onSettled: () => client.invalidateQueries({ queryKey: timesheetKeys.all })
  });
}

export function payrollCsvFileName(period: PeriodInput): string {
  return `renvani-payroll-${period.periodStart}-to-${period.periodEnd}.csv`;
}

/** Fetches the payroll CSV (approved hours only) and returns it as a Blob. */
export async function fetchPayrollCsv(period: PeriodInput): Promise<Blob> {
  const response = await authorizedFetch(`/api/v1/payroll/export?${qs({ ...period, format: "csv" })}`);
  if (!response.ok) {
    throw new ApiError(response.status, { error: ErrorCode.INTERNAL_ERROR, message: `Payroll export failed (${response.status})` });
  }
  return response.blob();
}

/** True for a 409 stale-version/locked conflict from the timesheets API. */
export function isConflict(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export const TIMESHEET_STATUS_LABEL: Record<TimesheetStatus, string> = {
  open: "Open",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected"
};
