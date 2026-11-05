// @vitest-environment happy-dom
import type { ReactNode } from "react";
import type { JobStatus } from "@fsm/types";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutate = vi.hoisted(() => vi.fn());
vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a> }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/src/hooks/jobs.hooks", () => ({ useTransitionJob: () => ({ mutateAsync: mutate, isPending: false }) }));
vi.mock("@/src/stores/toast.store", () => ({ showToast: vi.fn() }));

import { JobActionBar } from "./JobActionBar";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("technician closeout is an office handoff, not an invoice creation action", () => {
  it.each([
    ["completed", "Work record saved"],
    ["invoiced", "This job is invoiced"],
    ["paid", "This job is marked paid"]
  ] as const)("shows the correct %s state without financial actions", (status, message) => {
    render(<JobActionBar jobId="job-1" status={status} />);
    expect(screen.getByRole("status").textContent).toContain(message);
    expect(screen.getByRole("link", { name: "Back to today" }).getAttribute("href")).toBe("/mobile/jobs");
    expect(screen.queryByText("Create Invoice")).toBeNull();
    expect(document.querySelector('a[href^="/invoices"]')).toBeNull();
    expect(mutate).not.toHaveBeenCalled();
  });

  it.each(["scheduled", "dispatched", "in_progress"] satisfies JobStatus[])("preserves the existing %s workflow", (status) => {
    render(<JobActionBar jobId="job-1" status={status} />);
    expect(screen.queryByRole("status")).toBeNull();
    if (status === "in_progress") {
      expect(screen.getByRole("link", { name: "Complete job" }).getAttribute("href")).toBe("/mobile/jobs/job-1/complete");
    } else {
      expect(screen.getByRole("link", { name: "On the way" }).getAttribute("href")).toBe("/mobile/otw/job-1");
    }
  });
});
