import { ErrorCode } from "@fsm/types";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/src/lib/api";

import {
  allowedSeriesActions,
  canManageSeries,
  describeSeriesError,
  formatLocalTime,
  frequencyLabel,
  isChangeableOccurrence
} from "./recurring-series.utils";

const err = (status: number, fields: Record<string, string>) =>
  new ApiError(status, { error: status === 409 ? ErrorCode.CONFLICT : ErrorCode.VALIDATION_ERROR, message: "msg", fields });

describe("recurring series gating", () => {
  it("matches the API roles", () => {
    expect(["owner", "admin", "dispatcher"].every(canManageSeries)).toBe(true);
    expect(["office", "technician", null].some(canManageSeries)).toBe(false);
  });

  it("mirrors the service's status rules", () => {
    expect(allowedSeriesActions("active")).toContain("pause");
    expect(allowedSeriesActions("active")).not.toContain("resume");
    expect(allowedSeriesActions("paused")).toContain("resume");
    expect(allowedSeriesActions("paused")).not.toContain("pause");
    expect(allowedSeriesActions("cancelled")).toEqual([]);
    expect(allowedSeriesActions("something_new")).toEqual([]);
  });

  it("only upcoming scheduled visits without a job are changeable", () => {
    const now = new Date("2030-01-01T00:00:00Z");
    const base = { id: "o", occurrenceIndex: 0, localDate: "2030-02-01", scheduledAtUtc: "2030-02-01T15:00:00Z", jobId: null };
    expect(isChangeableOccurrence({ ...base, status: "scheduled" }, now)).toBe(true);
    expect(isChangeableOccurrence({ ...base, status: "skipped" }, now)).toBe(false);
    expect(isChangeableOccurrence({ ...base, status: "scheduled", jobId: "j1" }, now)).toBe(false);
    expect(isChangeableOccurrence({ ...base, status: "scheduled", scheduledAtUtc: "2029-12-01T00:00:00Z" }, now)).toBe(false);
  });

  it("labels the real frequency enum and formats times", () => {
    expect(frequencyLabel("bi_annual")).toBe("Twice a year");
    expect(formatLocalTime("09:00")).toBe("9:00 AM");
    expect(formatLocalTime("13:30")).toBe("1:30 PM");
  });
});

describe("describeSeriesError", () => {
  it.each([
    ["stale_version", "stale", true],
    ["preview_stale", "preview_stale", true],
    ["idempotency_conflict", "idempotency", true],
    ["occurrence_conflict", "occurrence_conflict", true],
    ["series_ended", "series_ended", true],
    ["external_scheduler", "external_scheduler", false]
  ])("409 %s", (reason, kind, reload) => {
    expect(describeSeriesError(err(409, { reason }))).toMatchObject({ kind, reload });
  });

  it("linked_job is explained as needing a person and links the job", () => {
    const v = describeSeriesError(err(409, { reason: "linked_job", jobId: "j7" }));
    expect(v).toMatchObject({ kind: "linked_job", jobId: "j7" });
    expect(v.message).toMatch(/flagged for a person/i);
  });

  it("400 past date", () => {
    expect(describeSeriesError(err(400, { localDate: "in_past" }))).toMatchObject({ kind: "validation", message: "Pick a date after today." });
  });
});
