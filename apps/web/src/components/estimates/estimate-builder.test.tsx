import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/components/jobs/ProductCatalogPicker", () => ({ ProductCatalogPicker: () => null }));

import { EditableLineItemsTable } from "./EditableLineItemsTable";
import type { RevenueLineItemDraft } from "./estimates.utils";

import { EstimateChecksPanel, EstimateFrequencyOptions, EstimateTotalsCard } from "./EstimateFigmaPanels";
import { buildEstimateSubtitle, estimateApprovalPill, formatDiscountCheck, formatValidUntil } from "./estimate-builder.utils";

afterEach(() => cleanup());

describe("estimate builder utils (Figma 10:604)", () => {
  it("builds the header subtitle from real fields only", () => {
    expect(buildEstimateSubtitle({ estimateNumber: "EST-1043", customerName: "Dana Whitfield", address: "412 Pine St" })).toBe(
      "EST-1043 · Dana Whitfield · 412 Pine St"
    );
    expect(buildEstimateSubtitle({ estimateNumber: "EST-1", customerName: " ", address: null })).toBe("EST-1");
    expect(buildEstimateSubtitle({})).toBeNull();
  });

  it("maps status to the approval pill", () => {
    expect(estimateApprovalPill("draft").label).toBe("Needs approval");
    expect(estimateApprovalPill("approved").tone).toBe("green");
    expect(estimateApprovalPill("declined").tone).toBe("red");
  });

  it("formats valid-until and discount without inventing data", () => {
    expect(formatValidUntil(null)).toBe("—");
    expect(formatValidUntil("2026-10-28T17:00:00.000Z")).toBe("Oct 28");
    expect(formatDiscountCheck("0.00")).toBe("None");
    expect(formatDiscountCheck("21")).toBe("$21.00 off");
  });
});

describe("EstimateChecksPanel", () => {
  it("shows API-backed checks and neutral dashes for missing ones", () => {
    render(<EstimateChecksPanel status="draft" discountAmount="21.00" expiresAt="2026-10-28T17:00:00.000Z" />);
    expect(screen.getByText("Needs approval")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Checks before sending" })).toBeTruthy();
    expect(screen.getByText("$21.00 off")).toBeTruthy();
    expect(screen.getByText("Oct 28")).toBeTruthy();
    expect(screen.getAllByText(/— · Not available yet/)).toHaveLength(4);
    expect(screen.queryByText(/5%/)).toBeNull();
  });

  it("hides frequency options with neutral copy", () => {
    render(<EstimateFrequencyOptions />);
    expect(screen.getByText(/Visit frequency options aren't available yet/)).toBeTruthy();
    expect(screen.queryByText(/\/ visit/)).toBeNull();
  });
});

const line = (over: Partial<RevenueLineItemDraft>): RevenueLineItemDraft =>
  ({
    localId: "l1",
    name: "Maintenance plan",
    description: "",
    itemType: "service",
    quantity: "2",
    unitPrice: "93.50",
    isTaxable: true,
    sortOrder: 0,
    ...over
  }) as RevenueLineItemDraft;

function renderTable(props: Partial<React.ComponentProps<typeof EditableLineItemsTable>> = {}) {
  const onChange = vi.fn();
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <EditableLineItemsTable title="Line Items" items={[line({})]} onChange={onChange} variant="frame" {...props} />
    </QueryClientProvider>
  );
  return onChange;
}

describe("EditableLineItemsTable frame layout (10:676)", () => {
  it("renders Line item / Detail / Qty / Price with real values and a dash for missing detail", () => {
    renderTable({ readOnly: true, discountAmount: 21 });
    const headers = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(headers).toEqual(["Line item", "Detail", "Qty", "Price"]);
    expect(screen.getByText("Maintenance plan")).toBeTruthy();
    expect(screen.getAllByText("—", { selector: "td" })).toHaveLength(2);
    expect(screen.getByText("$187.00")).toBeTruthy();
    expect(screen.getByText("−$21.00")).toBeTruthy();
  });

  it("keeps editing: change qty and remove a line", () => {
    const onChange = renderTable();
    fireEvent.change(screen.getByLabelText("Qty"), { target: { value: "3" } });
    expect(onChange.mock.calls[0]?.[0][0].quantity).toBe("3");
    fireEvent.click(screen.getByRole("button", { name: "Remove Maintenance plan" }));
    expect(onChange.mock.calls[1]?.[0]).toEqual([]);
    expect(screen.getByRole("button", { name: /Add from catalog/ })).toBeTruthy();
  });
});

describe("EstimateTotalsCard (10:707)", () => {
  it("shows only exact totals, no per-visit or monthly figures", () => {
    render(<EstimateTotalsCard subtotal={187} taxAmount={15.43} taxRate={0.0825} discountAmount={21} total={181.43} />);
    expect(screen.getByText("Tax (8.25%)")).toBeTruthy();
    expect(screen.getByText("−$21.00")).toBeTruthy();
    expect(screen.getByText("$181.43")).toBeTruthy();
    expect(screen.queryByText(/Per visit|Est. monthly|First visit/)).toBeNull();
  });
});
