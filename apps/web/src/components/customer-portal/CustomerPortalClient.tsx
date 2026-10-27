"use client";

import "./customer-portal-motion.css";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import type { UseQueryResult } from "@tanstack/react-query";
import type { CustomerPortalVisit } from "@fsm/types";

import {
  useCustomerPortalAccount,
  useCustomerPortalEstimates,
  useCustomerPortalInvoices,
  useCustomerPortalVisits
} from "@/src/hooks/customer-portal.hooks";
import { captureCustomerPortalToken, clearCustomerPortalToken, isPortalLinkExpired } from "@/src/lib/customer-portal-session";

const money = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US", { style: "currency", currency: "USD" }) : value;
};
const date = (value: string | null) => (value ? new Date(value).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—");

function ExpiredLink() {
  return (
    <div role="alert" className="mx-auto max-w-lg rounded-3xl border border-neutral-200 bg-white px-6 py-10 text-center">
      <h1 className="text-lg font-semibold text-neutral-900">This link has expired</h1>
      <p className="mt-2 text-sm text-neutral-600">
        For your security, portal links stop working after a while. Ask your service provider to send you a new link.
      </p>
    </div>
  );
}

function Section<T>({
  title,
  query,
  isEmpty,
  emptyText,
  children
}: {
  title: string;
  query: UseQueryResult<T>;
  isEmpty: (data: T) => boolean;
  emptyText: string;
  children: (data: T) => ReactNode;
}) {
  return (
    <section data-portal-reveal aria-label={title} className="rounded-3xl border border-neutral-200 bg-white px-5 py-5">
      <h2 className="text-base font-semibold text-neutral-900">{title}</h2>
      <div className="mt-3">
        {query.isLoading ? (
          <p className="text-sm text-neutral-500" role="status">
            Loading {title.toLowerCase()}…
          </p>
        ) : query.isError ? (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-2xl bg-red-50 px-4 py-3">
            <p className="text-sm text-red-700">{title} could not be loaded.</p>
            <button
              type="button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
              className="rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm font-semibold text-neutral-800 disabled:opacity-50"
            >
              {query.isFetching ? "Retrying…" : "Retry"}
            </button>
          </div>
        ) : query.data && !isEmpty(query.data) ? (
          children(query.data)
        ) : (
          <p className="text-sm text-neutral-500">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

function VisitRow({ visit }: { visit: CustomerPortalVisit }) {
  return (
    <li className="flex justify-between gap-3 py-2 text-sm">
      <span className="text-neutral-900">{visit.title}</span>
      <span className="text-neutral-500">{date(visit.completedAt ?? visit.scheduledStart)}</span>
    </li>
  );
}

export function CustomerPortalClient() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(captureCustomerPortalToken());
    setReady(true);
  }, []);

  const account = useCustomerPortalAccount(token);
  const visits = useCustomerPortalVisits(token);
  const estimates = useCustomerPortalEstimates(token);
  const invoices = useCustomerPortalInvoices(token);

  const expired = [account, visits, estimates, invoices].some((q) => q.isError && isPortalLinkExpired(q.error));
  useEffect(() => {
    if (expired) clearCustomerPortalToken();
  }, [expired]);

  if (!ready) return null;
  if (!token || expired) {
    return (
      <main className="px-4 py-12">
        <ExpiredLink />
      </main>
    );
  }

  const name = account.data
    ? account.data.account.customer.displayName ??
      `${account.data.account.customer.firstName} ${account.data.account.customer.lastName}`
    : null;

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-10">
      <header data-portal-reveal>
        <p className="text-sm text-neutral-500">{account.data?.account.company.name ?? "Your service provider"}</p>
        <h1 className="text-2xl font-semibold text-neutral-900">{name ? `Hi, ${name}` : "Your account"}</h1>
        {account.isError ? (
          <div role="alert" className="mt-2 flex items-center gap-3 text-sm text-red-700">
            Account details could not be loaded.
            <button type="button" className="font-semibold underline" onClick={() => void account.refetch()}>
              Retry
            </button>
          </div>
        ) : null}
      </header>

      <Section
        title="Visits"
        query={visits}
        isEmpty={(d) => d.visits.upcoming.length + d.visits.past.length === 0}
        emptyText="No visits yet."
      >
        {(d) => (
          <div className="space-y-3">
            {d.visits.upcoming.length ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Upcoming</h3>
                <ul className="divide-y divide-neutral-100">{d.visits.upcoming.map((v) => <VisitRow key={v.id} visit={v} />)}</ul>
              </div>
            ) : null}
            {d.visits.past.length ? (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Past</h3>
                <ul className="divide-y divide-neutral-100">{d.visits.past.map((v) => <VisitRow key={v.id} visit={v} />)}</ul>
              </div>
            ) : null}
          </div>
        )}
      </Section>

      <Section title="Estimates" query={estimates} isEmpty={(d) => d.estimates.length === 0} emptyText="No estimates yet.">
        {(d) => (
          <ul className="divide-y divide-neutral-100">
            {d.estimates.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-neutral-900">
                  {e.title ?? `Estimate ${e.estimateNumber}`} · {money(e.total)}
                </span>
                {e.approvalToken ? (
                  <Link href={`/approve/${e.approvalToken}`} className="font-semibold text-brand-primary">
                    View
                  </Link>
                ) : (
                  <span className="capitalize text-neutral-500">{e.status}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Invoices" query={invoices} isEmpty={(d) => d.invoices.length === 0} emptyText="No invoices yet.">
        {(d) => (
          <ul className="divide-y divide-neutral-100">
            {d.invoices.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-neutral-900">
                  Invoice {i.invoiceNumber} · {Number(i.balanceDue) > 0 ? `${money(i.balanceDue)} due` : "Paid"}
                </span>
                {i.paymentToken && Number(i.balanceDue) > 0 ? (
                  <Link href={`/pay/${i.paymentToken}`} className="font-semibold text-brand-primary">
                    Pay
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}
