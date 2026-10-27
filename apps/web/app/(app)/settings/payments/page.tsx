"use client";

import { CreditCard, ExternalLink, Loader2 } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { getStoredSession } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/api";
import { StripeConnectEmbedded } from "@/src/components/stripe/StripeConnectEmbedded";
import {
  useStartStripeConnect,
  useStripeConnectStatus,
  useStripeDashboardLink
} from "@/src/hooks/stripe-connect.hooks";
import { useAuthStore } from "@/src/stores/auth.store";
import { showToast } from "@/src/stores/toast.store";

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

export default function SettingsPaymentsPage() {
  const statusQuery = useStripeConnectStatus();
  const startConnect = useStartStripeConnect();
  const dashboardLink = useStripeDashboardLink();
  const authUser = useAuthStore((state) => state.user);
  const role = authUser?.role ?? getStoredSession()?.role ?? null;
  const canManagePayments = role === "owner" || role === "admin";

  async function handleConnect() {
    try {
      const response = await startConnect.mutateAsync();
      window.location.assign(response.url);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Stripe connect failed",
        description: error instanceof ApiError ? error.message : "The Stripe onboarding link could not be created."
      });
    }
  }

  async function handleOpenDashboard() {
    try {
      const response = await dashboardLink.mutateAsync();
      window.location.assign(response.url);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Stripe dashboard unavailable",
        description: error instanceof ApiError ? error.message : "The Stripe dashboard link could not be created."
      });
    }
  }

  if (statusQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[96px]" />
        <SkeletonCard className="h-[420px]" />
      </div>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    return (
      <PageLayout
        title="Payments"
        subtitle="Connect payouts and payments inside Renvani — Stripe appears only for required verification."
      >
        <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Payments unavailable</h2>
          <p className="mt-3 text-sm text-neutral-500">Refresh and try again to load the current Stripe status.</p>
        </section>
      </PageLayout>
    );
  }

  const status = statusQuery.data;
  const actionPending = startConnect.isPending || dashboardLink.isPending;
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "";
  const preferEmbeddedConnect = publishableKey.length > 0;

  return (
    <PageLayout
      title="Payments"
      subtitle="Connect payouts and payments inside Renvani — Stripe appears only for required verification."
      actions={
        status.connected ? (
          <button
            type="button"
            onClick={() => {
              void handleOpenDashboard();
            }}
            disabled={!canManagePayments || actionPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {dashboardLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            Stripe Dashboard
          </button>
        ) : preferEmbeddedConnect ? null : (
          <button
            type="button"
            onClick={() => {
              void handleConnect();
            }}
            disabled={!canManagePayments || actionPending}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {startConnect.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Connect payouts
          </button>
        )
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="space-y-6">
          <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Stripe Connect</h2>
                  <StatBadge label={status.connected ? "Connected" : "Not connected"} tone={status.connected ? "green" : "orange"} />
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  {status.connected
                    ? "Customer payments are collected in Renvani and settled to your connected account."
                    : "Complete verification below to accept payments and payouts without leaving Renvani."}
                </p>
              </div>
              {!canManagePayments ? (
                <StatBadge label="Owner or admin required" tone="gray" />
              ) : null}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Account</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">{status.accountName ?? "Awaiting onboarding"}</p>
              </div>
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Payout schedule</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">{status.payoutSchedule ?? "Unavailable"}</p>
              </div>
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Last payout</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">{formatCurrency(status.lastPayoutAmount)}</p>
                <p className="mt-1 text-xs text-neutral-500">{status.lastPayoutAt ? new Date(status.lastPayoutAt).toLocaleDateString("en-US") : "No payout recorded yet"}</p>
              </div>
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Service Fee</p>
                <p className="mt-2 text-lg font-semibold text-neutral-950">
                  {status.platformFeePercent != null && status.platformFeePercent > 0
                    ? `${status.platformFeePercent.toFixed(1)}%`
                    : status.renvaniPlanTier === "flat"
                      ? "None"
                      : "Not set"}
                </p>
                <p className="mt-1 text-xs text-neutral-500">
                  {status.platformFeePercent != null && status.platformFeePercent > 0
                    ? "Paid by your customer at checkout and non-refundable. You receive the full invoice amount."
                    : status.renvaniPlanTier === "flat"
                      ? "Flat plan: no Service Fee. Only the $1.99 booking fee applies to paid online-booked checkouts."
                      : "No billing plan set yet. Your Service Fee will show here once a plan is chosen."}
                </p>
              </div>
            </div>

            {!status.connected && preferEmbeddedConnect && canManagePayments ? (
              <div className="mt-6">
                <StripeConnectEmbedded
                  onComplete={() => {
                    void statusQuery.refetch();
                  }}
                />
              </div>
            ) : null}
          </section>

          <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Capabilities</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-sm font-semibold text-neutral-900">Charges enabled</p>
                <p className="mt-2 text-sm text-neutral-500">{status.chargesEnabled ? "Customers can pay online." : "Stripe still needs more onboarding details."}</p>
              </div>
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-sm font-semibold text-neutral-900">Payouts enabled</p>
                <p className="mt-2 text-sm text-neutral-500">{status.payoutsEnabled ? "Funds can transfer to your bank account." : "Payouts are still waiting on Stripe verification."}</p>
              </div>
              <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                <p className="text-sm font-semibold text-neutral-900">Details submitted</p>
                <p className="mt-2 text-sm text-neutral-500">{status.detailsSubmitted ? "Business details are on file." : "Complete onboarding to start processing payments."}</p>
              </div>
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Status snapshot</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-[22px] bg-neutral-50 px-4 py-4">
                <p className="text-sm font-semibold text-neutral-900">Stripe account ID</p>
                <p className="mt-1 text-xs text-neutral-500">{status.stripeAccountId}</p>
              </div>
              <div className="rounded-[22px] bg-neutral-50 px-4 py-4">
                <p className="text-sm font-semibold text-neutral-900">Connected account status</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {status.connected ? "Connected and ready for payment operations." : "Not connected yet."}
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </PageLayout>
  );
}
