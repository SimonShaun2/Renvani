import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { JobDetail, JobProduct } from "@fsm/types";

const hookState = vi.hoisted(() => ({
  invoices: [] as Array<{ id: string; invoiceNumber: string }>,
  stripe: { chargesEnabled: true, renvaniPlanTier: "flex", platformFeePercent: 2 } as Record<string, unknown> | undefined
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/src/hooks/invoices.hooks", () => ({
  useInvoices: () => ({ data: { data: hookState.invoices } }),
  useCreateInvoice: () => ({ mutateAsync: vi.fn(), isPending: false })
}));
vi.mock("@/src/hooks/stripe-connect.hooks", () => ({ useStripeConnectStatus: () => ({ data: hookState.stripe }) }));
vi.mock("@/src/hooks/price-book.hooks", () => ({ usePriceBookItemSearch: () => ({ data: undefined }) }));

import { CreateInvoiceAction } from "./CreateInvoiceAction";
import { CreateInvoicePanel } from "./CreateInvoicePanel";
import {
  buildCreateInvoicePayload,
  computeInvoiceTotals,
  linesFromJobProducts,
  resolveCreateInvoiceButtonState,
  validateCreateInvoice,
  type DraftLine
} from "./create-invoice.utils";

const product = (id: string, name: string, unitPrice: string, isTaxable = true): JobProduct =>
  ({ id, name, quantity: "1", unitPrice, total: unitPrice, isTaxable, category: "service" }) as unknown as JobProduct;
const products = [product("p1", "No-heat diagnostic", "129.00"), product("p2", "Flame sensor", "85.00"), product("p3", "Filter", "24.00")];
const job = (status = "completed", customerId: string | null = "c1") =>
  ({ id: "j1", jobNumber: "J-1", title: "Diag", status, customerId, customer: { firstName: "Dana", lastName: "W" }, property: null }) as unknown as JobDetail;

describe("resolveCreateInvoiceButtonState (291:3574)", () => {
  const base = { hasCustomer: true, chargesEnabled: true, existingInvoiceId: null };
  it("maps statuses", () => {
    expect(resolveCreateInvoiceButtonState({ ...base, status: "completed" })).toBe("primary");
    expect(resolveCreateInvoiceButtonState({ ...base, status: "in_progress" })).toBe("secondary");
    expect(resolveCreateInvoiceButtonState({ ...base, status: "scheduled" })).toBe("secondary");
    expect(resolveCreateInvoiceButtonState({ ...base, status: "cancelled" })).toBe("hidden");
    expect(resolveCreateInvoiceButtonState({ ...base, status: "completed", existingInvoiceId: "i1" })).toBe("view");
    expect(resolveCreateInvoiceButtonState({ ...base, status: "completed", hasCustomer: false })).toBe("disabled");
    expect(resolveCreateInvoiceButtonState({ ...base, status: "completed", chargesEnabled: false })).toBe("disabled");
  });

  it("renders view link, disabled tooltip, and hidden", () => {
    hookState.invoices = [{ id: "i9", invoiceNumber: "INV-9" }];
    expect(renderToStaticMarkup(<CreateInvoiceAction job={job()} products={products} taxRate={null} />)).toContain("View invoice INV-9");
    hookState.invoices = [];
    hookState.stripe = { chargesEnabled: false };
    const disabled = renderToStaticMarkup(<CreateInvoiceAction job={job()} products={products} taxRate={null} />);
    expect(disabled).toContain("disabled");
    expect(disabled).toContain("Finish payments setup to send invoices");
    expect(disabled).toContain("/settings/payments");
    hookState.stripe = { chargesEnabled: true, renvaniPlanTier: "flex", platformFeePercent: 2 };
    expect(renderToStaticMarkup(<CreateInvoiceAction job={job("cancelled")} products={products} taxRate={null} />)).toBe("");
    expect(renderToStaticMarkup(<CreateInvoiceAction job={job()} products={products} taxRate={null} />)).toContain('data-state="primary"');
  });
});

