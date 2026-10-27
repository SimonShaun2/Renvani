"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { PayInvoicePaidCard, PayInvoiceShell, type PaidDetail } from "@/src/components/pay/PayInvoiceView";
import type { PublicInvoiceReceiptResponse } from "@fsm/types";

import { buildPaidDetails, formatUsd } from "@/src/components/pay/pay-invoice.utils";
import { publicApi } from "@/src/lib/public-api";


/** Receipt view styled as the Paid success card (Figma 53:219 desktop / 53:465 mobile). */
export default function InvoiceReceiptPage() {
  const params = useParams<{ token: string }>();
  const receiptQuery = useQuery({
    queryKey: ["public-receipt", params.token],
    queryFn: () => publicApi.get<PublicInvoiceReceiptResponse>(`/api/v1/public/pay/${params.token}/receipt`)
  });

  if (receiptQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbf6ef] px-4 text-center text-sm text-[#5e6684]">
        Receipt unavailable. Contact your service provider for a copy.
      </div>
    );
  }

  if (receiptQuery.isLoading || !receiptQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbf6ef]">
        <Loader2 className="h-10 w-10 animate-spin text-brand-accent" />
      </div>
    );
  }

  const receipt = receiptQuery.data;
  const details: PaidDetail[] = [{ label: "Service amount", value: formatUsd(receipt.invoiceAmount) }];
  if (receipt.serviceFeeCents > 0 && receipt.serviceFeeLabel) {
    details.push({ label: `${receipt.serviceFeeLabel} · non-refundable`, value: formatUsd(receipt.serviceFeeAmount) });
  }
  if (receipt.bookingFeeCents > 0) {
    details.push({ label: "Online booking fee · non-refundable", value: formatUsd(receipt.bookingFeeAmount) });
  }
  details.push(...buildPaidDetails(receipt));
  const amount = receipt.paidAmount ?? (Number(receipt.totalDue) > 0 ? receipt.totalDue : null);

  return (
    <PayInvoiceShell shopName={receipt.shopName} shopLogoUrl={receipt.shopLogoUrl} invoiceNumber={receipt.invoiceNumber}>
      <PayInvoicePaidCard
        amount={amount}
        invoiceNumber={receipt.invoiceNumber}
        customerName={receipt.customerName}
        shopName={receipt.shopName}
        shopUrl={receipt.shopUrl}
        details={details}
        receiptHref={receipt.pdfDownloadUrl}
        receiptLabel="Download PDF"
      />
    </PayInvoiceShell>
  );
}
