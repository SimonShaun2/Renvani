// @vitest-environment happy-dom
import { ErrorCode } from "@fsm/types";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/src/lib/api";

const m = vi.hoisted(() => ({
  role: "dispatcher" as string | null,
  data: null as unknown,
  refetch: vi.fn(),
  preview: vi.fn(),
  apply: vi.fn()
}));

vi.mock("@/src/stores/auth.store", () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: m.role ? { role: m.role } : null }) }));
vi.mock("@/src/hooks/recurring-series.hooks", () => ({
  useRecurringSeries: (_id: string, enabled: boolean) => ({ data: enabled ? m.data : undefined, isLoading: false, isError: false, refetch: m.refetch }),
  usePreviewSeriesChange: () => ({ mutateAsync: m.preview, isPending: false }),
  useApplySeriesChange: () => ({ mutateAsync: m.apply, isPending: false })
}));

import { RecurringSeriesClient } from "./RecurringSeriesClient";

const now = new Date("2030-01-01T00:00:00Z");
const occ = (id: string, localDate: string, extra: Record<string, unknown> = {}) => ({
  id,
  occurrenceIndex: 0,
  status: "scheduled",
  localDate,
  scheduledAtUtc: `${localDate}T15:00:00.000Z`,
  jobId: null,
  ...extra
});
const detail = (status = "active") => ({
  series: { seriesId: "s1", status, frequency: "bi_annual", localTime: "09:00", timeZone: "America/Chicago", seriesVersion: 3 },
  occurrences: [occ("o1", "2030-03-01"), occ("o2", "2030-09-01", { jobId: "j5" })],
  history: [],
  openExceptions: []
});
const previewResponse = (extra: Record<string, unknown> = {}) => ({
  series: detail().series,
  previewHash: "c".repeat(64),
  preview: {
    action: "end",
    series: { before: { status: "active", localTime: "09:00" }, after: { status: "cancelled", localTime: "09:00" } },
    occurrences: [{ occurrenceId: "o1", occurrenceIndex: 0, before: { status: "scheduled", localDate: "2030-03-01", scheduledAtUtc: "2030-03-01T15:00:00.000Z" }, after: { status: "cancelled", localDate: "2030-03-01", scheduledAtUtc: "2030-03-01T15:00:00.000Z" } }],
    exceptions: [{ occurrenceId: "o2", reason: "linked_job", jobId: "j5", escalation: "human" }],
    ...extra
  }
});

const mount = () => render(<RecurringSeriesClient seriesId="s1" now={now} />);
const typeReason = (v: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value: v } });

beforeEach(() => {
  m.role = "dispatcher";
  m.data = detail();
  for (const f of [m.refetch, m.preview, m.apply]) f.mockReset();
});
afterEach(() => cleanup());

