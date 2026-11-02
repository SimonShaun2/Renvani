import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NEW_JOB_FIELDS,
  addLineItem,
  buildCreateJobPayload,
  emptyNewJobValues,
  lineItemsSubtotal,
  newJobServiceFeeLabel,
  parseNewJobQuery,
  saveJobLineItems,
  toAddJobProductInput,
  validateNewJob
} from "./newJob.config";

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
const hooks = vi.hoisted(() => ({
  createState: { isPending: false, isError: false },
  unavailableCustomerIds: new Set<string>()
}));
vi.mock("@/src/hooks/jobs.hooks", () => ({
  useCreateJob: () => ({ mutate, ...hooks.createState }),
  useJobsList: () => ({ data: { data: [], total: 0, totalPages: 1 }, isLoading: false, isError: false })
}));
vi.mock("@/src/hooks/customers.hooks", () => ({
  useCustomer: (id: string | null) => ({
    data: id && !hooks.unavailableCustomerIds.has(id)
      ? { customer: { id, firstName: "Dana", lastName: "Whitfield", displayName: null, phone: "555-0100", email: null } }
      : undefined,
    isError: Boolean(id && hooks.unavailableCustomerIds.has(id)),
    isLoading: false,
    isPending: false,
    isSuccess: Boolean(id && !hooks.unavailableCustomerIds.has(id))
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
const apiPost = vi.fn();
vi.mock("@/src/lib/api", () => ({ api: { post: (...a: unknown[]) => apiPost(...a) } }));
vi.mock("@/src/hooks/price-book.hooks", () => ({
  usePriceBookItemSearch: (q: string) => ({
    data: q ? { items: [{ priceBookItemId: "pb1", name: "Furnace tune-up", description: null, unitPrice: "129.00", isTaxable: true, itemType: "service" }, { priceBookItemId: "pb2", name: "Air filter", description: null, unitPrice: "18.00", isTaxable: true, itemType: "material" }] } : undefined
  })
}));
const connectState = vi.hoisted(() => ({ fee: 2 as number | null }));
vi.mock("@/src/hooks/stripe-connect.hooks", () => ({
  useStripeConnectStatus: () => ({ data: { platformFeePercent: connectState.fee } })
}));
vi.mock("@/src/hooks/technicians.hooks", () => ({
  useTechnicians: () => ({ data: { data: [{ id: "t1", firstName: "Marco", lastName: "R." }] } })
}));

import { NewJobPanel } from "./NewJobPanel";

describe("validateNewJob", () => {
  it("requires customer and job type with frame copy", () => {
    const errors = validateNewJob(emptyNewJobValues());
    expect(errors.customerId).toBe("Required");
    expect(errors.type).toBe("Required");
  });

  it("orders fields per frame 160:32", () => {
    expect(NEW_JOB_FIELDS.map((f) => f.label)).toEqual([
      "Customer",
      "Service address",
      "Job type / service",
      "Description",
      "Scheduled (optional)",
      "Priority",
      "Ends",
      "Assigned crew / van (optional)"
    ]);
  });

  it("requires both schedule ends and end after start", () => {
    const base = { ...emptyNewJobValues("c1"), type: "maintenance" };
    expect(validateNewJob({ ...base, scheduledStart: "2026-10-29T10:00" }).scheduledEnd).toBe("Add an end time");
    expect(validateNewJob({ ...base, scheduledEnd: "2026-10-29T10:00" }).scheduledStart).toBe("Add a start time");
    expect(validateNewJob({ ...base, scheduledStart: "2026-10-29T10:00", scheduledEnd: "2026-10-29T09:00" }).scheduledEnd).toBe(
      "End must be after start"
    );
    expect(validateNewJob({ ...base, scheduledStart: "2026-10-29T10:00", scheduledEnd: "2026-10-29T12:00" })).toEqual({});
  });

  it("rejects unknown type/priority and long descriptions", () => {
    const errors = validateNewJob({ ...emptyNewJobValues("c1"), description: "x".repeat(2001), type: "bogus", priority: "nope" });
    expect(errors.description).toMatch(/2000 characters/);
    expect(errors.type).toBeDefined();
    expect(errors.priority).toBeDefined();
  });
});

describe("buildCreateJobPayload", () => {
  it("derives the API title from description, else job type", () => {
    expect(buildCreateJobPayload({ ...emptyNewJobValues(" c1 "), type: "maintenance" })).toEqual({
      customerId: "c1",
      title: "Maintenance",
      type: "maintenance",
      priority: "normal"
    });
    const full = buildCreateJobPayload({
      ...emptyNewJobValues("c1"),
      propertyId: "p1",
      technicianId: "t1",
      type: "maintenance",
      priority: "high",
      scheduledStart: "2026-10-29T10:00",
      scheduledEnd: "2026-10-29T12:00",
      description: " Blower stops \nsecond line"
    });
    expect(full).toMatchObject({ title: "Blower stops", propertyId: "p1", technicianId: "t1", priority: "high" });
    expect(full.scheduledStart).toBe(new Date("2026-10-29T10:00").toISOString());
    expect(full.scheduledEnd).toBe(new Date("2026-10-29T12:00").toISOString());
  });
});

describe("line items and fee", () => {
  const seed = { priceBookItemId: "pb1", name: "Air filter", description: null, unitPrice: "18.00", isTaxable: true, itemType: "material" as const };
  it("adds, bumps quantity and sums", () => {
    const items = addLineItem(addLineItem([], seed), seed);
    expect(items).toHaveLength(1);
    expect(items[0]!.quantity).toBe(2);
    expect(lineItemsSubtotal([...items, { ...items[0]!, priceBookItemId: "x", unitPrice: 129, quantity: 1 }])).toBe(165);
    expect(toAddJobProductInput(items[0]!)).toEqual({ name: "Air filter", quantity: 2, unitPrice: 18, isTaxable: true });
  });
  it("Service Fee label only on Flex; hidden on Flat/none", () => {
    expect(newJobServiceFeeLabel(2)).toBe("Service Fee (2%) · paid by customer at checkout");
    expect(newJobServiceFeeLabel(0)).toBeNull();
    expect(newJobServiceFeeLabel(null)).toBeNull();
    expect(newJobServiceFeeLabel(2)).not.toMatch(/1\.99|booking/i);
  });
});

describe("parseNewJobQuery", () => {
  it("opens with a preselected customer", () => {
    expect(parseNewJobQuery({ new: "1", customerId: "c1" })).toEqual({ open: true, customerId: "c1" });
    expect(parseNewJobQuery({ customerId: "c1" })).toEqual({ open: false, customerId: "c1" });
    expect(parseNewJobQuery({ new: "1", customerId: "../x" })).toEqual({ open: true, customerId: "" });
    expect(parseNewJobQuery({ new: ["1"], customerId: ["c2", "c3"] })).toEqual({ open: true, customerId: "c2" });
    expect(parseNewJobQuery({ new: "1", customerId: "x".repeat(65) })).toEqual({ open: true, customerId: "" });
    expect(parseNewJobQuery({ new: "1", customerId: "c1?new=1" })).toEqual({ open: true, customerId: "" });
  });
});

describe("NewJobPanel", () => {
  beforeEach(() => {
    mutate.mockReset();
    push.mockReset();
    apiPost.mockReset();
    connectState.fee = 2;
    hooks.createState = { isPending: false, isError: false };
    hooks.unavailableCustomerIds.clear();
  });
  afterEach(() => cleanup());

  it("preselects the customer and autofills its only address", () => {
    render(<NewJobPanel initialCustomerId="c1" />);
    expect(screen.getByTestId("new-job-customer").textContent).toContain("Dana Whitfield");
    expect(screen.getByText("Preselected when opened from a customer profile")).toBeTruthy();
    expect((screen.getByLabelText("Service address") as HTMLSelectElement).value).toBe("p1");
    expect(screen.getByText("Autofilled — customer has one address")).toBeTruthy();
    expect(screen.getByTestId("new-job-number").textContent).toBe("Job # assigned on create");
  });

  it("shows the frame 160:102 error state and does not submit", () => {
    render(<NewJobPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    expect(screen.getByRole("alert").textContent).toBe("Add a customer and job type to continue.");
    expect(screen.getAllByText("Required")).toHaveLength(2);
    expect(screen.getByLabelText("Job type / service").getAttribute("aria-invalid")).toBe("true");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("uses a single column below sm and two from sm", () => {
    const { container } = render(<NewJobPanel />);
    const form = container.querySelector("form")!;
    expect(form.className).toContain("grid-cols-1");
    expect(form.className).toContain("sm:grid-cols-2");
    expect(form.className).not.toMatch(/(^| )grid-cols-2/);
  });

  it("adds price-book items, shows subtotal and fee line, posts items after create", async () => {
    apiPost.mockResolvedValue({});
    mutate.mockImplementation(async (_payload, opts: { onSuccess: (d: unknown) => Promise<void> }) => opts.onSuccess({ job: { id: "j42" } }));
    render(<NewJobPanel initialCustomerId="c1" />);
    expect(screen.getByText("No items yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "+ Add item from price book" }));
    fireEvent.change(screen.getByLabelText("Search price book"), { target: { value: "furn" } });
    fireEvent.click(screen.getByRole("button", { name: /Furnace tune-up/ }));
    const totals = screen.getByTestId("new-job-totals").textContent ?? "";
    expect(totals).toContain("$129.00");
    expect(totals).toContain("Service Fee (2%) · paid by customer at checkout");
    expect(totals).not.toMatch(/1\.99/);
    fireEvent.change(screen.getByLabelText("Job type / service"), { target: { value: "maintenance" } });
    fireEvent.change(screen.getByLabelText("Assigned crew / van (optional)"), { target: { value: "t1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    });
    expect(mutate).toHaveBeenCalledWith(
      { customerId: "c1", propertyId: "p1", technicianId: "t1", title: "Maintenance", type: "maintenance", priority: "normal" },
      expect.any(Object)
    );
    expect(apiPost).toHaveBeenCalledWith("/api/v1/jobs/j42/products", { name: "Furnace tune-up", quantity: 1, unitPrice: 129, isTaxable: true });
    expect(push).toHaveBeenCalledWith("/jobs/j42");
  });

  it("stays on the panel when a line item fails and retries only failed items without a second job", async () => {
    let furnaceFails = true;
    apiPost.mockImplementation((_path: string, body: { name: string }) => {
      if (body.name === "Furnace tune-up" && furnaceFails) {
        furnaceFails = false;
        return Promise.reject(new Error("500"));
      }
      return Promise.resolve({});
    });
    mutate.mockImplementation(async (_payload, opts: { onSuccess: (d: unknown) => void }) => opts.onSuccess({ job: { id: "j42" } }));
    render(<NewJobPanel initialCustomerId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add item from price book" }));
    fireEvent.change(screen.getByLabelText("Search price book"), { target: { value: "furn" } });
    fireEvent.click(screen.getByRole("button", { name: /Furnace tune-up/ }));
    if (!screen.queryByLabelText("Search price book")) fireEvent.click(screen.getByRole("button", { name: "+ Add item from price book" }));
    fireEvent.change(screen.getByLabelText("Search price book"), { target: { value: "air" } });
    fireEvent.click(screen.getByRole("button", { name: /Air filter/ }));
    fireEvent.change(screen.getByLabelText("Job type / service"), { target: { value: "maintenance" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Create job" }));
    });
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("couldn't be saved");
    expect(screen.getByRole("alert").textContent).toContain("Job created. Retry saving the failed items.");
    expect((screen.getByTestId("new-job-editor") as HTMLFieldSetElement).disabled).toBe(true);
    expect((screen.getByLabelText("Job type / service").closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    expect((screen.getByLabelText("Assigned crew / van (optional)").closest("fieldset") as HTMLFieldSetElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Create job" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Retry failed items" }) as HTMLButtonElement).disabled).toBe(false);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Retry failed items" }));
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(apiPost).toHaveBeenCalledTimes(3);
    expect(apiPost.mock.calls.filter(([, b]) => (b as { name: string }).name === "Air filter")).toHaveLength(1);
    expect(apiPost).toHaveBeenLastCalledWith("/api/v1/jobs/j42/products", { name: "Furnace tune-up", quantity: 1, unitPrice: 129, isTaxable: true });
    expect(push).toHaveBeenCalledWith("/jobs/j42");
  });

  it("saveJobLineItems returns only the failed items", async () => {
    const a = { priceBookItemId: "a", name: "A", description: null, unitPrice: 1, quantity: 1, isTaxable: true, itemType: "service" };
    const b = { ...a, priceBookItemId: "b", name: "B" };
    const post = vi.fn((_p: string, body: { name?: string }) => (body.name === "B" ? Promise.reject(new Error("x")) : Promise.resolve({})));
    const failed = await saveJobLineItems("j1", [a, b] as never, post);
    expect(failed.map((i) => i.name)).toEqual(["B"]);
  });

  it("hides the Service Fee line on Flat", () => {
    connectState.fee = 0;
    render(<NewJobPanel initialCustomerId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add item from price book" }));
    fireEvent.change(screen.getByLabelText("Search price book"), { target: { value: "furn" } });
    fireEvent.click(screen.getByRole("button", { name: /Furnace tune-up/ }));
    expect(screen.getByTestId("new-job-totals").textContent).not.toContain("Service Fee");
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
