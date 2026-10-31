"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { PayHostedCheckoutButton } from "@/src/components/pay/PayHostedCheckoutButton";
import { PayInvoiceCheckoutBody, PayInvoicePaidCard, PayInvoiceShell } from "@/src/components/pay/PayInvoiceView";
import {
  PAY_LOAD_ERROR_COPY,
  buildPaidDetails,
  classifyPayLoadError,
  resolvePayInvoiceState,
  resolvePayNotice
} from "@/src/components/pay/pay-invoice.utils";
import { isEmbeddedCheckoutAvailable, StripeEmbeddedInvoiceCheckout } from "@/src/components/stripe/StripeEmbeddedInvoiceCheckout";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { usePublicPaymentLink } from "@/src/hooks/invoices.hooks";

/** Customer pay invoice — Figma jiGHTNUJNltWbHA4Il3hk7 53:3–53:465 (Flex / Flat / Failed / Paid, desktop + mobile). */
export default function PublicPaymentPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const paymentQuery = usePublicPaymentLink(params.token);
  const status = searchParams.get("status");

  if (paymentQuery.isError) {
    const kind = classifyPayLoadError(paymentQuery.error);
    const copy = PAY_LOAD_ERROR_COPY[kind];
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbf6ef] px-4">
        <div className="w-full max-w-lg" role={kind === "temporary" ? "alert" : undefined} data-testid={`pay-error-${kind}`}>
          <EmptyState icon={Loader2} title={copy.title} subtitle={copy.subtitle} />
          {kind === "temporary" ? (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => void paymentQuery.refetch()}
                disabled={paymentQuery.isFetching}
                className="min-h-[44px] w-full rounded-[10px] bg-[#0f1530] px-5 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                {paymentQuery.isFetching ? "Trying again…" : "Try again"}
              </button>
            </div>
          ) : null}
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
    <PayInvoiceShell shopName={payment.shopName} shopLogoUrl={payment.shopLogoUrl} invoiceNumber={payment.invoiceNumber}>
      {state === "paid" ? (
        <PayInvoicePaidCard
          // Settled invoices report paidAmount; before settlement fall back to a non-zero totalDue.
          amount={payment.paidAmount ?? (Number(payment.totalDue) > 0 ? payment.totalDue : null)}
          invoiceNumber={payment.invoiceNumber}
          customerName={payment.customerName}
          shopName={payment.shopName}
          shopUrl={payment.shopUrl}
          details={buildPaidDetails(payment)}
          receiptHref={`/pay/${params.token}/receipt`}
        />
      ) : (
        <PayInvoiceCheckoutBody
          payment={payment}
          state={state}
          notice={resolvePayNotice(status)}
          checkout={
            // Without the publishable key or a clientSecret, fall back to hosted Stripe Checkout (POST hosted-checkout, #292).
            payment.checkoutClientSecret && isEmbeddedCheckoutAvailable(payment.checkoutClientSecret) ? (
              <StripeEmbeddedInvoiceCheckout clientSecret={payment.checkoutClientSecret} />
            ) : (
              <PayHostedCheckoutButton token={params.token} />
            )
          }
        />
      )}
    </PayInvoiceShell>
  );
}