describe("RecurringSeriesClient", () => {
  it("blocks roles the API rejects without fetching", () => {
    m.role = "office";
    mount();
    expect(screen.getByTestId("series-no-access")).toBeTruthy();
  });

  it("offers status-appropriate change types in Figma order and only open visits without a job", () => {
    mount();
    const radios = screen.getAllByRole("radio").map((r) => r.closest("label")?.textContent);
    expect(radios).toEqual(["Skip one visit", "Move one visit", "Move all future visits to a new time", "Pause plan", "End plan"]);
    fireEvent.click(screen.getByRole("radio", { name: "Skip one visit" }));
    const visit = screen.getByLabelText("Visit") as HTMLSelectElement;
    expect(Array.from(visit.options).map((o) => o.value)).toEqual(["o1"]);
    expect(screen.getByText(/has a job — change it from the job/i)).toBeTruthy();
    expect(screen.getByTestId("visit-o2").textContent).toMatch(/Has job/);
  });

  it("header and pill follow Figma 364:4217; Preview button is 44px", () => {
    mount();
    expect(screen.getByText("Skip or move a visit, preview what changes, then apply.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Visits in this plan" })).toBeTruthy();
    const pill = screen.getByTestId("series-status-pill");
    expect(pill.textContent).toBe("Active");
    expect(pill.style.backgroundColor).toMatch(/#e4f1e8|rgb\(228, 241, 232\)/);
    expect(pill.style.color).toMatch(/#2f7d4f|rgb\(47, 125, 79\)/);
    fireEvent.click(screen.getByRole("radio", { name: "Pause plan" }));
    const btn = screen.getByRole("button", { name: "Preview changes" });
    expect(btn.className).toContain("h-11");
    expect(btn.className).toContain("rounded-[10px]");
    expect(document.body.textContent).not.toMatch(/1\.99|booking fee/i);
  });

  it("an ended plan shows the ended state and no controls", () => {
    m.data = detail("cancelled");
    mount();
    expect(screen.getByTestId("series-ended")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /preview changes/i })).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByTestId("series-ended").textContent).toMatch(/Ended plans can’t be changed\./);
  });

  it("previews first, shows exactly what changes and who needs a person, then applies with the previewHash", async () => {
    m.preview.mockResolvedValue(previewResponse());
    m.apply.mockResolvedValue({ replayed: false });
    mount();
    fireEvent.click(screen.getByRole("radio", { name: "End plan" }));
    typeReason("Homeowner sold the house");
    expect(m.apply).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Preview changes" })));
    expect(m.preview).toHaveBeenCalledWith({ action: "end", reason: "Homeowner sold the house" });
    const preview = screen.getByTestId("series-preview");
    expect(preview.textContent).toMatch(/Active → Ended/);
    expect(preview.textContent).toMatch(/Cancelled/);
    expect(screen.getByTestId("series-preview-exceptions").textContent).toMatch(/flagged for a person/i);
    expect(preview.textContent).toMatch(/Nothing changes until you apply\. No message is sent to the customer\./);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Apply changes" })));
    expect(m.apply).toHaveBeenCalledWith(
      expect.objectContaining({ expectedVersion: 3, previewHash: "c".repeat(64), change: { action: "end", reason: "Homeowner sold the house" }, idempotencyKey: expect.any(String) })
    );
    expect(screen.getByRole("status").textContent).toMatch(/customer has not been messaged/i);
  });

  it("preview_stale on apply shows a reload action that refetches and clears the preview", async () => {
    m.preview.mockResolvedValue(previewResponse());
    m.apply.mockRejectedValue(new ApiError(409, { error: ErrorCode.CONFLICT, message: "x", fields: { reason: "preview_stale" } }));
    mount();
    fireEvent.click(screen.getByRole("radio", { name: "Pause plan" }));
    typeReason("Away for winter");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Preview changes" })));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Apply changes" })));
    expect(screen.getByTestId("series-error").textContent).toMatch(/The plan changed since you previewed it\.Reload and preview again before applying\./);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Reload" })));
    expect(m.refetch).toHaveBeenCalled();
    expect(screen.queryByTestId("series-preview")).toBeNull();
  });

  it("moving one visit sends occurrenceId + localDate; external scheduler is explained", async () => {
    m.preview.mockRejectedValue(new ApiError(409, { error: ErrorCode.CONFLICT, message: "x", fields: { reason: "external_scheduler" } }));
    mount();
    fireEvent.click(screen.getByRole("radio", { name: "Move one visit" }));
    fireEvent.change(screen.getByLabelText("New date"), { target: { value: "2030-03-08" } });
    typeReason("Customer asked for the following week");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Preview changes" })));
    expect(m.preview).toHaveBeenCalledWith({ action: "reschedule_occurrence", occurrenceId: "o1", localDate: "2030-03-08", reason: "Customer asked for the following week" });
    expect(screen.getByTestId("series-error").textContent).toMatch(/scheduled by another system/i);
    expect(screen.getByTestId("series-error").textContent).toMatch(/Make changes in the system that owns this schedule\./);
    expect(screen.queryByRole("button", { name: "Reload" })).toBeNull();
  });
});
