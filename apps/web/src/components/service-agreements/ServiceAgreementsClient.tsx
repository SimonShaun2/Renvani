"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileClock, Plus, Search, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type {
  CreateAgreementInput,
  MaintenancePlanFrequency,
  ServiceAgreementBillingCycle
} from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Sheet } from "@/src/components/ui/Sheet";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { useCustomers } from "@/src/hooks/customers.hooks";
import {
  useCreateServiceAgreement,
  useServiceAgreements,
  useServiceAgreementTemplates,
  type ServiceAgreementListRecord,
  type ServiceAgreementTemplateRecord
} from "@/src/hooks/service-agreements.hooks";
import { getStoredSession } from "@/src/lib/auth";
import { cn, formatDate } from "@/src/lib/utils";
import { useAuthStore } from "@/src/stores/auth.store";
import { showToast } from "@/src/stores/toast.store";

type AgreementFilter = "all" | "active" | "pending" | "cancelled" | "expired" | "paused" | "expiring";

interface EnrollAgreementSheetProps {
  open: boolean;
  initialCustomerId: string | null;
  canCreate: boolean;
  templates: ServiceAgreementTemplateRecord[];
  onClose: () => void;
}

const FILTERS: Array<{ value: AgreementFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired", label: "Expired" },
  { value: "paused", label: "Paused" },
  { value: "expiring", label: "Expiring Soon" }
];

const SEARCH_DEBOUNCE_MS = 300;
const MONEY_SCALE = 10_000n;

function getAgreementStripeIssue(agreement: ServiceAgreementListRecord) {
  return agreement.stripeStatus === "past_due" ||
    agreement.stripeStatus === "unpaid" ||
    agreement.stripeStatus === "incomplete" ||
    agreement.stripeStatus === "incomplete_expired";
}

function isAgreementExpiringSoon(agreement: ServiceAgreementListRecord) {
  if (!agreement.stripeCancelAtPeriodEnd || !agreement.stripeCurrentPeriodEnd) {
    return false;
  }

  const periodEnd = new Date(agreement.stripeCurrentPeriodEnd);
  const now = new Date();
  const diffMs = periodEnd.getTime() - now.getTime();

  return diffMs >= 0 && diffMs <= 30 * 24 * 60 * 60 * 1000;
}

function getAgreementDisplayStatus(agreement: ServiceAgreementListRecord) {
  if (agreement.status === "cancelled") {
    return "Cancelled";
  }

  if (agreement.status === "expired") {
    return "Expired";
  }

  if (agreement.status === "paused") {
    return "Paused";
  }

  if (getAgreementStripeIssue(agreement)) {
    return "Pending";
  }

  return "Active";
}

function getAgreementStatusTone(agreement: ServiceAgreementListRecord) {
  const displayStatus = getAgreementDisplayStatus(agreement);

  switch (displayStatus) {
    case "Active":
      return "green" as const;
    case "Pending":
      return "orange" as const;
    case "Cancelled":
      return "red" as const;
    case "Expired":
      return "gray" as const;
    case "Paused":
      return "purple" as const;
    default:
      return "neutral" as const;
  }
}

function parseMoneyToScaledInteger(value: string) {
  const normalized = value.trim();

  if (!normalized) {
    return 0n;
  }

  const isNegative = normalized.startsWith("-");
  const unsigned = isNegative ? normalized.slice(1) : normalized;
  const [wholePartCandidate, fractionalPartCandidate] = unsigned.split(".", 2);
  const wholePart = wholePartCandidate && wholePartCandidate.length > 0 ? wholePartCandidate : "0";
  const fractionalDigits = `${fractionalPartCandidate ?? ""}0000`.slice(0, 4);
  const scaledValue = BigInt(wholePart) * MONEY_SCALE + BigInt(fractionalDigits);

  return isNegative ? -scaledValue : scaledValue;
}

function formatScaledMoney(value: bigint) {
  const isNegative = value < 0n;
  const absoluteValue = isNegative ? -value : value;
  const roundedCents = (absoluteValue + 50n) / 100n;
  const dollars = roundedCents / 100n;
  const cents = (roundedCents % 100n).toString().padStart(2, "0");

  return `${isNegative ? "-" : ""}${dollars.toString()}.${cents}`;
}

