import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SERVICE_FEE_RATE_BPS } from "@fsm/config/stripe-pricing";

import type { PublicPaymentLinkResponse } from "@/src/hooks/invoices.hooks";
import { PayInvoiceCheckoutBody, PayInvoicePaidCard } from "./PayInvoiceView";
import { buildPayInvoiceSummary, formatServiceFeeNote, resolvePayInvoiceState, resolveServiceFeeRateBps } from "./pay-invoice.utils";

function payment(partial: Partial<PublicPaymentLinkResponse> = {}): PublicPaymentLinkResponse {
  return {
    invoiceNumber: "INV-1042", paymentLinkUrl: "https://checkout.stripe.com/c/pay/cs_test_x", checkoutClientSecret: null,
    invoiceAmount: "240.00", platformFeeAmount: "6.79", totalDue: "246.79", platformFeePercent: 2,
    platformFeePaidByCustomer: true, platformFeeDisclosure: null, serviceFeeCents: 480, bookingFeeCents: 199,
    invoiceAmountCents: 24000, totalDueCents: 24679, ...partial
  };
}

const flat = () => payment({ platformFeePercent: null, serviceFeeCents: 0, platformFeeAmount: "1.99", totalDue: "241.99", totalDueCents: 24199 });

describe("pay invoice fee lines", () => {
  it("Flex shows a Service Fee line derived from SERVICE_FEE_RATE_BPS plus the booking fee", () => {
    const summary = buildPayInvoiceSummary(payment());
    expect(SERVICE_FEE_RATE_BPS).toBe(200);
    expect(summary.feeLines).toEqual([
      { key: "service", label: "Service Fee (2%)", amount: "4.80" },
      { key: "booking", label: "Online booking fee", amount: "1.99" }
    ]);
    expect(summary.serviceFeeNote).toBe("A 2% Service Fee applies to payments made online through Renvani.");
  });

  it("Flat shows no Service Fee line or note", () => {
    const summary = buildPayInvoiceSummary(flat());
    expect(summary.feeLines.map((line) => line.key)).toEqual(["booking"]);
    expect(summary.serviceFeeNote).toBeNull();
  });

  it("omits the booking fee when the invoice is not from online booking", () => {
    expect(buildPayInvoiceSummary(payment({ bookingFeeCents: 0 })).feeLines.map((line) => line.key)).toEqual(["service"]);
  });

  it("falls back to the config rate and combined fee for payloads without split cents", () => {
    const legacy = payment({ platformFeeAmount: "4.80" });
    delete legacy.serviceFeeCents;
    delete legacy.bookingFeeCents;
    expect(buildPayInvoiceSummary(legacy).feeLines).toEqual([{ key: "service", label: "Service Fee (2%)", amount: "4.80" }]);
    expect(resolveServiceFeeRateBps(null)).toBe(SERVICE_FEE_RATE_BPS);
    expect(formatServiceFeeNote(150)).toContain("1.5% Service Fee");
  });
});

describe("pay invoice states", () => {
  it("maps Flex / Flat / Failed / Paid", () => {
    expect(resolvePayInvoiceState(payment(), null)).toBe("flex");
    expect(resolvePayInvoiceState(flat(), null)).toBe("flat");
    expect(resolvePayInvoiceState(payment(), "failed")).toBe("failed");
    expect(resolvePayInvoiceState(payment(), "canceled")).toBe("failed");
    expect(resolvePayInvoiceState(payment(), "success")).toBe("paid");
    expect(resolvePayInvoiceState(payment({ invoiceStatus: "paid" }), null)).toBe("paid");
  });

  it("renders Flex with the Service Fee and Pay button", () => {
    const html = renderToStaticMarkup(<PayInvoiceCheckoutBody payment={payment()} state="flex" checkout={null} />);
    expect(html).toContain("Service Fee (2%)");
    expect(html).toContain("$4.80");
    expect(html).toContain("Online booking fee");
    expect(html).toContain("Pay $246.79");
    expect(html).not.toContain("Your card was declined");
  });

  it("renders Flat without any Service Fee", () => {
    const html = renderToStaticMarkup(<PayInvoiceCheckoutBody payment={flat()} state="flat" checkout={null} />);
    expect(html).not.toContain("Service Fee");
    expect(html).toContain("Pay $241.99");
  });

  it("renders Failed with the declined banner and Try again", () => {
    const html = renderToStaticMarkup(<PayInvoiceCheckoutBody payment={payment()} state="failed" checkout={null} />);
    expect(html).toContain("Your card was declined");
    expect(html).toContain("No charge was made. Try another card or pay by bank account.");
    expect(html).toContain("Try again · $246.79");
  });

  it("keeps Stripe embedded checkout in place of the fallback button", () => {
    const html = renderToStaticMarkup(
      <PayInvoiceCheckoutBody payment={payment()} state="flex" checkout={<div data-testid="stripe-embedded" />} />
    );
    expect(html).toContain("stripe-embedded");
    expect(html).not.toContain("Pay $246.79");
  });

  it("renders Paid with amount, thanks copy and receipt link", () => {
    const html = renderToStaticMarkup(
      <PayInvoicePaidCard amount="246.79" invoiceNumber="INV-1042" customerName="Dana Whitfield" shopName="Summit Heating" details={[]} receiptHref="/pay/t/receipt" />
    );
    expect(html).toContain("Paid $246.79");
    expect(html).toContain("Thanks, Dana.");
    expect(html).toContain("Download receipt");
    expect(renderToStaticMarkup(<PayInvoicePaidCard amount={null} invoiceNumber="INV-1" details={[]} receiptHref={null} />)).toContain(
      "Your service provider has your payment for INV-1."
    );
  });
});
