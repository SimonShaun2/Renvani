import { describe, expect, it, vi } from "vitest";

import { assignAndScheduleJob, formatDispatchSummary, summarizeDispatch } from "./dispatch-actions";

const input = {
  jobId: "job 1",
  technicianId: "tech-1",
  scheduledStart: "2026-10-27T14:00:00.000Z",
  scheduledEnd: "2026-10-27T16:00:00.000Z"
};

describe("assignAndScheduleJob", () => {
  it("calls POST assign then POST schedule on the dev routes", async () => {
    const post = vi.fn().mockResolvedValueOnce({ job: { id: "a" } }).mockResolvedValueOnce({ job: { id: "s" } });
    await expect(assignAndScheduleJob({ post }, input)).resolves.toEqual({ job: { id: "s" } });
    expect(post.mock.calls).toEqual([
      ["/api/v1/jobs/job%201/assign", { technicianId: "tech-1" }],
      ["/api/v1/jobs/job%201/schedule", { scheduledStart: input.scheduledStart, scheduledEnd: input.scheduledEnd }]
    ]);
  });

  it("does not schedule when assign fails", async () => {
    const post = vi.fn().mockRejectedValueOnce(new Error("Technician not found"));
    await expect(assignAndScheduleJob({ post }, input)).rejects.toThrow("Technician not found");
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe("dispatch summary", () => {
  it("counts technicians, jobs and unassigned", () => {
    const summary = summarizeDispatch([{ jobs: [{}, {}] }, { jobs: [{}] }] as never, 1);
    expect(summary).toEqual({ technicians: 2, jobs: 3, unassigned: 1 });
    expect(formatDispatchSummary("Tue, Oct 27", summary)).toBe("Tue, Oct 27 · 2 technicians · 3 jobs · 1 unassigned");
    expect(formatDispatchSummary("Tue", summarizeDispatch([{ jobs: [{}] }] as never, 0))).toBe(
      "Tue · 1 technician · 1 job · 0 unassigned"
    );
  });
});
