// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/src/lib/api";

const mocks = vi.hoisted(() => ({
  job: vi.fn(),
  tasks: vi.fn(),
  timeEntries: vi.fn(),
  attachments: vi.fn(),
  upload: vi.fn(),
  transition: vi.fn(),
  mobileJob: vi.fn(),
  reportIssue: vi.fn(),
  submitIssue: vi.fn(),
  retryMobileJob: vi.fn(),
  retryJob: vi.fn(),
  retryTasks: vi.fn(),
  toast: vi.fn()
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/src/hooks/jobs.hooks", () => ({
  useJob: mocks.job,
  useJobTasks: mocks.tasks,
  useJobTimeEntries: mocks.timeEntries,
  useJobAttachments: mocks.attachments,
  useUploadAttachment: mocks.upload,
  useTransitionJob: mocks.transition,
  useMobileJobVersion: mocks.mobileJob,
  useReportMobileIssue: mocks.reportIssue
}));
vi.mock("@/src/stores/toast.store", () => ({ showToast: mocks.toast }));
vi.mock("./CrewChecklist", () => ({
  CrewChecklist: () => <div>Checklist</div>,
  isTaskDone: (task: { status: string }) => task.status === "completed" || task.status === "skipped"
}));

import { CrewFinishJob } from "./CrewFinishJob";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.job.mockReturnValue({
    data: { job: { id: "job-1", jobNumber: "J-1", status: "in_progress", customer: { firstName: "Dana", lastName: "Hill" }, property: null, completionNotes: "Replaced the filter.", techNotes: null } },
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
  mocks.timeEntries.mockReturnValue({ data: { timeEntries: [{ endedAt: new Date(), durationMinutes: 70 }] }, isLoading: false, isError: false });
  mocks.upload.mockReturnValue({ isPending: false, mutate: vi.fn() });
  mocks.transition.mockReturnValue({ isPending: false, mutate: vi.fn() });
  mocks.mobileJob.mockReturnValue({ data: { job: { recordVersion: "version-1" } }, isLoading: false, isError: false, isFetching: false, refetch: mocks.retryMobileJob });
  mocks.submitIssue.mockResolvedValue({ issue: { id: "issue-1" } });
  mocks.reportIssue.mockReturnValue({ isPending: false, mutateAsync: mocks.submitIssue });
});

