"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus, Search, Users } from "lucide-react";

import type { CustomerAgreementRecord, CustomerInvoiceRecord } from "@/src/hooks/customers.hooks";
import { useCustomers } from "@/src/hooks/customers.hooks";
import { api } from "@/src/lib/api";

import { CustomerForm } from "./CustomerForm";
import { getCustomerName, hasOverdueInvoice, isCustomerDormant } from "./customers.utils";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";
import { StatBadge } from "../ui/StatBadge";
import { TimeAgo } from "../ui/TimeAgo";

type CustomerFilter = "all" | "active" | "dormant" | "noPlan" | "overdueInvoice";
type CustomerSort = "lastServiceDate" | "lastName" | "lifetimeValue";

const cardMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 }
};

function buildCustomerQuery(filter: CustomerFilter, search: string, sortBy: CustomerSort, page: number) {
  return {
    ...(search ? { search } : {}),
    ...(filter === "active" ? { status: "active" as const } : {}),
    ...(filter === "dormant" ? { status: "dormant" as const } : {}),
    ...(filter === "noPlan" ? { hasActiveMaintenancePlan: false } : {}),
    ...(filter === "overdueInvoice" ? { hasOverdueInvoice: true } : {}),
    sortBy,
    sortOrder: sortBy === "lastName" ? ("asc" as const) : ("desc" as const),
    page,
    limit: 25
  };
}

export function CustomerTable() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [sortBy, setSortBy] = useState<CustomerSort>("lastServiceDate");
  const [page, setPage] = useState(1);
  const [customerFormOpen, setCustomerFormOpen] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter, sortBy]);

  const customersQuery = useCustomers(buildCustomerQuery(filter, debouncedSearch, sortBy, page));
  const agreementSnapshotQuery = useQuery({
    queryKey: ["customers", "agreement-snapshot"],
    queryFn: () =>
      api.get<{
        data: CustomerAgreementRecord[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>("/api/v1/service-agreements?status=active&page=1&limit=100")
  });
  const overdueInvoiceSnapshotQuery = useQuery({
    queryKey: ["customers", "invoice-snapshot"],
    queryFn: () =>
      api.get<{
        data: CustomerInvoiceRecord[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
      }>("/api/v1/invoices?status=overdue&page=1&limit=100")
  });

  const activePlanCustomerIds = new Set(
    (agreementSnapshotQuery.data?.data ?? []).map((agreement) => agreement.customer.id)
  );
  const overdueInvoiceCustomerIds = new Set(
    (overdueInvoiceSnapshotQuery.data?.data ?? [])
      .filter((invoice) => hasOverdueInvoice([invoice]))
      .map((invoice) => invoice.customer.id)
  );

  return (
    <motion.div {...cardMotion} transition={{ duration: 0.3 }} className="space-y-6">
      <section className="surface-card px-6 py-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Customers</h1>
            <p className="mt-1 text-sm text-neutral-500">
              Search the account base, spot service risk, and move into the full customer profile in one click.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCustomerFormOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-primary"
          >
            <Plus className="h-4 w-4" />
            New Customer
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone, email..."
              className="w-full bg-transparent outline-none placeholder:text-neutral-400"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            {[
              { key: "all", label: "All" },
              { key: "active", label: "Active" },
              { key: "dormant", label: "Dormant" },
              { key: "noPlan", label: "No Plan" },
              { key: "overdueInvoice", label: "Overdue Invoice" }
            ].map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilter(chip.key as CustomerFilter)}
                className={
                  filter === chip.key
                    ? "rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
                    : "rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-neutral-500 transition hover:text-neutral-900"
                }
              >
                {chip.label}
              </button>
            ))}

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as CustomerSort)}
              className="rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 outline-none"
            >
              <option value="lastServiceDate">Last service date</option>
              <option value="lastName">Name</option>
              <option value="lifetimeValue">Lifetime value</option>
            </select>
          </div>
        </div>
      </section>

      {customersQuery.isLoading ? (
        <SkeletonCard className="h-[620px]" />
      ) : customersQuery.isError || !customersQuery.data ? (
        <section className="rounded-3xl border border-error/15 bg-error-light px-5 py-5 text-sm text-error">
          Customer records could not be loaded.
        </section>
      ) : customersQuery.data.data.length === 0 ? (
        <EmptyState variant="operator"
          icon={Users}
          title="No customers match this view"
          subtitle="Try another search term or switch filters to widen the customer set."
        />
      ) : (
        <>
          <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-neutral-200 text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Phone</th>
                  <th className="px-4 py-3 font-semibold">Last Service</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Lifetime Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 bg-white">
                {customersQuery.data.data.map((customer) => {
                  const dormant = isCustomerDormant(customer.lastServiceDate);
                  const hasPlan = activePlanCustomerIds.has(customer.id);
                  const overdueInvoice = overdueInvoiceCustomerIds.has(customer.id);

                  return (
                    <tr
                      key={customer.id}
                      onClick={() => router.push(`/customers/${customer.id}`)}
                      className="cursor-pointer transition hover:bg-neutral-50"
                    >
                      <td className="px-4 py-4">
                        <div>
                          <p className="font-semibold text-neutral-900">{getCustomerName(customer)}</p>
                          <p className="mt-1 text-xs text-neutral-500">{customer.email ?? "No email on file"}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-neutral-700">
                        {customer.tags.length > 0 ? customer.tags[0] : "General"}
                      </td>
                      <td className="px-4 py-4 text-neutral-700">{customer.phone ?? "—"}</td>
                      <td className="px-4 py-4 text-neutral-700">
                        {customer.lastServiceDate ? (
                          <TimeAgo value={customer.lastServiceDate} className="text-sm text-neutral-700" />
                        ) : (
                          "No service yet"
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <StatBadge label={dormant ? "Dormant" : "Active"} tone={dormant ? "orange" : "green"} />
                          {hasPlan ? <StatBadge label="Plan Active" tone="blue" /> : null}
                          {overdueInvoice ? <StatBadge label="Invoice Overdue" tone="red" /> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 font-semibold text-neutral-900">
                        {Number.parseFloat(customer.lifetimeValue ?? "0").toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD"
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="surface-card flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-neutral-500">
              Page {customersQuery.data.page} of {customersQuery.data.totalPages}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= customersQuery.data.totalPages}
                onClick={() => setPage((current) => current + 1)}
                className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}

      <CustomerForm open={customerFormOpen} onClose={() => setCustomerFormOpen(false)} />
    </motion.div>
  );
}
