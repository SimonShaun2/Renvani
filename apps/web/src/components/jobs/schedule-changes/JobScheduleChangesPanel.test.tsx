// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { ApiError } from "@/src/lib/api";

const m = vi.hoisted(() => ({
  role: "dispatcher" as string | null,
  schedule: null as unknown,
  refetch: vi.fn(),
  reschedule: vi.fn(),
  cancel: vi.fn(),
  flag: vi.fn()
}));

vi.mock("@/src/stores/auth.store", () => ({ useAuthStore: (sel: (s: unknown) => unknown) => sel({ user: m.role ? { role: m.role } : null }) }));
vi.mock("@/src/hooks/technicians.hooks", () => ({ useTechnicians: () => ({ data: { data: [{ id: "t2", firstName: "Ray", lastName: "Ortiz" }] } }) }));
vi.mock("@/src/hooks/scheduling-changes.hooks", () => ({
  useJobSchedule: (_id: string, enabled: boolean) => ({ data: enabled ? m.schedule : undefined, isLoading: false, isError: false, refetch: m.refetch }),
  useRescheduleJob: () => ({ mutateAsync: m.reschedule, isPending: false }),
  useCancelJobVisit: () => ({ mutateAsync: m.cancel, isPending: false }),
  useFlagScheduleException: () => ({ mutateAsync: m.flag, isPending: false })
}));

import { JobScheduleChangesPanel, type ScheduleChangeMode } from "./JobScheduleChangesPanel";

const now = new Date("2026-11-02T15:00:00.000Z");
const at = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();
const state = (startH: number, status = "scheduled") => ({
  schedule: { jobId: "j1", status, technicianId: "t1", scheduledStart: at(startH), scheduledEnd: at(startH + 2), scheduleVersion: 4 },
  history: []
});

function Harness({ initial = null as ScheduleChangeMode }) {
  let mode = initial;
  const r = render(<JobScheduleChangesPanel jobId="j1" mode={mode} onModeChange={(next) => ((mode = next), rerender())} now={now} />);
  function rerender() {
    r.rerender(<JobScheduleChangesPanel jobId="j1" mode={mode} onModeChange={(next) => ((mode = next), rerender())} now={now} />);
  }
  return null;
}
const mount = (initial: ScheduleChangeMode = null) => Harness({ initial });

beforeEach(() => {
  m.role = "dispatcher";
  m.schedule = state(72);
  for (const f of [m.refetch, m.reschedule, m.cancel, m.flag]) f.mockReset();
});
afterEach(() => cleanup());

describe("JobScheduleChangesPanel", () => {
  it("renders nothing for roles the API rejects", () => {
    m.role = "technician";
    mount();
    expect(screen.queryByTestId("schedule-changes-panel")).toBeNull();
  });

  it("disables cancel for a dispatcher within 24h and explains why", () => {
    m.schedule = state(5);
    mount();
    const btn = screen.getByRole("button", { name: /cancel visit/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(screen.getByText(/only an owner or admin can cancel/i)).toBeTruthy();
  });

  it("lets an owner cancel within 24h and sends expectedVersion + idempotencyKey", async () => {
    m.role = "owner";
    m.schedule = state(5);
    m.cancel.mockResolvedValue({ replayed: false });
    mount("cancel");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Customer replaced the unit" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancel visit" })));
    expect(m.cancel).toHaveBeenCalledWith(expect.objectContaining({ expectedVersion: 4, reason: "Customer replaced the unit", idempotencyKey: expect.any(String) }));
    expect(screen.getByRole("status").textContent).toMatch(/customer has not been messaged/i);
  });

  it("shows a stale-version 409 with a reload action and keeps the key for retries", async () => {
    m.reschedule.mockRejectedValue(new ApiError(409, { error: ErrorCode.CONFLICT, message: "stale", fields: { reason: "stale_version", currentVersion: "5" } }));
    mount("reschedule");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Customer asked for Thursday" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save new time" })));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save new time" })));
    const [a, b] = m.reschedule.mock.calls.map((c) => (c[0] as { idempotencyKey: string }).idempotencyKey);
    expect(a).toBe(b);
    expect(screen.getByTestId("schedule-error").textContent).toMatch(/someone else changed this visit/i);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /reload schedule/i })));
    expect(m.refetch).toHaveBeenCalled();
  });

  it("shows a technician conflict with a link to the other visit", async () => {
    m.reschedule.mockRejectedValue(new ApiError(409, { error: ErrorCode.CONFLICT, message: "x", fields: { reason: "schedule_conflict", conflictJobId: "j9" } }));
    mount("reschedule");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "t2" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Move to Ray" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save new time" })));
    expect(m.reschedule).toHaveBeenCalledWith(expect.objectContaining({ technicianId: "t2", expectedVersion: 4 }));
    expect(screen.getByRole("link", { name: /view the other visit/i }).getAttribute("href")).toBe("/jobs/j9");
  });

  it("flags a problem for a person without moving the visit", async () => {
    m.flag.mockResolvedValue({ replayed: false });
    mount("flag");
    expect(screen.getByText(/flags the visit for a person/i)).toBeTruthy();
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "40" } });
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Panel upgrade ran long" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Flag for a person" })));
    expect(m.flag).toHaveBeenCalledWith(expect.objectContaining({ kind: "late_staff", delayMinutes: 40, note: "Panel upgrade ran long", expectedVersion: 4 }));
    expect(screen.getByRole("status").textContent).toMatch(/flagged for a person/i);
  });
});
