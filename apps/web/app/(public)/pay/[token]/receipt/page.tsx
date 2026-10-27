"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { PayInvoicePaidCard, PayInvoiceShell, type PaidDetail } from "@/src/components/pay/PayInvoiceView";
import { publicApi } from "@/src/lib/public-api";

interface ReceiptView {
  invoiceNumber: string;
  totalDue: string;
  invoiceAmount: string;
  platformFeeAmount: string;
  receiptPortalUrl: string;
  pdfDownloadUrl: string;
  brandName: string;
}

/** Receipt view styled as the Paid success card (Figma 53:219 desktop / 53:465 mobile). */
export default function InvoiceReceiptPage() {
  const params = useParams<{ token: string }>();
  const receiptQuery = useQuery({
    queryKey: ["public-receipt", params.token],
    queryFn: () => publicApi.get<ReceiptView>(`/api/v1/public/pay/${params.token}/receipt`)
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
  const details: PaidDetail[] = [{ label: "Service amount", value: `$${receipt.invoiceAmount}` }];
  if (Number(receipt.platformFeeAmount) > 0) {
    // Receipt API returns only the combined fee (Service Fee + booking fee); fees are non-refundable.
    details.push({ label: "Fees (non-refundable)", value: `$${receipt.platformFeeAmount}` });
  }
  details.push({ label: "Total", value: `$${receipt.totalDue}` });

  return (
    <PayInvoiceShell shopName={null} invoiceNumber={receipt.invoiceNumber}>
      <PayInvoicePaidCard
        amount={Number(receipt.totalDue) > 0 ? receipt.totalDue : null}
        invoiceNumber={receipt.invoiceNumber}
        details={details}
        receiptHref={receipt.pdfDownloadUrl}
        receiptLabel="Download PDF"
      />
    </PayInvoiceShell>
  );
}
