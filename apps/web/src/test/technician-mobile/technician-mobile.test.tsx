// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const JOB = "11111111-1111-4111-8111-111111111111";
const m = vi.hoisted(() => ({
  missing: false,
  issueFails: 0,
  calls: [] as Array<{ method: string; path: string; body?: unknown }>
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ jobId: "11111111-1111-4111-8111-111111111111" }),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() })
}));

vi.mock("@/src/lib/api", async (orig) => {
  const actual = await orig<typeof import("@/src/lib/api")>();
  const notFound = (method: string, path: string) =>
    new actual.ApiError(404, { error: "NOT_FOUND", message: `Route ${method}:${path} not found` } as never);
  const mobileJob = {
    id: "11111111-1111-4111-8111-111111111111",
    jobNumber: "J-1",
    title: "AC repair",
    status: "dispatched",
    recordVersion: "v1",
    onTheWayAt: "2026-10-27T14:00:00.000Z",
    checklist: []
  };
  const handle = async (method: string, path: string, body?: unknown) => {
    m.calls.push({ method, path, body });
    if (path.startsWith("/api/v1/mobile/")) {
      if (m.missing) throw notFound(method, path);
      if (path.endsWith("/issues")) {
        if (m.issueFails > 0) {
          m.issueFails -= 1;
          throw new actual.ApiError(500, { error: "INTERNAL_ERROR", message: "Server hiccup" } as never);
        }
        return { issue: { id: "i1" }, job: mobileJob };
      }
      if (path === "/api/v1/mobile/today") return { contractVersion: "1.0.0", date: "2026-10-27", technicianId: "t", jobs: [mobileJob] };
      return { job: mobileJob };
    }
    if (path.endsWith("/on-the-way")) return { notification: null };
    return {
      job: {
        id: "11111111-1111-4111-8111-111111111111",
        title: "AC repair",
        status: "dispatched",
        technicianId: null,
        scheduledStart: null,
        scheduledEnd: null,
        customer: { firstName: "Ana", lastName: "Lee", phone: null },
        property: null
      }
    };
  };
  return {
    ...actual,
    api: {
      get: (p: string) => handle("GET", p),
      post: (p: string, b: unknown) => handle("POST", p, b),
      patch: (p: string, b: unknown) => handle("PATCH", p, b),
      put: (p: string, b: unknown) => handle("PUT", p, b),
      delete: (p: string) => handle("DELETE", p)
    }
  };
});

import { OTWScreen } from "@/src/components/mobile/OTWScreen";
import { ReportIssuePanel } from "@/src/components/mobile/ReportIssuePanel";
import { isMobileRouteMissing, orderByToday, useMobileToday } from "@/src/hooks/technician-mobile.hooks";
import { ApiError } from "@/src/lib/api";

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  m.missing = false;
  m.issueFails = 0;
  m.calls = [];
});

describe("technician mobile hooks", () => {
  it("detects a missing route (Fastify 404 / 501) but not a normal 404", () => {
    expect(isMobileRouteMissing(new ApiError(404, { error: "NOT_FOUND", message: "Route GET:/api/v1/mobile/today not found" } as never))).toBe(true);
    expect(isMobileRouteMissing(new ApiError(501, { error: "NOT_IMPLEMENTED", message: "x" } as never))).toBe(true);
    expect(isMobileRouteMissing(new ApiError(404, { error: "NOT_FOUND", message: "Job not found" } as never))).toBe(false);
    expect(isMobileRouteMissing(new TypeError("Failed to fetch"))).toBe(false);
  });

  it("useMobileToday reports the route as missing without retrying", async () => {
    m.missing = true;
    const { result } = renderHook(() => useMobileToday(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isMobileRouteMissing(result.current.error)).toBe(true);
    expect(m.calls.filter((c) => c.path === "/api/v1/mobile/today")).toHaveLength(1);
  });

  it("orders list records by the Today route order and counts unmatched jobs", () => {
    const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(orderByToday([{ id: "c" }, { id: "x" }, { id: "a" }], list)).toEqual({ jobs: [{ id: "c" }, { id: "a" }], unmatched: 1 });
  });
});

describe("OTW screen", () => {
  it("marks on my way without texting via the mobile route with recordVersion", async () => {
    render(<OTWScreen />, { wrapper });
    const button = await screen.findByRole("button", { name: "Mark on my way without texting" });
    expect(await screen.findByText(/On the way since/)).toBeTruthy();
    fireEvent.click(button);
    await waitFor(() =>
      expect(m.calls).toContainEqual({
        method: "POST",
        path: `/api/v1/mobile/jobs/${JOB}/on-the-way`,
        body: { estimatedArrivalMinutes: 15, recordVersion: "v1" }
      })
    );
  });

  it("hides the button when the mobile route is missing", async () => {
    m.missing = true;
    render(<OTWScreen />, { wrapper });
    expect(await screen.findByRole("button", { name: "Send On My Way" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("button", { name: "Mark on my way without texting" })).toBeNull());
  });
});

describe("Report issue panel", () => {
  function fill() {
    fireEvent.change(screen.getByLabelText("Details"), { target: { value: "Gate locked" } });
  }

  it("sends the report and closes", async () => {
    const onClose = vi.fn();
    render(<ReportIssuePanel jobId={JOB} onClose={onClose} />, { wrapper });
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(m.calls.find((c) => c.path.endsWith("/issues"))?.body).toMatchObject({ category: "access", severity: "medium", description: "Gate locked" });
  });

  it("shows an error with Retry, and Retry resends", async () => {
    m.issueFails = 1;
    const onClose = vi.fn();
    render(<ReportIssuePanel jobId={JOB} onClose={onClose} />, { wrapper });
    fill();
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Server hiccup");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(m.calls.filter((c) => c.path.endsWith("/issues"))).toHaveLength(2);
  });

  it("degrades to a notice when the route is missing", async () => {
    m.missing = true;
    render(<ReportIssuePanel jobId={JOB} onClose={vi.fn()} />, { wrapper });
    expect(await screen.findByText(/Issue reporting isn.t available yet/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Send report" })).toBeNull();
  });
});