describe("computeInvoiceTotals", () => {
  const lines = linesFromJobProducts(products);
  it("charges the 2% Service Fee on the total after tax (Flex)", () => {
    const totals = computeInvoiceTotals({ lines, taxRate: 0.0825, discount: 0, plan: "flex", feePercent: 2 });
    expect(totals).toEqual({ subtotal: 238, tax: 19.64, discount: 0, serviceFee: 5.15, total: 262.79 });
  });
  it("has no fee on Flat and no tax when the shop has none", () => {
    const totals = computeInvoiceTotals({ lines, taxRate: null, discount: 0, plan: "flat", feePercent: 0 });
    expect(totals.serviceFee).toBeNull();
    expect(totals.tax).toBeNull();
    expect(totals.total).toBe(238);
  });
  it("only counts included, taxable lines for tax", () => {
    const mixed = linesFromJobProducts([product("a", "A", "100", false), product("b", "B", "100")]);
    mixed[0]!.include = true;
    const totals = computeInvoiceTotals({ lines: mixed, taxRate: 0.1, discount: 0, plan: null, feePercent: 2 });
    expect(totals.tax).toBe(10);
    expect(totals.serviceFee).toBeNull();
  });
});

describe("panel", () => {
  const props = { job: job(), products, taxRate: 0.0825, feePercent: 2, paymentsReady: true, confirmIncomplete: false, onClose: () => {} };
  it("shows the Service Fee line on Flex only", () => {
    const flex = renderToStaticMarkup(<CreateInvoicePanel {...props} plan="flex" />);
    expect(flex).toContain("Service Fee (2%) · paid by customer at checkout");
    expect(flex).toContain("$262.79");
    const flat = renderToStaticMarkup(<CreateInvoicePanel {...props} plan="flat" />);
    expect(flat).not.toContain("Service Fee");
    expect(flat).toContain("$257.64");
  });
  it("shows payments-not-set-up linking to setup", () => {
    const html = renderToStaticMarkup(<CreateInvoicePanel {...props} plan="flex" paymentsReady={false} />);
    expect(html).toContain('data-testid="payments-not-set-up"');
    expect(html).toContain("/settings/payments");
    expect(html).not.toContain("UNIT PRICE");
  });
  it("asks to confirm when the job isn't complete", () => {
    expect(renderToStaticMarkup(<CreateInvoicePanel {...props} plan="flex" confirmIncomplete />)).toContain('data-testid="confirm-incomplete"');
  });
});

describe("validation and payload", () => {
  it("flags zero qty, no items, and past due date", () => {
    const lines = linesFromJobProducts(products);
    lines[1]!.quantity = "0";
    const errors = validateCreateInvoice(lines, "2026-10-20", "2026-10-29");
    expect(errors.lines.p2).toBe("Quantity and price must be more than 0");
    expect(errors.dueAt).toBe("Due date can't be in the past");
    const none = validateCreateInvoice(lines.map((l): DraftLine => ({ ...l, include: false })), "", "2026-10-29");
    expect(none.items).toBe("Add at least one item");
  });
  it("posts fromJobId + items[] from the job's products", () => {
    const lines = linesFromJobProducts(products);
    lines[2]!.include = false;
    const payload = buildCreateInvoicePayload({
      jobId: "j1", customerId: "c1", title: "Diag", lines, taxRate: 0.0825, discount: 0, dueDate: "", messageToCustomer: " Thanks ", internalNotes: ""
    });
    expect(payload).toEqual({
      customerId: "c1",
      fromJobId: "j1",
      title: "Diag",
      taxRate: 0.0825,
      messageToCustomer: "Thanks",
      items: [
        { name: "No-heat diagnostic", itemType: "service", quantity: 1, unitPrice: 129, isTaxable: true, sortOrder: 0 },
        { name: "Flame sensor", itemType: "service", quantity: 1, unitPrice: 85, isTaxable: true, sortOrder: 1 }
      ]
    });
  });
});
