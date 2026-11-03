"use client";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useCompany } from "@/src/hooks/company.hooks";

function formatCurrency(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const amount = Number(value);
  if (Number.isNaN(amount)) {
    return value;
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(amount);
}

export default function SettingsBillingPage() {
  const companyQuery = useCompany();
  const billing = companyQuery.data?.company.settings?.billing ?? null;

  if (companyQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[96px]" />
        <SkeletonCard className="h-[420px]" />
      </div>
    );
  }

  return (
    <PageLayout
      title="Billing"
      subtitle="Review the current Renvani subscription plan and any available usage details."
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
          {billing ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Plan</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">{billing.planName ?? "—"}</p>
                <p className="mt-1 text-sm text-neutral-500">{billing.billingInterval ?? "Billing interval unavailable"}</p>
              </div>
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Monthly price</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">{formatCurrency(billing.monthlyPrice)}</p>
              </div>
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Seats</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">
                  {billing.seatsUsed ?? 0} / {billing.seatsIncluded ?? 0}
                </p>
              </div>
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Jobs this month</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">{billing.jobsThisMonth ?? 0}</p>
              </div>
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">SMS credits used</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">
                  {billing.smsCreditsUsed ?? 0} / {billing.smsCreditsLimit ?? 0}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-center">
              <h2 className="text-lg font-semibold text-neutral-900">Billing details are not available yet</h2>
              <p className="mt-3 text-sm text-neutral-500">
                Renvani subscription plan metadata has not been synced into the company settings record for this account yet.
              </p>
            </div>
          )}
        </section>

        <aside className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">What this tab shows</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-500">
            <li>Plan metadata stored on the company settings record.</li>
            <li>Seat and usage counts when the billing sync provides them.</li>
            <li>As billing integrations expand, this view can surface invoices and subscription history without changing the rest of the settings shell.</li>
          </ul>
        </aside>
      </div>
    </PageLayout>
  );
}
