"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { PayInvoiceCheckoutBody, PayInvoicePaidCard, PayInvoiceShell } from "@/src/components/pay/PayInvoiceView";
import { resolvePayInvoiceState } from "@/src/components/pay/pay-invoice.utils";
import { StripeEmbeddedInvoiceCheckout } from "@/src/components/stripe/StripeEmbeddedInvoiceCheckout";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { usePublicPaymentLink } from "@/src/hooks/invoices.hooks";

/** Customer pay invoice — Figma jiGHTNUJNltWbHA4Il3hk7 53:3–53:465 (Flex / Flat / Failed / Paid, desktop + mobile). */
export default function PublicPaymentPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const paymentQuery = usePublicPaymentLink(params.token);
  const status = searchParams.get("status");

  if (paymentQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbf6ef] px-4">
        <div className="w-full max-w-lg">
          <EmptyState
            icon={Loader2}
            title="Payment link unavailable"
            subtitle="This payment link may have expired. Contact your service provider to request a new invoice link."
          />
        </div>
      </div>
    );
  }

  if (paymentQuery.isLoading || !paymentQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbf6ef] px-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-accent" />
      </div>
    );
  }

  const payment = paymentQuery.data;
  const state = resolvePayInvoiceState(payment, status);

  return (
    <PayInvoiceShell shopName={payment.shopName} invoiceNumber={payment.invoiceNumber}>
      {state === "paid" ? (
        <PayInvoicePaidCard
          // After Stripe settles the invoice the API recomputes on a zero balance, so only show a non-zero amount.
          amount={Number(payment.totalDue) > 0 ? payment.totalDue : null}
          invoiceNumber={payment.invoiceNumber}
          customerName={payment.customerName}
          shopName={payment.shopName}
          shopUrl={payment.shopUrl}
          details={[]}
          receiptHref={`/pay/${params.token}/receipt`}
        />
      ) : (
        <PayInvoiceCheckoutBody
          payment={payment}
          state={state}
          checkout={
            payment.checkoutClientSecret ? <StripeEmbeddedInvoiceCheckout clientSecret={payment.checkoutClientSecret} /> : null
          }
        />
      )}
    </PayInvoiceShell>
  );
}
