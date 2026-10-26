"use client";

import { useParams, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { api } from "@/src/lib/api";

interface VipJoinPreview {
  companyName: string;
  tierName: string;
  monthlyPrice: string;
  platformFeeAmount: string | null;
  platformFeePercent: number | null;
  totalDueMonthly: string;
  discountPercent: string;
}

function formatUsd(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return amount;
  }

  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
}

export default function VipJoinPage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const previewQuery = useQuery({
    queryKey: ["vip-join", params.token],
    queryFn: () => api.get<VipJoinPreview>(`/api/v1/public/vip/join/${params.token}`)
  });

  const checkoutMutation = useMutation({
    mutationFn: () =>
      api.post<{ checkoutUrl: string }>(`/api/v1/public/vip/join/${params.token}/checkout`, {})
  });

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
        <div className="w-full max-w-md rounded-[32px] border border-neutral-200 bg-white px-8 py-10 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Renvani</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">Membership confirmed</h1>
          <p className="mt-3 text-sm text-neutral-500">
            Welcome to VIP — billing updates will come from Renvani, not Stripe.
          </p>
        </div>
      </div>
    );
  }

  if (previewQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <EmptyState
          icon={Loader2}
          title="Membership link unavailable"
          subtitle="This link may have expired. Contact your service provider for a new invite."
        />
      </div>
    );
  }

  if (previewQuery.isLoading || !previewQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <Loader2 className="h-10 w-10 animate-spin text-brand-accent" />
      </div>
    );
  }

  const preview = previewQuery.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-[32px] border border-neutral-200 bg-white px-8 py-10 shadow-[0_24px_80px_rgba(16,33,99,0.08)]">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
          Renvani · VIP membership
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-900">{preview.tierName}</h1>
        <p className="mt-2 text-sm text-neutral-500">{preview.companyName}</p>

        <dl className="mt-8 space-y-4 border-t border-neutral-100 pt-6 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-neutral-600">Monthly membership</dt>
            <dd className="font-semibold text-neutral-900">{formatUsd(preview.monthlyPrice)}</dd>
          </div>
          {preview.platformFeePercent != null && preview.platformFeeAmount ? (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-neutral-600">
                Renvani platform fee ({preview.platformFeePercent}%)
                <span className="mt-1 block text-xs font-normal text-neutral-500">
                  Customer-paid; your shop receives the full membership price.
                </span>
              </dt>
              <dd className="font-semibold text-neutral-900">{formatUsd(preview.platformFeeAmount)}</dd>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 border-t border-neutral-100 pt-4 text-base">
            <dt className="font-semibold text-neutral-900">Total due monthly</dt>
            <dd className="font-semibold text-neutral-900">{formatUsd(preview.totalDueMonthly)}</dd>
          </div>
          <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
            Includes {preview.discountPercent}% off eligible services on invoices and estimates while active.
          </div>
        </dl>

        <button
          type="button"
          disabled={checkoutMutation.isPending}
          onClick={async () => {
            const result = await checkoutMutation.mutateAsync();
            window.location.assign(result.checkoutUrl);
          }}
          className="mt-8 flex w-full items-center justify-center rounded-full bg-brand-accent px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {checkoutMutation.isPending ? "Starting checkout…" : "Continue to secure checkout"}
        </button>
      </div>
    </div>
  );
}
