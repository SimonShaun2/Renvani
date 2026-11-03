import { DndContext } from "@dnd-kit/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DispatchTechnicianDay } from "@fsm/types";
import { afterEach, describe, expect, it, vi } from "vitest";

import { formatTimelineHour } from "./dispatch.utils";
import { DispatchTimeline, formatBlockHours, getTimelineBlockTone } from "./DispatchTimeline";

afterEach(cleanup);

const at = (h: number, m = 0) => new Date(2026, 9, 27, h, m).toISOString();

function tech(id: string, name: string, jobs: Array<{ id: string; title: string; last: string; s: number; e: number; em?: number; status?: string }>) {
  return {
    id, name, hoursScheduled: 0, hoursAvailable: 8, utilization: 0, serviceZipCodes: [], gaps: [],
    jobs: jobs.map((j) => ({
      id: j.id, jobNumber: j.id, title: j.title, status: j.status ?? "scheduled", priority: "normal",
      scheduledStart: at(j.s), scheduledEnd: at(j.e, j.em ?? 0), customer: { id: "c", firstName: "A", lastName: j.last }, property: null
    }))
  } as unknown as DispatchTechnicianDay;
}

function setup(props: Partial<Parameters<typeof DispatchTimeline>[0]> = {}) {
  const onSelectJob = vi.fn();
  render(
    <DndContext>
      <DispatchTimeline
        technicians={[tech("t1", "Andre Diaz", [{ id: "j1", title: "Biweekly", last: "Whitfield", s: 8, e: 10, em: 30 }]), tech("t2", "Marcus Lee", [])]}
        isLoading={false}
        selectedJobId={null}
        animatedJobId={null}
        quickCreateSlot={null}
        createQuickJobPending={false}
        createQuickJobError={null}
        activeDragJobId={null}
        onSelectJob={onSelectJob}
        onOpenQuickCreate={vi.fn()}
        onCloseQuickCreate={vi.fn()}
        onCreateQuickJob={vi.fn()}
        {...props}
      />
    </DndContext>
  );
  return { onSelectJob };
}

describe("DispatchTimeline (Figma 10:558)", () => {
  it("renders the Crew header with 8 … 5 hour labels and one lane per technician", () => {
    setup();
    expect(screen.getByText("Crew")).toBeTruthy();
    expect([8, 12, 13, 17].map(formatTimelineHour)).toEqual(["8", "12", "1", "5"]);
    for (const label of ["8", "9", "10", "11", "12", "1", "2", "3", "4", "5"]) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getAllByTestId("dispatch-lane")).toHaveLength(2);
  });

  it("shows job blocks as 'Title · Last name' with hours and selects on click", () => {
    const { onSelectJob } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Biweekly · Whitfield/ }));
    expect(onSelectJob).toHaveBeenCalledWith("j1");
    expect(screen.getByText("2.5 h")).toBeTruthy();
  });

  it("draws the dashed Suggested block only in the proposed technician's lane", () => {
    setup({ suggestion: { technicianId: "t2", label: "Becker", scheduledStart: at(13), scheduledEnd: at(16) } });
    const block = screen.getByTestId("dispatch-suggested-block");
    expect(block.textContent).toContain("Suggested · Becker");
    expect(block.textContent).toContain("3 h");
    expect(screen.getAllByTestId("dispatch-lane")[1]?.contains(block)).toBe(true);
  });

  it("keeps the empty state when there are no technicians", () => {
    setup({ technicians: [] });
    expect(screen.getByText("No technicians match these filters")).toBeTruthy();
  });

  it("maps statuses to the frame's block tones and formats durations", () => {
    expect(getTimelineBlockTone("scheduled")).toContain("#e5eafb");
    expect(getTimelineBlockTone("in_progress")).toContain("#e4f1e8");
    expect(getTimelineBlockTone("on_hold")).toContain("#fbe3dc");
    expect(formatBlockHours(at(9), at(11))).toBe("2 h");
  });
});
