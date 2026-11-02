import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ErrorCode, type JobDetail } from "@fsm/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  complete: vi.fn(),
  review: vi.fn()
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/jobs/job-1",
  useRouter: () => ({ push: mocks.push })
}));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: { div: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }
}));
vi.mock("@/src/hooks/jobs.hooks", () => ({
  useTransitionJob: () => ({ mutateAsync: mocks.complete, isPending: false }),
  useCreateReviewRequest: () => ({ mutateAsync: mocks.review, isPending: false })
}));

import { ApiError } from "@/src/lib/api";

import { JobStatusTransitions } from "./JobStatusTransitions";
import { getTaskProgress } from "./jobs.utils";

const job = { id: "job-1", status: "in_progress", availableTransitions: [] } as unknown as JobDetail;

function renderTransitions(
  checklistState: "loading" | "error" | "ready",
  pendingRequiredTasks: number,
  onRetryChecklist = vi.fn(),
  checklistRefreshing = false
) {
  render(
    <JobStatusTransitions
      job={job}
      pendingRequiredTasks={pendingRequiredTasks}
      checklistState={checklistState}
      checklistRefreshing={checklistRefreshing}
      onRetryChecklist={onRetryChecklist}
      onOpenOTW={vi.fn()}
    />
  );
  fireEvent.click(screen.getByRole("button", { name: "Complete Job" }));
  return { onRetryChecklist, confirm: screen.getAllByRole("button", { name: "Complete Job" }).at(-1)! };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.complete.mockResolvedValue({});
});
afterEach(cleanup);

describe("desktop job completion", () => {
  it("blocks open required tasks without offering an override", () => {
    const { confirm } = renderTransitions("ready", 2);

    expect(screen.getByText("Complete required tasks first")).toBeTruthy();
    expect(screen.queryByText("Complete anyway")).toBeNull();
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.click(confirm);
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("blocks completion and offers retry when the checklist is unavailable", () => {
    const retry = vi.fn();
    const { confirm } = renderTransitions("error", 0, retry);

    expect(screen.getByText("Checklist unavailable")).toBeTruthy();
    expect(confirm.hasAttribute("disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry checklist" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(mocks.complete).not.toHaveBeenCalled();
  });

  it("holds completion while the checklist is loading", () => {
    const { confirm } = renderTransitions("loading", 0);
    expect(screen.getByText(/Checking the required checklist/)).toBeTruthy();
    expect(confirm.hasAttribute("disabled")).toBe(true);
  });

  it("refreshes the checklist after the server rejects a stale completion", async () => {
    const retry = vi.fn();
    mocks.complete.mockRejectedValue(new ApiError(409, {
      error: ErrorCode.CONFLICT,
      message: "Complete required checklist tasks before completing the job"
    }));
    const { confirm } = renderTransitions("ready", 0, retry);
    fireEvent.click(confirm);

    await waitFor(() => expect(retry).toHaveBeenCalledOnce());
    expect(screen.getByText(/Complete required checklist tasks before completing the job/)).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("treats skipped required tasks as closed, matching the server rule", () => {
    const progress = getTaskProgress([
      { isRequired: true, status: "skipped" },
      { isRequired: true, status: "pending" }
    ] as Parameters<typeof getTaskProgress>[0]);
    expect(progress.pendingRequired).toHaveLength(1);
  });
});
