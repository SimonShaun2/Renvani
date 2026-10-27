"use client";

import "./payments-motion.css";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, CreditCard, ExternalLink, ShieldAlert } from "lucide-react";

import { usePaymentsList, type PaymentListRecord } from "@/src/hooks/payments.hooks";
import { useStripeConnectStatus, useStripeDashboardLink } from "@/src/hooks/stripe-connect.hooks";
import { getStoredSession } from "@/src/lib/auth";
import { useAuthStore } from "@/src/stores/auth.store";

import { formatDateTime, formatStatusLabel } from "../jobs/jobs.utils";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";
import {
  PAYMENT_METHODS,
  STATUS_CHIPS,
  formatMoney,
  formatShortDate,
  paymentChipClass,
  paymentStatusLabel,
  serviceFeeColumnLabel,
  serviceFeeLabel
} from "./payments.utils";

type Tab = "overview" | "payouts" | "transactions" | "disputes";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "payouts", label: "Payouts" },
  { key: "transactions", label: "Transactions" },
  { key: "disputes", label: "Disputes" }
];

const card = "rounded-[14px] border border-[#e6dccb] bg-white p-5";
const input = "h-10 rounded-xl border border-[#e6dccb] bg-white px-3 text-sm text-[#0f1530] outline-none focus:border-[#f6b400]";

function StatCard({ label, value, hint, loading, hintTone }: { label: string; value: string; hint?: string; loading?: boolean; hintTone?: "danger" | undefined }) {
  return (
    <div className={card}>
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#5e6684]">{label}</p>
      <p className="mt-2 text-[28px] font-semibold tracking-tight text-[#0f1530]">{loading ? "…" : value}</p>
      {hint ? <p className={hintTone === "danger" ? "mt-1 text-xs text-[#b3261e]" : "mt-1 text-xs text-[#5e6684]"}>{hint}</p> : null}
    </div>
  );
}

function OwnerOnlyNote() {
  return <p className="text-xs text-neutral-500">Only the account owner can open the Stripe dashboard.</p>;
}

