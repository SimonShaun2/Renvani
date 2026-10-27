import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "@testing-library/react";

import { DispatchHeader, DispatchLoadError } from "./DispatchHeader";

afterEach(cleanup);

function setup(overrides: Partial<Parameters<typeof DispatchHeader>[0]> = {}) {
  const props = {
    summaryText: "Tue, Oct 27 · 2 technicians · 3 jobs · 1 unassigned",
    streamLive: true,
    unassignedJob: { id: "job-9", label: "Move-out · Tom Becker" },
    autoFitPending: false,
    canAddVisit: true,
    onAutoAssign: vi.fn(),
    onAddVisit: vi.fn(),
    ...overrides
  };
  render(<DispatchHeader {...props} />);
  return props;
}

describe("DispatchHeader", () => {
  it("renders the title, summary and live state", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Dispatch" })).toBeTruthy();
    expect(screen.getByText("Tue, Oct 27 · 2 technicians · 3 jobs · 1 unassigned")).toBeTruthy();
    expect(screen.getByTestId("dispatch-live-status").textContent).toBe("Live");
  });

  it("shows the polling fallback when the stream is down", () => {
    setup({ streamLive: false });
    expect(screen.getByTestId("dispatch-live-status").textContent).toBe("Refreshing every 30s");
  });

  it("asks for a proposal (never applies directly) from the banner and the header button", () => {
    const props = setup();
    expect(screen.getByRole("region", { name: "Unassigned job" }).textContent).toContain("Move-out · Tom Becker");
    fireEvent.click(screen.getByRole("button", { name: "Review proposal" }));
    fireEvent.click(screen.getByRole("button", { name: "Auto-assign (proposal)" }));
    expect(props.onAutoAssign).toHaveBeenNthCalledWith(1, "job-9");
    expect(props.onAutoAssign).toHaveBeenNthCalledWith(2, "job-9");
    expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  });

  it("hides the banner and disables auto-assign with nothing unassigned", () => {
    setup({ unassignedJob: null });
    expect(screen.queryByRole("region", { name: "Unassigned job" })).toBeNull();
    expect((screen.getByRole("button", { name: "Auto-assign (proposal)" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables Add visit with no technicians and calls it otherwise", () => {
    const props = setup();
    fireEvent.click(screen.getByRole("button", { name: "Add visit" }));
    expect(props.onAddVisit).toHaveBeenCalledTimes(1);
    cleanup();
    setup({ canAddVisit: false });
    expect((screen.getByRole("button", { name: "Add visit" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables both proposal buttons while auto-fit is running", () => {
    setup({ autoFitPending: true });
    expect((screen.getByRole("button", { name: "Finding fit..." }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Auto-assign (proposal)" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("DispatchLoadError", () => {
  it("shows the error and retries", () => {
    const onRetry = vi.fn();
    render(<DispatchLoadError message="Request failed (500)" onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Request failed (500)");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
