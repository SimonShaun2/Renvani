import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildCreateJobPayload, emptyNewJobValues, parseNewJobQuery, validateNewJob } from "./newJob.config";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}));

const mutate = vi.fn();
const hooks = vi.hoisted(() => ({ createState: { isPending: false, isError: false } }));
vi.mock("@/src/hooks/jobs.hooks", () => ({
  useCreateJob: () => ({ mutate, ...hooks.createState }),
  useJobsList: () => ({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false, isError: false })
}));
vi.mock("@/src/hooks/customers.hooks", () => ({
  useCustomer: (id: string | null) => ({
    data: id ? { customer: { id, firstName: "Dana", lastName: "Whitfield", displayName: null, phone: "555-0100", email: null } } : undefined,
    isError: false
  }),
  useCustomerProperties: (id: string | null) => ({
    data: id ? { properties: [{ id: "p1", addressLine1: "1842 Aspen Ridge Dr", city: "Denver", state: "CO" }] } : undefined,
    isSuccess: Boolean(id)
  })
}));
vi.mock("@/src/hooks/dispatch.hooks", () => ({
  useCustomerSearch: (q: string) => ({
    data: q.length >= 2 ? { customers: [{ id: "c9", firstName: "Grace", lastName: "Lin", displayName: null, email: null, phone: null }] } : undefined
  })
}));
vi.mock("@/src/hooks/technicians.hooks", () => ({
  useTechnicians: () => ({ data: { data: [{ id: "t1", firstName: "Marco", lastName: "R." }] } })
}));

import { NewJobPanel } from "./NewJobPanel";

describe("validateNewJob", () => {
  it("requires customer and service", () => {
    const errors = validateNewJob(emptyNewJobValues());
    expect(errors.customerId).toBe("Customer is required");
    expect(errors.title).toBe("Service is required");
  });

  it("requires both schedule ends and end after start", () => {
    const base = { ...emptyNewJobValues("c1"), title: "Tune-up" };
    expect(validateNewJob({ ...base, scheduledStart: "2026-10-29T10:00" }).scheduledEnd).toBe("Add an end time");
    expect(validateNewJob({ ...base, scheduledEnd: "2026-10-29T10:00" }).scheduledStart).toBe("Add a start time");
    expect(validateNewJob({ ...base, scheduledStart: "2026-10-29T10:00", scheduledEnd: "2026-10-29T09:00" }).scheduledEnd).toBe(
      "End must be after start"
    );
    expect(validateNewJob({ ...base, scheduledStart: "2026-10-29T10:00", scheduledEnd: "2026-10-29T12:00" })).toEqual({});
  });

  it("enforces max length and known type/priority", () => {
    const errors = validateNewJob({ ...emptyNewJobValues("c1"), title: "x".repeat(201), type: "bogus", priority: "nope" });
    expect(errors.title).toMatch(/200 characters/);
    expect(errors.type).toBeDefined();
    expect(errors.priority).toBeDefined();
  });
});

describe("buildCreateJobPayload", () => {
  it("sends only filled fields, trimmed, with ISO schedule", () => {
    expect(buildCreateJobPayload({ ...emptyNewJobValues(" c1 "), title: "  No-heat diagnostic " })).toEqual({
      customerId: "c1",
      title: "No-heat diagnostic",
      type: "service_call",
      priority: "normal"
    });
    const full = buildCreateJobPayload({
      ...emptyNewJobValues("c1"),
      title: "Tune-up",
      propertyId: "p1",
      technicianId: "t1",
      type: "maintenance",
      priority: "high",
      scheduledStart: "2026-10-29T10:00",
      scheduledEnd: "2026-10-29T12:00",
      description: " Blower stops "
    });
    expect(full).toMatchObject({ propertyId: "p1", technicianId: "t1", type: "maintenance", priority: "high", description: "Blower stops" });
    expect(full.scheduledStart).toBe(new Date("2026-10-29T10:00").toISOString());
    expect(full.scheduledEnd).toBe(new Date("2026-10-29T12:00").toISOString());
  });
});

describe("parseNewJobQuery", () => {
  it("opens with a preselected customer", () => {
    expect(parseNewJobQuery({ new: "1", customerId: "c1" })).toEqual({ open: true, customerId: "c1" });
    expect(parseNewJobQuery({ customerId: "c1" })).toEqual({ open: false, customerId: "c1" });
    expect(parseNewJobQuery({ new: "1", customerId: "../x" })).toEqual({ open: true, customerId: "" });
    expect(parseNewJobQuery({ new: ["1"], customerId: ["c2", "c3"] })).toEqual({ open: true, customerId: "c2" });
  });
});

describe("NewJobPanel", () => {
  beforeEach(() => {
    mutate.mockReset();
    push.mockReset();
    hooks.createState = { isPending: false, isError: false };
  });
  afterEach(() => cleanup());

  it("preselects the customer from the query and its only address", () => {
    render(<NewJobPanel initialCustomerId="c1" />);
    expect(screen.getByTestId("new-job-customer").textContent).toContain("Dana Whitfield");
    expect((screen.getByLabelText("Service address") as HTMLSelectElement).value).toBe("p1");
  });

  it("shows validation errors and does not submit", () => {
    render(<NewJobPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByText("Customer is required")).toBeTruthy();
    expect(screen.getByText("Service is required")).toBeTruthy();
    expect(mutate).not.toHaveBeenCalled();
  });

  it("submits the payload and opens the new job", async () => {
    mutate.mockImplementation((_payload, opts: { onSuccess: (d: unknown) => void }) => opts.onSuccess({ job: { id: "j42" } }));
    render(<NewJobPanel initialCustomerId="c1" />);
    fireEvent.change(screen.getByLabelText(/Service \*/), { target: { value: "No-heat diagnostic" } });
    fireEvent.change(screen.getByLabelText("Tech"), { target: { value: "t1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    });
    expect(mutate).toHaveBeenCalledWith(
      { customerId: "c1", propertyId: "p1", technicianId: "t1", title: "No-heat diagnostic", type: "service_call", priority: "normal" },
      expect.any(Object)
    );
    expect(push).toHaveBeenCalledWith("/jobs/j42");
  });

  it("picks a customer from search", () => {
    render(<NewJobPanel />);
    fireEvent.change(screen.getByLabelText(/Customer/), { target: { value: "Gr" } });
    fireEvent.click(screen.getByRole("button", { name: /Grace Lin/ }));
    expect(screen.getByTestId("new-job-customer")).toBeTruthy();
  });

  it("shows the submit error banner", () => {
    hooks.createState = { isPending: false, isError: true };
    render(<NewJobPanel initialCustomerId="c1" />);
    expect(screen.getByRole("alert").textContent).toContain("couldn't create the job");
  });
});