function DashboardButton({ label = "Open Stripe dashboard" }: { label?: string }) {
  const dashboardLink = useStripeDashboardLink();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={dashboardLink.isPending}
        onClick={() => {
          setError(null);
          const tab = window.open("", "_blank");
          dashboardLink
            .mutateAsync()
            .then(({ url }) => {
              if (tab) {
                tab.opener = null;
                tab.location.href = url;
              } else {
                window.location.assign(url);
              }
            })
            .catch(() => {
              tab?.close();
              setError("The Stripe dashboard link couldn't be created.");
            });
        }}
        className="inline-flex items-center gap-2 rounded-xl bg-[#0f1530] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        <ExternalLink className="h-4 w-4" />
        {dashboardLink.isPending ? "Opening…" : label}
      </button>
      {error ? <p role="alert" className="mt-2 text-xs text-error">{error}</p> : null}
    </div>
  );
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${paymentChipClass(status)}`}>
      {paymentStatusLabel(status)}
    </span>
  );
}

function TransactionsTable({ rows, feeColumn }: { rows: PaymentListRecord[]; feeColumn: string | null }) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-[#e6dccb] bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#f3eadb] font-mono text-[10px] uppercase tracking-[0.12em] text-[#5e6684]">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Invoice</th>
            <th className="px-4 py-3 font-medium">Method</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            {feeColumn ? <th className="px-4 py-3 font-medium">{feeColumn}</th> : null}
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((payment) => (
            <tr key={payment.id} className="border-t border-[#e6dccb]">
              <td className="px-4 py-3 text-[#0f1530]">{formatShortDate(payment.paidAt ?? payment.createdAt)}</td>
              <td className="px-4 py-3">
                <Link href={`/invoices/${payment.invoiceId}`} className="text-[#0f1530] hover:underline">
                  View invoice
                </Link>
              </td>
              <td className="px-4 py-3 text-[#0f1530]">{formatStatusLabel(payment.method)}</td>
              <td className="px-4 py-3 text-[#0f1530]">{formatMoney(payment.amount)}</td>
              {feeColumn ? (
                <td className="px-4 py-3 text-[#0f1530]">
                  {payment.serviceFeeAmount !== undefined ? formatMoney(payment.serviceFeeAmount) : "—"}
                </td>
              ) : null}
              <td className="px-4 py-3">
                <StatusChip status={payment.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ListState({
  query,
  emptyTitle,
  emptySubtitle,
  children
}: {
  query: { isLoading: boolean; isError: boolean; refetch: () => unknown; data?: { data: PaymentListRecord[] } | undefined };
  emptyTitle: string;
  emptySubtitle: string;
  children: (rows: PaymentListRecord[]) => React.ReactNode;
}) {
  if (query.isLoading) return <SkeletonCard className="h-[200px]" />;
  if (query.isError)
    return (
      <EmptyState
        icon={CreditCard}
        title="Couldn't load payments"
        subtitle="The payments service didn't respond."
        compact
        action={
          <button type="button" className="rounded-xl bg-[#0f1530] px-4 py-2 text-sm font-semibold text-white" onClick={() => void query.refetch()}>
            Retry
          </button>
        }
      />
    );
  const rows = query.data?.data ?? [];
  if (rows.length === 0) return <EmptyState icon={CreditCard} title={emptyTitle} subtitle={emptySubtitle} compact />;
  return <>{children(rows)}</>;
}

function TransactionsTab({ feeColumn, feeNote }: { feeColumn: string | null; feeNote: string | null }) {
  const [status, setStatus] = useState("all");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const query = usePaymentsList({ status, method, from, to, page });
  const totalPages = Math.max(1, query.data?.totalPages ?? 1);
  const reset = (fn: (v: string) => void) => (value: string) => {
    fn(value);
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Status">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip.value}
            type="button"
            aria-pressed={status === chip.value}
            onClick={() => reset(setStatus)(chip.value)}
            className={
              status === chip.value
                ? "rounded-full bg-[#0f1530] px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full border border-[#e6dccb] bg-white px-3 py-1 text-xs font-medium text-[#2a3360]"
            }
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3 rounded-[14px] border border-[#e6dccb] bg-white p-4">
        <label className="flex flex-col gap-1 text-xs font-medium text-[#5e6684]">
          Method
          <select aria-label="Method" className={input} value={method} onChange={(e) => reset(setMethod)(e.target.value)}>
            <option value="all">All methods</option>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{formatStatusLabel(m)}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[#5e6684]">
          From
          <input aria-label="From" type="date" className={input} value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-[#5e6684]">
          To
          <input aria-label="To" type="date" className={input} value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        </label>
      </div>
      <ListState query={query} emptyTitle="No transactions" emptySubtitle="Payments matching these filters will show here.">
        {(rows) => (
          <>
            <TransactionsTable rows={rows} feeColumn={feeColumn} />
            {feeNote ? <p className="text-xs text-[#5e6684]">{feeNote}</p> : null}
            <div className="flex items-center justify-between text-sm text-[#5e6684]">
              <span>{query.data?.total ?? 0} transactions · page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-[#e6dccb] bg-white p-1.5 disabled:opacity-40">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-[#e6dccb] bg-white p-1.5 disabled:opacity-40">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </ListState>
    </div>
  );
}

export function PaymentsClient() {
  const authUser = useAuthStore((state) => state.user);
  const role = authUser?.role ?? getStoredSession()?.role ?? null;
  const canManagePayments = role === "owner" || role === "admin";
  const isOwner = role === "owner";
  const [tab, setTab] = useState<Tab>("overview");

  const status = useStripeConnectStatus(canManagePayments);
  const recent = usePaymentsList({ page: 1 }, 5, canManagePayments);
  const disputes = usePaymentsList({ status: "disputed" }, 25, canManagePayments);

  if (!canManagePayments) {
    return (
      <EmptyState icon={ShieldAlert} title="Owners and admins only" subtitle="Ask an owner or admin for access to payments." />
    );
  }

  const connect = status.data;
  const feeLabel = serviceFeeLabel(connect?.platformFeePercent);
  const lastPayout = connect?.lastPayoutAmount ? formatMoney(connect.lastPayoutAmount) : "—";
  const lastPayoutHint = connect?.lastPayoutAt ? formatDateTime(connect.lastPayoutAt) : "No payouts yet";
  const feeColumn = serviceFeeColumnLabel(connect?.platformFeePercent);
  const feeNote =
    feeColumn
      ? `On Flex, the ${connect?.platformFeePercent}% Service Fee is paid by your customer and isn't taken from your payout.`
      : null;
  const UNAVAILABLE = "Not available yet";

  return (
    <div className="space-y-6" data-payments-reveal>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold tracking-tight text-[#0f1530]">Payments</h1>
          <p className="mt-1 text-sm text-[#5e6684]">
            {connect?.accountName ?? "Stripe"}
            {connect?.payoutSchedule ? ` · payouts ${connect.payoutSchedule}` : ""}
            {feeLabel ? ` · ${feeLabel}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/settings/payments" className="rounded-xl border border-[#e6dccb] bg-white px-4 py-2 text-sm font-semibold text-[#0f1530]">
            Payout settings
          </Link>
          <Link href="/invoices" className="rounded-xl bg-[#0f1530] px-4 py-2 text-sm font-semibold text-white">
            Create invoice
          </Link>
        </div>
      </header>

      <nav className="flex gap-2" aria-label="Payments sections">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "rounded-full bg-[#0f1530] px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-full border border-[#e6dccb] bg-white px-4 py-1.5 text-sm font-medium text-[#2a3360]"
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      {connect && !connect.connected ? (
        <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
          <p className="text-sm text-[#2a3360]">Stripe isn&apos;t connected yet, so online payments and payouts are off.</p>
          <Link href="/settings/payments" className="rounded-xl bg-[#f6b400] px-4 py-2 text-sm font-semibold text-[#0f1530]">
            Connect Stripe
          </Link>
        </div>
      ) : null}

      {tab === "overview" ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Available" value="—" hint={UNAVAILABLE} />
            <StatCard label="Pending" value="—" hint={UNAVAILABLE} />
            <StatCard label="Next payout" value="—" hint={UNAVAILABLE} />
            <StatCard
              label="Open disputes"
              value={String(disputes.data?.total ?? 0)}
              hint={(disputes.data?.total ?? 0) > 0 ? "Respond in Stripe" : "None open"}
              hintTone={(disputes.data?.total ?? 0) > 0 ? "danger" : undefined}
              loading={disputes.isLoading}
            />
          </div>
          <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
            <section className={`${card} space-y-3 self-start`} aria-label="Payouts">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold text-[#0f1530]">Payouts</h2>
                {connect?.payoutSchedule ? (
                  <span className="rounded-full bg-[#eef0f6] px-2.5 py-1 text-xs text-[#2a3360]">{connect.payoutSchedule}</span>
                ) : null}
              </div>
              {connect?.lastPayoutAmount ? (
                <div className="flex items-center justify-between gap-2 border-b border-[#e6dccb] pb-3">
                  <div>
                    <p className="text-[15px] font-semibold text-[#0f1530]">{lastPayout}</p>
                    <p className="text-xs text-[#5e6684]">{lastPayoutHint} · last payout</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#5e6684]">No payouts yet.</p>
              )}
              <button type="button" onClick={() => setTab("payouts")} className="text-sm text-[#2d4bd8]">
                View all payouts
              </button>
            </section>
            <section className="space-y-3">
              <h2 className="text-[15px] font-semibold text-[#0f1530]">Recent transactions</h2>
              <ListState query={recent} emptyTitle="No payments yet" emptySubtitle="Card, ACH and recorded payments will appear here.">
                {(rows) => <TransactionsTable rows={rows} feeColumn={feeColumn} />}
              </ListState>
            </section>
          </div>
        </>
      ) : null}

      {tab === "transactions" ? <TransactionsTab feeColumn={feeColumn} feeNote={feeNote} /> : null}

      {tab === "payouts" ? (
        <div className="space-y-5">
          <section className={`${card} space-y-3`} aria-label="Payout schedule">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[15px] font-semibold text-[#0f1530]">Payout schedule</h2>
              {isOwner ? <DashboardButton label="View payouts in Stripe" /> : <OwnerOnlyNote />}
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-[#2a3360]">Schedule</dt><dd className="text-[#0f1530]">{connect?.payoutSchedule ?? "—"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#2a3360]">Bank account</dt><dd className="text-[#5e6684]">— · {UNAVAILABLE}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#2a3360]">Next payout</dt><dd className="text-[#5e6684]">— · {UNAVAILABLE}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-[#2a3360]">Last payout</dt><dd className="text-[#0f1530]">{lastPayout} · {lastPayoutHint}</dd></div>
            </dl>
          </section>
          <p className="text-sm text-[#5e6684]">Full payout history and bank details are in your Stripe dashboard.</p>
        </div>
      ) : null}

      {tab === "disputes" ? (
        <div className="space-y-4">
          <div className={`${card} flex flex-wrap items-center justify-between gap-3`}>
            <p className="text-sm text-[#2a3360]">Evidence and responses are handled in Stripe. Disputed payments from your records are listed below.</p>
            {isOwner ? <DashboardButton label="Respond in Stripe" /> : <OwnerOnlyNote />}
          </div>
          <ListState query={disputes} emptyTitle="No disputes" emptySubtitle="Disputed payments will show here.">
            {(rows) => <TransactionsTable rows={rows} feeColumn={feeColumn} />}
          </ListState>
        </div>
      ) : null}
    </div>
  );
}