function getMonthlyRevenue(agreement: ServiceAgreementListRecord) {
  if (!agreement.price) {
    return 0n;
  }

  const scaledValue = parseMoneyToScaledInteger(agreement.price);

  if (agreement.billingCycle === "annual") {
    return scaledValue / 12n;
  }

  return scaledValue;
}

function matchesAgreementFilter(agreement: ServiceAgreementListRecord, filter: AgreementFilter) {
  switch (filter) {
    case "active":
      return getAgreementDisplayStatus(agreement) === "Active";
    case "pending":
      return getAgreementDisplayStatus(agreement) === "Pending";
    case "cancelled":
      return agreement.status === "cancelled";
    case "expired":
      return agreement.status === "expired";
    case "paused":
      return agreement.status === "paused";
    case "expiring":
      return isAgreementExpiringSoon(agreement);
    case "all":
    default:
      return true;
  }
}

function formatFrequencyLabel(frequency: MaintenancePlanFrequency) {
  switch (frequency) {
    case "bi_monthly":
      return "Every 2 months";
    case "bi_annual":
      return "Bi-annual";
    default:
      return frequency.charAt(0).toUpperCase() + frequency.slice(1).replace("_", " ");
  }
}

function SummaryCard({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  tone: "green" | "orange" | "purple" | "blue";
}) {
  const toneClass =
    tone === "green"
      ? "bg-success-light text-success"
      : tone === "orange"
        ? "bg-warning-light text-warning"
        : tone === "purple"
          ? "bg-ai-light text-ai"
          : "bg-brand-accent-light text-brand-accent";

  return (
    <div className="surface-card px-5 py-5">
      <div className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold", toneClass)}>
        {label}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-neutral-900">{value}</p>
      <p className="mt-2 text-sm text-neutral-500">{detail}</p>
    </div>
  );
}

