import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/src/lib/api";

const toast = vi.fn();
vi.mock("@/src/stores/toast.store", () => ({ showToast: (...a: unknown[]) => toast(...a) }));
vi.mock("@/src/components/ui/SkeletonCard", () => ({ SkeletonCard: () => <div data-testid="skeleton" /> }));
vi.mock("@/src/hooks/imports.hooks", () => ({ useImportSession: () => ({ data: undefined }) }));

const state = vi.hoisted(() => ({ isPending: false, isSuccess: false, isError: false, fail: null as unknown, calls: 0 }));
vi.mock("@/src/hooks/migrate-onboarding.hooks", () => ({
  uploadImportFileForMigrate: vi.fn(),
  useMigrateOnboardingSources: () => ({ data: { sources: [] }, isLoading: false }),
  useSetMigrateOnboardingSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useLinkMigrateOnboardingFiles: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateMigrateOnboardingSession: () => ({
    isPending: state.isPending,
    isSuccess: state.isSuccess,
    isError: state.isError,
    reset: () => {
      state.isError = false;
    },
    mutate: (_v: unknown, opts: { onError: (e: unknown) => void }) => {
      state.calls += 1;
      state.isError = true;
      opts.onError(state.fail);
    }
  })
}));

import { MigrateOnboardingStepsOneTwo, shouldAutoRetryStart } from "./MigrateOnboardingStepsOneTwo";

describe("shouldAutoRetryStart", () => {
  it("retries network/5xx at most twice, never 4xx", () => {
    expect(shouldAutoRetryStart(new TypeError("Failed to fetch"), 0)).toBe(true);
    expect(shouldAutoRetryStart(new ApiError(503, { message: "down" } as never), 1)).toBe(true);
    expect(shouldAutoRetryStart(new TypeError("Failed to fetch"), 2)).toBe(false);
    expect(shouldAutoRetryStart(new ApiError(403, { message: "no" } as never), 0)).toBe(false);
  });
});

describe("MigrateOnboardingStepsOneTwo start failure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(state, { isPending: false, isSuccess: false, isError: false, calls: 0, fail: new TypeError("Failed to fetch") });
    toast.mockReset();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("caps retries, shows one inline error with Retry, and no toasts", async () => {
    const { rerender } = render(<MigrateOnboardingStepsOneTwo bundle={null} onRefresh={vi.fn()} />);
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      rerender(<MigrateOnboardingStepsOneTwo bundle={null} onRefresh={vi.fn()} />);
    }
    expect(state.calls).toBe(3);
    expect(screen.getAllByTestId("migrate-start-error")).toHaveLength(1);
    expect(toast).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    });
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        vi.advanceTimersByTime(5000);
      });
      rerender(<MigrateOnboardingStepsOneTwo bundle={null} onRefresh={vi.fn()} />);
    }
    expect(state.calls).toBe(6);
    expect(screen.getAllByTestId("migrate-start-error")).toHaveLength(1);
  });

  it("does not auto-retry a 4xx", async () => {
    state.fail = new ApiError(403, { message: "Forbidden" } as never);
    render(<MigrateOnboardingStepsOneTwo bundle={null} onRefresh={vi.fn()} />);
    await act(async () => {
      vi.advanceTimersByTime(10000);
    });
    expect(state.calls).toBe(1);
    expect(screen.getByTestId("migrate-start-error").textContent).toContain("Forbidden");
  });
});
