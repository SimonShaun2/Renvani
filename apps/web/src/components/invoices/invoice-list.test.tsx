import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { InvoiceListRecord } from "@/src/hooks/invoices.hooks";
import { InvoiceKpiCards, InvoiceStatePill } from "./InvoiceListClient";
import { buildInvoiceKpis, getInvoiceRowState, isCompletePage, sumSucceededPayments } from "./invoice-list.utils";

const now = new Date(2026, 9, 27, 12, 0);
const day = (offset: number) => new Date(2026, 9, 27 + offset, 9, 30).toISOString();

function inv(partial: Partial<InvoiceListRecord>): InvoiceListRecord {
  return {
    id: "i", invoiceNumber: "INV-1", title: null, status: "sent", total: "100.00", amountPaid: "0.00",
    balanceDue: "100.00", dueAt: null, paidAt: null, customer: { id: "c", firstName: "A", lastName: "B" },
    createdAt: day(-20), ...partial
  };
}

describe("getInvoiceRowState", () => {
  it("maps frame states from list fields", () => {
    expect(getInvoiceRowState(inv({ status: "paid", balanceDue: "0" }), now)).toEqual({ label: "Paid", tone: "green" });
    expect(getInvoiceRowState(inv({ dueAt: day(0) }), now)).toEqual({ label: "Due today", tone: "amber" });
    expect(getInvoiceRowState(inv({ status: "overdue", dueAt: day(-14) }), now)).toEqual({ label: "Overdue 14 d", tone: "red" });
    expect(getInvoiceRowState(inv({ dueAt: day(3) }), now).label).toBe("Sent");
    expect(getInvoiceRowState(inv({ status: "draft" }), now).label).toBe("Draft");
  });
});

describe("KPIs", () => {
  const rows = [
    inv({ balanceDue: "50.00", dueAt: day(-10) }),
    inv({ status: "overdue", balanceDue: "30.00", dueAt: day(-3) }),
    inv({ status: "paid", balanceDue: "0.00" }),
    inv({ status: "draft", balanceDue: "999.00" })
  ];

  it("sums open balances and >7d overdue", () => {
    expect(buildInvoiceKpis(rows, now)).toEqual({
      outstanding: { total: 80, count: 2 },
      overdue7: { total: 50, count: 1 }
    });
    expect(sumSucceededPayments([{ amount: "10.50", status: "succeeded" }, { amount: "5", status: "failed" }])).toBe(10.5);
  });

  it("only treats a page as complete when total fits", () => {
    expect(isCompletePage({ data: [1, 2], total: 2 })).toBe(true);
    expect(isCompletePage({ data: [1, 2], total: 140 })).toBe(false);
    expect(isCompletePage(undefined)).toBe(false);
  });

  it("renders neutral placeholders when data is partial", () => {
    const html = renderToStaticMarkup(
      <InvoiceKpiCards invoices={rows} invoicesComplete={false} collected={null} now={now} />
    );
    expect(html).toContain("Collected · Oct");
    expect(html).toContain("Overdue &gt; 7 days");
    expect(html).toContain("Not available yet");
    expect(html).not.toContain("$80");
  });

  it("renders exact totals when complete", () => {
    const html = renderToStaticMarkup(
      <InvoiceKpiCards invoices={rows} invoicesComplete collected={{ total: 1200, count: 3 }} now={now} />
    );
    expect(html).toContain("$1,200");
    expect(html).toContain("$80");
    expect(html).toContain("$50");
    expect(renderToStaticMarkup(<InvoiceStatePill state={{ label: "Paid", tone: "green" }} />)).toContain("Paid");
  });
});