function EnrollAgreementSheet({
  open,
  initialCustomerId,
  canCreate,
  templates,
  onClose
}: EnrollAgreementSheetProps) {
  const router = useRouter();
  const createAgreement = useCreateServiceAgreement();
  const customersQuery = useCustomers({
    page: 1,
    limit: 100,
    sortBy: "lastName",
    sortOrder: "asc"
  });
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [templateId, setTemplateId] = useState("");
  const [billingCycle, setBillingCycle] = useState<ServiceAgreementBillingCycle>("annual");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }

    setCustomerId(initialCustomerId ?? "");
    setTemplateId("");
    setBillingCycle("annual");
    setStartDate(new Date().toISOString().slice(0, 10));
    setNotes("");
  }, [initialCustomerId, open]);

  const activeTemplates = useMemo(
    () =>
      [...templates]
        .filter((template) => template.isActive)
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.name.localeCompare(right.name)),
    [templates]
  );
  const selectedTemplate = activeTemplates.find((template) => template.id === templateId) ?? null;
  const customerOptions = customersQuery.data?.data ?? [];

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    if (selectedTemplate.annualPrice) {
      setBillingCycle("annual");
      return;
    }

    if (selectedTemplate.monthlyPrice) {
      setBillingCycle("monthly");
    }
  }, [selectedTemplate]);

  const availableBillingCycles = useMemo(() => {
    if (!selectedTemplate) {
      return [] as ServiceAgreementBillingCycle[];
    }

    return [
      ...(selectedTemplate.monthlyPrice ? (["monthly"] as const) : []),
      ...(selectedTemplate.annualPrice ? (["annual"] as const) : [])
    ];
  }, [selectedTemplate]);

  async function handleSubmit() {
    if (!canCreate || !selectedTemplate || !customerId) {
      return;
    }

    const input: CreateAgreementInput = {
      customerId,
      serviceAgreementTemplateId: selectedTemplate.id,
      name: selectedTemplate.name,
      frequency: selectedTemplate.frequency,
      startDate,
      billingEnabled: availableBillingCycles.length > 0,
      ...(availableBillingCycles.length > 0 ? { billingCycle } : {}),
      ...(notes.trim() ? { notes: notes.trim() } : {})
    };

    try {
      const response = await createAgreement.mutateAsync(input);
      showToast({
        tone: "success",
        title: "Agreement enrolled",
        description: `${selectedTemplate.name} is now active for this customer.`
      });
      onClose();
      router.push(`/service-agreements/${response.agreement.id}`);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Agreement could not be created",
        description: error instanceof Error ? error.message : "Try again in a moment."
      });
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Enroll Customer"
      description="Select the customer, choose a plan template, and activate the agreement."
    >
      <div className="space-y-6 px-6 py-6">
        {!canCreate ? (
          <div className="rounded-[24px] border border-warning/20 bg-warning-light px-4 py-4 text-sm text-neutral-700">
            Only dispatcher, office, admin, and owner roles can enroll customers into service agreements.
          </div>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-semibold text-neutral-700">Customer</label>
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
          >
            <option value="">Select a customer</option>
            {customerOptions.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.displayName ?? `${customer.firstName} ${customer.lastName}`}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-neutral-700">Plan Template</label>
          <select
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
          >
            <option value="">Choose a template</option>
            {activeTemplates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </div>

        {selectedTemplate ? (
          <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-neutral-900">{selectedTemplate.name}</p>
                {selectedTemplate.description ? (
                  <p className="mt-2 text-sm leading-6 text-neutral-500">
                    {selectedTemplate.description}
                  </p>
                ) : null}
              </div>
              <StatBadge label={`${selectedTemplate.visitsPerYear} visits/yr`} tone="blue" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <StatBadge label={formatFrequencyLabel(selectedTemplate.frequency)} tone="neutral" />
              {selectedTemplate.monthlyPrice ? (
                <StatBadge label={`Monthly ${selectedTemplate.monthlyPrice}`} tone="green" />
              ) : null}
              {selectedTemplate.annualPrice ? (
                <StatBadge label={`Annual ${selectedTemplate.annualPrice}`} tone="orange" />
              ) : null}
            </div>
          </div>
        ) : null}

        {availableBillingCycles.length > 0 ? (
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Billing Cycle</label>
            <div className="grid gap-3 sm:grid-cols-2">
              {availableBillingCycles.map((cycle) => {
                const amount =
                  cycle === "annual"
                    ? selectedTemplate?.annualPrice ?? null
                    : selectedTemplate?.monthlyPrice ?? null;

                return (
                  <button
                    key={cycle}
                    type="button"
                    onClick={() => setBillingCycle(cycle)}
                    className={cn(
                      "rounded-[24px] border px-4 py-4 text-left transition",
                      billingCycle === cycle
                        ? "border-brand-accent bg-brand-accent-light"
                        : "border-neutral-200 bg-white hover:border-brand-accent/30"
                    )}
                  >
                    <p className="text-sm font-semibold text-neutral-900">
                      {cycle === "annual" ? "Annual Billing" : "Monthly Billing"}
                    </p>
                    {amount ? (
                      <p className="mt-2 text-sm text-neutral-500">
                        <CurrencyDisplay value={amount} showCents /> / {cycle === "annual" ? "year" : "month"}
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Coverage</label>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-500">
              Assets can be attached after enrollment from the agreement detail screen.
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold text-neutral-700">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Add internal setup notes or billing context."
            className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-700 outline-none transition focus:border-brand-accent"
          />
        </div>

        <div className="flex justify-end gap-3 border-t border-neutral-200 pt-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canCreate || !customerId || !selectedTemplate || createAgreement.isPending}
            onClick={() => {
              void handleSubmit();
            }}
            className="rounded-full bg-brand-accent px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {createAgreement.isPending ? "Enrolling..." : "Enroll Customer"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function ServiceAgreementsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const authUser = useAuthStore((state) => state.user);
  const [searchDraft, setSearchDraft] = useState(searchParams.get("search") ?? "");
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [filter, setFilter] = useState<AgreementFilter>("all");
  const [enrollOpen, setEnrollOpen] = useState(Boolean(searchParams.get("enrollCustomerId")));

  const fallbackSession = useMemo(() => (authUser ? null : getStoredSession()), [authUser]);
  const role = authUser?.role ?? fallbackSession?.role ?? null;
  const canCreate = role !== "technician";

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setSearch(searchDraft.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchDraft]);

  const agreementsQuery = useServiceAgreements({
    ...(filter === "active" ? { status: "active" } : {}),
    ...(filter === "cancelled" ? { status: "cancelled" } : {}),
    ...(filter === "expired" ? { status: "expired" } : {}),
    ...(filter === "paused" ? { status: "paused" } : {}),
    ...(search ? { search } : {}),
    sortBy: "nextServiceDate",
    sortOrder: "asc",
    page: 1,
    limit: 100
  });
  const templatesQuery = useServiceAgreementTemplates();

  const agreements = useMemo(() => {
    const rows = agreementsQuery.data?.data ?? [];
    return rows.filter((agreement) => matchesAgreementFilter(agreement, filter));
  }, [agreementsQuery.data?.data, filter]);

  const summary = useMemo(() => {
    const rows = agreementsQuery.data?.data ?? [];
    const activeAgreements = rows.filter((agreement) => getAgreementDisplayStatus(agreement) === "Active");
    const totalMrr = activeAgreements.reduce((total, agreement) => total + getMonthlyRevenue(agreement), 0n);
    const expiringSoon = rows.filter((agreement) => isAgreementExpiringSoon(agreement)).length;
    const failedPayments = rows.filter((agreement) => getAgreementStripeIssue(agreement)).length;

    return {
      totalMrr: formatScaledMoney(totalMrr),
      activePlans: activeAgreements.length,
      expiringSoon,
      failedPayments
    };
  }, [agreementsQuery.data?.data]);

  function openEnrollSheet() {
    if (!canCreate) {
      showToast({
        tone: "error",
        title: "Access restricted",
        description: "Technician accounts cannot enroll service agreements."
      });
      return;
    }

    setEnrollOpen(true);
  }

  function closeEnrollSheet() {
    setEnrollOpen(false);

    if (searchParams.get("enrollCustomerId")) {
      router.replace("/service-agreements");
    }
  }

  if (agreementsQuery.isLoading || templatesQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[128px]" />
        <SkeletonCard className="h-[560px]" />
      </div>
    );
  }

  if (agreementsQuery.isError) {
    return (
      <EmptyState variant="operator"
        icon={ShieldCheck}
        title="Service agreements unavailable"
        subtitle="The agreement dashboard could not be loaded right now. Refresh and try again."
      />
    );
  }

  const templates = templatesQuery.data?.templates ?? [];

  return (
    <>
      <PageLayout
        variant="operator"
        title="Service Agreements"
        subtitle="Track active plans, billing health, and upcoming renewals across your customer base."
        actions={(
          <>
            <button
              type="button"
              onClick={openEnrollSheet}
              className="inline-flex min-h-11 items-center gap-2 rounded-[10px] bg-[#f6b400] px-5 py-3 text-sm font-semibold text-[#0f1530] transition hover:bg-[#e0a400]"
            >
              <Plus className="h-4 w-4" />
              Enroll Customer
            </button>
            <button
              type="button"
              onClick={() => {
                document.getElementById("agreement-templates")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start"
                });
              }}
              className="rounded-full border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-100"
            >
              Manage Templates
            </button>
          </>
        )}
      >
        <section className="grid gap-4 xl:grid-cols-4">
          <SummaryCard
            label="Total MRR"
            value={`$${summary.totalMrr}`}
            detail="Active agreements only"
            tone="green"
          />
          <SummaryCard
            label="Active Plans"
            value={String(summary.activePlans)}
            detail="Customers currently covered"
            tone="blue"
          />
          <SummaryCard
            label="Expiring This Month"
            value={String(summary.expiringSoon)}
            detail="Scheduled to end in the next 30 days"
            tone="orange"
          />
          <SummaryCard
            label="Failed Payments"
            value={String(summary.failedPayments)}
            detail="Stripe past-due or unpaid subscriptions"
            tone="purple"
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="surface-card overflow-hidden">
            <div className="border-b border-neutral-200 px-5 py-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-wrap gap-2">
                  {FILTERS.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setFilter(item.value)}
                      className={cn(
                        "rounded-full px-4 py-2 text-sm font-semibold transition",
                        filter === item.value
                          ? "bg-brand-accent text-white"
                          : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                <label className="flex min-w-0 items-center gap-3 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-3 xl:w-[320px]">
                  <Search className="h-4 w-4 text-neutral-400" />
                  <input
                    value={searchDraft}
                    onChange={(event) => setSearchDraft(event.target.value)}
                    placeholder="Search plans or customers..."
                    className="min-w-0 flex-1 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
                  />
                </label>
              </div>
            </div>

            {agreements.length === 0 ? (
              <div className="px-6 py-12">
                <EmptyState variant="operator"
                  icon={ShieldCheck}
                  title="No agreements match this view"
                  subtitle="Try a different filter or broaden the search to see more plan enrollments."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-[0.18em] text-neutral-400">
                    <tr>
                      <th className="px-5 py-4">Customer</th>
                      <th className="px-5 py-4">Plan</th>
                      <th className="px-5 py-4">Billing</th>
                      <th className="px-5 py-4">MRR</th>
                      <th className="px-5 py-4">Next Renewal</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {agreements.map((agreement) => {
                      const nextRenewal = agreement.stripeCurrentPeriodEnd ?? agreement.nextServiceDate;
                      const monthlyRevenue = getMonthlyRevenue(agreement);

                      return (
                        <tr key={agreement.id} className="transition hover:bg-brand-accent-light/20">
                          <td className="px-5 py-4">
                            <div>
                              <p className="font-semibold text-neutral-900">
                                {agreement.customer.firstName} {agreement.customer.lastName}
                              </p>
                              <p className="mt-1 text-xs text-neutral-500">
                                Added {formatDate(agreement.createdAt)}
                              </p>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <p className="font-semibold text-neutral-900">{agreement.name}</p>
                            <p className="mt-1 text-xs text-neutral-500">
                              {formatFrequencyLabel(agreement.frequency)}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-neutral-600">
                            {agreement.billingCycle
                              ? agreement.billingCycle === "annual"
                                ? "Annual"
                                : "Monthly"
                              : "Manual"}
                          </td>
                          <td className="px-5 py-4 font-semibold text-neutral-900">
                            <CurrencyDisplay value={formatScaledMoney(monthlyRevenue)} showCents />
                          </td>
                          <td className="px-5 py-4 text-neutral-600">
                            {nextRenewal ? formatDate(nextRenewal) : "Not scheduled"}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatBadge
                                label={getAgreementDisplayStatus(agreement)}
                                tone={getAgreementStatusTone(agreement)}
                              />
                              {agreement.stripeStatus ? (
                                <StatBadge
                                  label={agreement.stripeStatus.replace("_", " ")}
                                  tone={getAgreementStripeIssue(agreement) ? "orange" : "gray"}
                                />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <Link
                              href={`/service-agreements/${agreement.id}`}
                              className="inline-flex rounded-full bg-neutral-100 px-4 py-2 text-sm font-semibold text-brand-accent transition hover:bg-brand-accent-light"
                            >
                              View Details
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside id="agreement-templates" className="surface-card px-5 py-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Plan Templates</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Pricing and visit cadence used when enrolling new customers.
                </p>
              </div>
              <StatBadge label={`${templates.length} active`} tone="blue" />
            </div>

            <div className="mt-5 space-y-4">
              {templates.length === 0 ? (
                <EmptyState variant="operator"
                  icon={FileClock}
                  title="No active templates"
                  subtitle="Create or reactivate a template before enrolling customers into a new plan."
                  compact
                />
              ) : (
                templates
                  .filter((template) => template.isActive)
                  .sort(
                    (left, right) =>
                      (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.name.localeCompare(right.name)
                  )
                  .map((template) => (
                    <div
                      key={template.id}
                      className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-base font-semibold text-neutral-900">{template.name}</p>
                          {template.description ? (
                            <p className="mt-2 text-sm leading-6 text-neutral-500">
                              {template.description}
                            </p>
                          ) : null}
                        </div>
                        <StatBadge label={`${template.visitsPerYear} visits`} tone="green" />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {template.monthlyPrice ? (
                          <StatBadge label={`Monthly ${template.monthlyPrice}`} tone="blue" />
                        ) : null}
                        {template.annualPrice ? (
                          <StatBadge label={`Annual ${template.annualPrice}`} tone="orange" />
                        ) : null}
                        <StatBadge label={formatFrequencyLabel(template.frequency)} tone="neutral" />
                      </div>
                    </div>
                  ))
              )}
            </div>
          </aside>
        </div>
      </PageLayout>

      <EnrollAgreementSheet
        open={enrollOpen}
        initialCustomerId={searchParams.get("enrollCustomerId")}
        canCreate={canCreate}
        templates={templates}
        onClose={closeEnrollSheet}
      />
    </>
  );
}
