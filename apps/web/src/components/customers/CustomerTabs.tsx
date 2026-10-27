"use client";

import { useState } from "react";
import Link from "next/link";
import { ClipboardList, FileText, Mail, MessageSquareText, ShieldCheck } from "lucide-react";

import type { JobStatus } from "@fsm/types";

import {
  useCustomerAgreements,
  useCustomerInvoices,
  useCustomerJobs,
  useCustomerMessageLogs,
  useCustomerPayments,
  useSendInvoiceLink
} from "@/src/hooks/customers.hooks";
import { formatCurrency, formatDate } from "@/src/lib/utils";

import { CustomerFilesTab } from "./CustomerFilesTab";
import { groupCampaignLogs, tagsToString } from "./customers.utils";
import { CurrencyDisplay } from "../ui/CurrencyDisplay";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";
import { StatBadge } from "../ui/StatBadge";
import { TimeAgo } from "../ui/TimeAgo";

export type CustomerTabKey = "jobs" | "files" | "financials" | "communications";

function TabButton({
  active,
  label,
  onClick
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
          : "rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
      }
    >
      {label}
    </button>
  );
}

function PaymentLinkButton({ invoiceId }: { invoiceId: string }) {
  const sendInvoice = useSendInvoiceLink(invoiceId);

  return (
    <button
      type="button"
      onClick={() => {
        void sendInvoice.mutateAsync();
      }}
      disabled={sendInvoice.isPending}
      className="rounded-full border border-brand-accent/20 bg-brand-accent-light px-3 py-1.5 text-xs font-semibold text-brand-accent disabled:cursor-not-allowed disabled:opacity-70"
    >
      {sendInvoice.isPending ? "Sending..." : "Send Payment Link"}
    </button>
  );
}

