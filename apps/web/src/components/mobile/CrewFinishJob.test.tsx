// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  job: vi.fn(),
  tasks: vi.fn(),
  attachments: vi.fn(),
  upload: vi.fn(),
  transition: vi.fn(),
  retryJob: vi.fn(),
  retryTasks: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/src/hooks/jobs.hooks", () => ({
  useJob: mocks.job,
  useJobTasks: mocks.tasks,
  useJobAttachments: mocks.attachments,
  useUploadAttachment: mocks.upload,
  useTransitionJob: mocks.transition
}));
vi.mock("./CrewChecklist", () => ({
  CrewChecklist: () => <div>Checklist</div>,
  isTaskDone: (task: { status: string }) => task.status === "completed" || task.status === "skipped"
}));

import { CrewFinishJob } from "./CrewFinishJob";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.job.mockReturnValue({
    data: { job: { id: "job-1", jobNumber: "J-1", status: "in_progress", property: null } },
    isLoading: false,
    isError: false,
    refetch: mocks.retryJob
  });
  mocks.tasks.mockReturnValue({
    data: { tasks: [] },
    isLoading: false,
    isError: false,
    refetch: mocks.retryTasks
  });
  mocks.attachments.mockReturnValue({ data: { data: [] } });
  mocks.upload.mockReturnValue({ isPending: false, mutate: vi.fn() });
  mocks.transition.mockReturnValue({ isPending: false, mutate: vi.fn() });
});
afterEach(cleanup);

describe("CrewFinishJob loading failures", () => {
  it("keeps completion unavailable and retries when checklist loading fails", () => {
    mocks.tasks.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mocks.retryTasks });
    render(<CrewFinishJob jobId="job-1" />);

    expect(screen.getByText(/Could not load the checklist/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mark complete" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry checklist" }));
    expect(mocks.retryTasks).toHaveBeenCalledOnce();
  });

  it("shows a retryable load error instead of claiming the job is missing", () => {
    mocks.job.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mocks.retryJob });
    render(<CrewFinishJob jobId="job-1" />);

    expect(screen.getByText(/Could not load this job/)).toBeTruthy();
    expect(screen.queryByText("Job not found")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry job" }));
    expect(mocks.retryJob).toHaveBeenCalledOnce();
  });
});