describe("CrewFinishJob issue reporting", () => {
  it("exposes seven supported categories and submits Access with medium severity", async () => {
    render(<CrewFinishJob jobId="job-1" />);
    expect(screen.getByText("Review this job")).toBeTruthy();
    expect(screen.getByText("Work record")).toBeTruthy();
    expect(screen.getByText("1h 10m")).toBeTruthy();
    expect(screen.getByText("Replaced the filter.")).toBeTruthy();
    expect(screen.getByText("Completion sends the work record to the office.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Report an issue" }));
    for (const name of ["Access", "Customer not home", "Safety", "Parts needed", "Equipment", "Scope change", "Other"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
    }
    expect(screen.getByText(/does not approve extra work/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Access" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Describe the access issue/ }), { target: { value: "  Gate locked  " } });
    fireEvent.click(screen.getByRole("button", { name: "Report issue" }));

    await waitFor(() => expect(mocks.submitIssue).toHaveBeenCalledWith({ category: "access", severity: "medium", description: "Gate locked", recordVersion: "version-1" }));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "success", title: "Issue reported" }));
  });

  it("shows only source-backed work record values and explicit unavailable states", () => {
    mocks.tasks.mockReturnValue({ data: { tasks: [{ status: "completed" }, { status: "pending" }] }, isLoading: false, isError: false });
    mocks.attachments.mockReturnValue({ data: { data: [{ id: "photo-1", fileType: "photo", fileUrl: "/photo.jpg", fileName: "After photo" }] }, isLoading: false, isError: false });
    mocks.timeEntries.mockReturnValue({ data: { timeEntries: [{ endedAt: new Date(), durationMinutes: 70 }] }, isLoading: false, isError: true });
    render(<CrewFinishJob jobId="job-1" />);

    expect(screen.getByText("1 of 2")).toBeTruthy();
    expect(screen.getByText("1 saved")).toBeTruthy();
    expect(screen.getByText("Unavailable")).toBeTruthy();
    expect(screen.queryByText(/Approved total/)).toBeNull();
    expect(screen.queryByText(/\$238/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Access" })).toBeNull();
    expect(screen.getByRole("button", { name: "Complete job" })).toBeTruthy();
  });

  it("keeps Safety report open and refreshes the version after a conflict", async () => {
    mocks.submitIssue.mockRejectedValue(new ApiError(409, { error: "CONFLICT", message: "stale version" }));
    render(<CrewFinishJob jobId="job-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Report an issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Safety" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Describe the safety issue/ }), { target: { value: "Gas smell" } });
    fireEvent.click(screen.getByRole("button", { name: "Report issue" }));

    await waitFor(() => expect(screen.getByText(/This job changed/)).toBeTruthy());
    expect(mocks.retryMobileJob).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox", { name: /Describe the safety issue/ })).toBeTruthy();
  });

  it("does not submit when the latest job version cannot be loaded", () => {
    mocks.mobileJob.mockReturnValue({ data: undefined, isLoading: false, isError: true, isFetching: false, refetch: mocks.retryMobileJob });
    render(<CrewFinishJob jobId="job-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Report an issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Access" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Describe the access issue/ }), { target: { value: "Locked gate" } });

    expect((screen.getByRole("button", { name: "Report issue" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Could not check the latest job details.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry job details" }));
    expect(mocks.retryMobileJob).toHaveBeenCalledOnce();
    expect(mocks.submitIssue).not.toHaveBeenCalled();
  });

  it("keeps issue reporting blocked when a failed refresh leaves a cached version", () => {
    mocks.mobileJob.mockReturnValue({
      data: { job: { recordVersion: "stale-version" } },
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch: mocks.retryMobileJob
    });
    render(<CrewFinishJob jobId="job-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Report an issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Safety" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Describe the safety issue/ }), { target: { value: "Gas smell" } });

    expect((screen.getByRole("button", { name: "Report issue" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Could not check the latest job details.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Report issue" }));
    expect(mocks.submitIssue).not.toHaveBeenCalled();
  });
});
afterEach(cleanup);

describe("CrewFinishJob loading failures", () => {
  it("keeps completion unavailable and retries when checklist loading fails", () => {
    mocks.tasks.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: mocks.retryTasks });
    render(<CrewFinishJob jobId="job-1" />);

    expect(screen.getByText(/Could not load the checklist/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Complete job" })).toBeNull();
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

  it("refreshes job and checklist state when completion finds a server-side conflict", () => {
    const mutate = vi.fn();
    mocks.transition.mockReturnValue({ isPending: false, mutate });
    render(<CrewFinishJob jobId="job-1" />);

    fireEvent.click(screen.getByRole("button", { name: "Complete job" }));
    expect(mutate).toHaveBeenCalledOnce();
    const [, options] = mutate.mock.calls[0] as [unknown, { onError: (error: Error) => void }];
    options.onError(Object.assign(new Error("Complete required checklist tasks before completing the job"), { status: 409 }));

    expect(mocks.retryJob).toHaveBeenCalledOnce();
    expect(mocks.retryTasks).toHaveBeenCalledOnce();
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ tone: "error", title: "Checklist changed" }));
  });
});


describe("CrewFinishJob supported issue contract", () => {
  it.each([
    ["Access", "access"], ["Customer not home", "customer_not_home"],
    ["Safety", "safety"], ["Parts needed", "parts_needed"],
    ["Equipment", "equipment"], ["Scope change", "scope_change"], ["Other", "other"]
  ])("submits %s with explicit high severity and no implicit job hold", async (label, category) => {
    render(<CrewFinishJob jobId="job-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Report an issue" }));
    fireEvent.click(screen.getByRole("button", { name: label }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Needs office review  " } });
    fireEvent.click(screen.getByRole("radio", { name: "High" }));
    fireEvent.click(screen.getByRole("button", { name: "Report issue" }));
    await waitFor(() => expect(mocks.submitIssue).toHaveBeenCalledWith({ category, severity: "high", description: "Needs office review", recordVersion: "version-1" }));
    expect(mocks.transition().mutate).not.toHaveBeenCalled();
  });

  it("keeps the draft on a failed submission", async () => {
    mocks.submitIssue.mockRejectedValue(new Error("Connection unavailable"));
    render(<CrewFinishJob jobId="job-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Report an issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Parts needed" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Replacement part required" } });
    fireEvent.click(screen.getByRole("radio", { name: "Low" }));
    fireEvent.click(screen.getByRole("button", { name: "Report issue" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Connection unavailable"));
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Replacement part required");
    expect((screen.getByRole("radio", { name: "Low" }) as HTMLInputElement).checked).toBe(true);
  });

  it("blocks duplicate clicks, edits, hiding and completion while the report is pending", async () => {
    let resolve: (value: unknown) => void = () => undefined;
    mocks.submitIssue.mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<CrewFinishJob jobId="job-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Report an issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Access" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Locked gate" } });
    const submit = screen.getByRole("button", { name: "Report issue" });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(mocks.submitIssue).toHaveBeenCalledOnce();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Report an issue" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Complete job" }) as HTMLButtonElement).disabled).toBe(true);
    resolve({ issue: { id: "issue-1" } });
    await waitFor(() => expect(screen.queryByRole("textbox")).toBeNull());
  });
});