function JobHistoryTab({ customerId }: { customerId: string }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const jobsQuery = useCustomerJobs(customerId, {
    ...(statusFilter !== "all" ? { status: statusFilter as JobStatus } : {}),
    sortBy: "scheduledStart",
    sortOrder: "desc",
    page,
    limit: 10
  });
  const jobs = jobsQuery.data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All" },
          { key: "scheduled", label: "Scheduled" },
          { key: "in_progress", label: "In Progress" },
          { key: "completed", label: "Completed" },
          { key: "paid", label: "Paid" }
        ].map((chip) => (
          <TabButton
            key={chip.key}
            active={statusFilter === chip.key}
            label={chip.label}
            onClick={() => {
              setStatusFilter(chip.key);
              setPage(1);
            }}
          />
        ))}
      </div>

      {jobsQuery.isLoading ? (
        <SkeletonCard className="h-[320px]" />
      ) : jobsQuery.isError ? (
        <p className="rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
          Job history could not be loaded.
        </p>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No jobs in this view"
          subtitle="As jobs are booked and completed for this customer, they’ll appear here."
          compact
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-[24px] border border-neutral-200">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Job #</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Tech</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {jobs.map((job) => (
                  <tr key={job.id} className="transition hover:bg-neutral-50">
                    <td className="px-4 py-4">
                      <Link href={`/jobs/${job.id}`} className="font-semibold text-brand-accent">
                        {job.jobNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-neutral-700">{job.type.replaceAll("_", " ")}</td>
                    <td className="px-4 py-4 text-neutral-700">
                      {job.scheduledStart ? formatDate(job.scheduledStart) : formatDate(job.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-neutral-700">
                      {job.technician ? `${job.technician.firstName} ${job.technician.lastName}` : "Unassigned"}
                    </td>
                    <td className="px-4 py-4">
                      <StatBadge label={job.status.replaceAll("_", " ")} tone="gray" />
                    </td>
                    <td className="px-4 py-4 text-neutral-700">Pending invoice</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">
              Page {jobsQuery.data?.page ?? 1} of {jobsQuery.data?.totalPages ?? 1}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= (jobsQuery.data?.totalPages ?? 1)}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FinancialsTab({ customerId }: { customerId: string }) {
  const invoicesQuery = useCustomerInvoices(customerId);
  const paymentsQuery = useCustomerPayments(customerId);
  const agreementsQuery = useCustomerAgreements(customerId);

  const invoices = invoicesQuery.data?.data ?? [];
  const openInvoices = invoices.filter((invoice) => invoice.balanceDue !== "0.00" && invoice.balanceDue !== "0");
  const payments = paymentsQuery.data?.data ?? [];
  const agreements = agreementsQuery.data?.data ?? [];

  const totalBilled = invoices.reduce((sum, invoice) => sum + Number.parseFloat(invoice.total ?? "0"), 0);
  const totalCollected = payments
    .filter((payment) => payment.status === "succeeded")
    .reduce((sum, payment) => sum + Number.parseFloat(payment.amount ?? "0"), 0);

  if (invoicesQuery.isLoading || paymentsQuery.isLoading || agreementsQuery.isLoading) {
    return <SkeletonCard className="h-[420px]" />;
  }

  if (invoicesQuery.isError || paymentsQuery.isError || agreementsQuery.isError) {
    return (
      <p className="rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
        Financial records could not be loaded.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Total billed</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{formatCurrency(totalBilled)}</p>
        </div>
        <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Total collected</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-neutral-900">{formatCurrency(totalCollected)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-900">Open Invoices</h3>
          <span className="text-sm text-neutral-500">{openInvoices.length} outstanding</span>
        </div>
        {openInvoices.length === 0 ? (
          <EmptyState icon={FileText} title="No open invoices" subtitle="Outstanding balances will show up here." compact />
        ) : (
          <div className="space-y-3">
            {openInvoices.map((invoice) => (
              <div key={invoice.id} className="flex flex-col gap-3 rounded-[24px] border border-neutral-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{invoice.invoiceNumber}</p>
                  <p className="mt-1 text-sm text-neutral-500">
                    {invoice.title ?? "Service invoice"} • Due {invoice.dueAt ? formatDate(invoice.dueAt) : "TBD"}
                  </p>
                  <p className="mt-1 text-sm text-neutral-700">
                    Balance due <CurrencyDisplay value={invoice.balanceDue} className="font-semibold text-neutral-900" />
                  </p>
                </div>
                <PaymentLinkButton invoiceId={invoice.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-neutral-200">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-50 text-left text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Invoice</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Total</th>
              <th className="px-4 py-3 font-semibold">Balance Due</th>
              <th className="px-4 py-3 font-semibold">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {invoices.map((invoice) => (
              <tr key={invoice.id}>
                <td className="px-4 py-4">
                  <Link href={`/invoices/${invoice.id}`} className="font-semibold text-brand-accent">
                    {invoice.invoiceNumber}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <StatBadge
                    label={invoice.status.replaceAll("_", " ")}
                    tone={invoice.status === "overdue" ? "red" : invoice.status === "paid" ? "green" : "gray"}
                  />
                </td>
                <td className="px-4 py-4 text-neutral-700">{formatCurrency(invoice.total)}</td>
                <td className="px-4 py-4 text-neutral-700">{formatCurrency(invoice.balanceDue)}</td>
                <td className="px-4 py-4 text-neutral-700">{invoice.dueAt ? formatDate(invoice.dueAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-900">Service Agreements</h3>
          <span className="text-sm text-neutral-500">{agreements.length} records</span>
        </div>
        {agreements.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No agreements" subtitle="Active and past plans will appear here." compact />
        ) : (
          <div className="space-y-3">
            {agreements.map((agreement) => (
              <div key={agreement.id} className="rounded-[24px] border border-neutral-200 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{agreement.name}</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {agreement.frequency.replaceAll("_", " ")} • Next service {agreement.nextServiceDate ? formatDate(agreement.nextServiceDate) : "TBD"}
                    </p>
                  </div>
                  <StatBadge
                    label={agreement.status}
                    tone={agreement.status === "active" ? "green" : agreement.status === "paused" ? "orange" : "gray"}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommunicationsTab({ customerId }: { customerId: string }) {
  const logsQuery = useCustomerMessageLogs(customerId);
  const logs = logsQuery.data?.data ?? [];
  const smsLogs = logs.filter((log) => log.channel === "sms");
  const emailLogs = logs
    .filter((log) => log.channel === "email")
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const campaigns = groupCampaignLogs(logs);

  if (logsQuery.isLoading) {
    return <SkeletonCard className="h-[420px]" />;
  }

  if (logsQuery.isError) {
    return (
      <p className="rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
        Communications could not be loaded.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-base font-semibold text-neutral-900">SMS History</h3>
        <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
          {smsLogs.length === 0 ? (
            <EmptyState
              icon={MessageSquareText}
              title="No SMS history"
              subtitle="Inbound and outbound text messages will show here."
              compact
            />
          ) : (
            <div className="space-y-3">
              {smsLogs.map((log) => (
                <div
                  key={log.id}
                  className={log.direction === "inbound" ? "mr-8 rounded-[20px] bg-white px-4 py-3" : "ml-8 rounded-[20px] bg-brand-accent px-4 py-3 text-white"}
                >
                  <p className="text-sm leading-6">{log.body}</p>
                  <TimeAgo
                    value={log.sentAt ?? log.createdAt}
                    className={log.direction === "inbound" ? "mt-2 block text-xs text-neutral-400" : "mt-2 block text-xs text-white/70"}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-neutral-900">Sent Campaigns</h3>
        {campaigns.length === 0 ? (
          <EmptyState
            icon={MessageSquareText}
            title="No campaigns yet"
            subtitle="Campaign delivery to this customer will show here."
            compact
          />
        ) : (
          <div className="space-y-3">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="rounded-[24px] border border-neutral-200 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{campaign.name}</p>
                    <p className="mt-1 text-sm text-neutral-500">
                      {campaign.channel.toUpperCase()} • Sent {campaign.sentAt ? formatDate(campaign.sentAt) : "—"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatBadge label={`${campaign.deliveredCount} delivered`} tone="green" />
                    {campaign.failedCount > 0 ? <StatBadge label={`${campaign.failedCount} failed`} tone="red" /> : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-base font-semibold text-neutral-900">Email Log</h3>
        {emailLogs.length === 0 ? (
          <EmptyState
            icon={Mail}
            title="No email log"
            subtitle="Sent emails and delivery outcomes will appear here."
            compact
          />
        ) : (
          <div className="space-y-3">
            {emailLogs.map((log) => (
              <div key={log.id} className="rounded-[24px] border border-neutral-200 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{log.subject ?? log.campaignName ?? "Email"}</p>
                    <p className="mt-1 text-sm text-neutral-500">{tagsToString([log.toAddress, log.providerStatus ?? "pending"])}</p>
                  </div>
                  <TimeAgo value={log.sentAt ?? log.createdAt} className="text-xs font-medium text-neutral-400" />
                </div>
                <p className="mt-3 text-sm leading-6 text-neutral-600">{log.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface CustomerTabsProps {
  customerId: string;
  activeTab: CustomerTabKey;
  onActiveTabChange: (tab: CustomerTabKey) => void;
}

export function CustomerTabs({ customerId, activeTab, onActiveTabChange }: CustomerTabsProps) {
  return (
    <section className="surface-card px-6 py-6">
      <div className="flex flex-wrap gap-2">
        <TabButton active={activeTab === "jobs"} label="Job History" onClick={() => onActiveTabChange("jobs")} />
        <TabButton active={activeTab === "files"} label="Files" onClick={() => onActiveTabChange("files")} />
        <TabButton active={activeTab === "financials"} label="Financials" onClick={() => onActiveTabChange("financials")} />
        <TabButton active={activeTab === "communications"} label="Communications" onClick={() => onActiveTabChange("communications")} />
      </div>

      <div className="mt-6">
        {activeTab === "jobs" ? <JobHistoryTab customerId={customerId} /> : null}
        {activeTab === "files" ? <CustomerFilesTab customerId={customerId} /> : null}
        {activeTab === "financials" ? <FinancialsTab customerId={customerId} /> : null}
        {activeTab === "communications" ? <CommunicationsTab customerId={customerId} /> : null}
      </div>
    </section>
  );
}
