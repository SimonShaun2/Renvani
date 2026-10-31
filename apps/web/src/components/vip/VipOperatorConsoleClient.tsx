"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Crown, Loader2, Pause, Plus, Settings2, Trash2, XCircle } from "lucide-react";
import type { CreateVipMembershipTierInput, UpdateVipMembershipTierInput } from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { Sheet } from "@/src/components/ui/Sheet";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import {
  useCancelVipMembership,
  useCreateVipTier,
  useDeleteVipTier,
  usePauseVipMembership,
  useUpdateVipPolicy,
  useUpdateVipTier,
  useVipMemberships,
  useVipPolicy,
  useVipTiers,
  type VipMembershipListRecord,
  type VipMembershipTierRecord
} from "@/src/hooks/vip-membership.hooks";
import { getStoredSession } from "@/src/lib/auth";
import { ApiError } from "@/src/lib/api";
import { cn, formatDate } from "@/src/lib/utils";
import { useAuthStore } from "@/src/stores/auth.store";
import { serviceFeeLineLabel } from "@/src/lib/service-fee-copy";

const VIP_TIER_FEE_NOTE = `Monthly price goes to the shop in full. The ${serviceFeeLineLabel()} is paid by the customer at checkout (none on the Flat plan).`;
import { showToast } from "@/src/stores/toast.store";

type MemberFilter = "all" | "active" | "grace" | "paused" | "cancelled";

const MEMBER_FILTERS: Array<{ value: MemberFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "grace", label: "Grace / past due" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" }
];

function customerName(customer: VipMembershipListRecord["customer"]) {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function isMembershipInGrace(member: VipMembershipListRecord) {
  return member.stripeStatus === "past_due" || member.stripeStatus === "unpaid";
}

function getMembershipLifecycle(member: VipMembershipListRecord) {
  if (member.status === "cancelled") {
    return { label: "Cancelled", tone: "red" as const };
  }

  if (member.status === "expired") {
    return { label: "Expired", tone: "gray" as const };
  }

  if (member.status === "paused") {
    return { label: "Paused", tone: "purple" as const };
  }

  if (isMembershipInGrace(member)) {
    return { label: "Grace / past due", tone: "orange" as const };
  }

  if (member.stripeCancelAtPeriodEnd) {
    return { label: "Cancelling", tone: "orange" as const };
  }

  return { label: "Active", tone: "green" as const };
}

function matchesMemberFilter(member: VipMembershipListRecord, filter: MemberFilter) {
  const lifecycle = getMembershipLifecycle(member).label;

  switch (filter) {
    case "active":
      return lifecycle === "Active" || lifecycle === "Cancelling";
    case "grace":
      return lifecycle === "Grace / past due";
    case "paused":
      return lifecycle === "Paused";
    case "cancelled":
      return lifecycle === "Cancelled" || lifecycle === "Expired";
    case "all":
    default:
      return true;
  }
}

interface TierFormState {
  name: string;
  description: string;
  monthlyPrice: string;
  discountPercent: string;
  includedVisitsPerMonth: string;
  isActive: boolean;
}

const emptyTierForm: TierFormState = {
  name: "",
  description: "",
  monthlyPrice: "",
  discountPercent: "10",
  includedVisitsPerMonth: "",
  isActive: true
};

function tierToForm(tier: VipMembershipTierRecord): TierFormState {
  return {
    name: tier.name,
    description: tier.description ?? "",
    monthlyPrice: tier.monthlyPrice,
    discountPercent: tier.discountPercent,
    includedVisitsPerMonth:
      tier.includedVisitsPerMonth === null ? "" : String(tier.includedVisitsPerMonth),
    isActive: tier.isActive
  };
}

function formToCreateInput(form: TierFormState): CreateVipMembershipTierInput {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    monthlyPrice: form.monthlyPrice.trim(),
    discountPercent: form.discountPercent.trim(),
    includedVisitsPerMonth:
      form.includedVisitsPerMonth.trim().length > 0
        ? Number.parseInt(form.includedVisitsPerMonth, 10)
        : null,
    isActive: form.isActive
  };
}

function formToUpdateInput(form: TierFormState): UpdateVipMembershipTierInput {
  return {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    monthlyPrice: form.monthlyPrice.trim(),
    discountPercent: form.discountPercent.trim(),
    includedVisitsPerMonth:
      form.includedVisitsPerMonth.trim().length > 0
        ? Number.parseInt(form.includedVisitsPerMonth, 10)
        : null,
    isActive: form.isActive
  };
}

export function VipOperatorConsoleClient() {
  const tiersQuery = useVipTiers();
  const membersQuery = useVipMemberships();
  const policyQuery = useVipPolicy();
  const createTier = useCreateVipTier();
  const updateTier = useUpdateVipTier();
  const deleteTier = useDeleteVipTier();
  const updatePolicy = useUpdateVipPolicy();
  const pauseMembership = usePauseVipMembership();
  const cancelMembership = useCancelVipMembership();

  const authUser = useAuthStore((state) => state.user);
  const role = authUser?.role ?? getStoredSession()?.role ?? null;
  const canManage = role === "owner" || role === "admin";

  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");
  const [tierSheetOpen, setTierSheetOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<VipMembershipTierRecord | null>(null);
  const [tierForm, setTierForm] = useState<TierFormState>(emptyTierForm);
  const [policyPauseMonths, setPolicyPauseMonths] = useState("");
  const [policyGraceDays, setPolicyGraceDays] = useState("");
  useEffect(() => {
    if (!policyQuery.data?.policy) {
      return;
    }

    setPolicyPauseMonths(String(policyQuery.data.policy.maxPauseMonths));
    setPolicyGraceDays(String(policyQuery.data.policy.pastDueGraceDays));
  }, [policyQuery.data?.policy]);

  const tiers = tiersQuery.data?.tiers ?? [];
  const members = membersQuery.data?.memberships ?? [];
  const filteredMembers = useMemo(
    () => members.filter((member) => matchesMemberFilter(member, memberFilter)),
    [members, memberFilter]
  );

  const summary = useMemo(() => {
    let active = 0;
    let grace = 0;
    let paused = 0;

    for (const member of members) {
      const lifecycle = getMembershipLifecycle(member).label;
      if (lifecycle === "Grace / past due") {
        grace += 1;
      } else if (lifecycle === "Paused") {
        paused += 1;
      } else if (lifecycle === "Active" || lifecycle === "Cancelling") {
        active += 1;
      }
    }

    return { active, grace, paused, total: members.length };
  }, [members]);

  const policyDirty =
    policyQuery.data?.policy &&
    (policyPauseMonths !== String(policyQuery.data.policy.maxPauseMonths) ||
      policyGraceDays !== String(policyQuery.data.policy.pastDueGraceDays));

  function openCreateTier() {
    setEditingTier(null);
    setTierForm(emptyTierForm);
    setTierSheetOpen(true);
  }

  function openEditTier(tier: VipMembershipTierRecord) {
    setEditingTier(tier);
    setTierForm(tierToForm(tier));
    setTierSheetOpen(true);
  }

  async function handleSaveTier() {
    if (!canManage) {
      return;
    }

    try {
      if (editingTier) {
        await updateTier.mutateAsync({ id: editingTier.id, input: formToUpdateInput(tierForm) });
        showToast({ tone: "success", title: "VIP tier updated" });
      } else {
        await createTier.mutateAsync(formToCreateInput(tierForm));
        showToast({ tone: "success", title: "VIP tier created" });
      }

      setTierSheetOpen(false);
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not save tier",
        description: error instanceof ApiError ? error.message : "Try again."
      });
    }
  }

  async function handleDeleteTier(tier: VipMembershipTierRecord) {
    if (!canManage || !window.confirm(`Delete tier “${tier.name}”?`)) {
      return;
    }

    try {
      await deleteTier.mutateAsync(tier.id);
      showToast({ tone: "success", title: "VIP tier removed" });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not delete tier",
        description: error instanceof ApiError ? error.message : "Try again."
      });
    }
  }

  async function handleSavePolicy() {
    if (!canManage || !policyDirty) {
      return;
    }

    const maxPauseMonths = Number.parseInt(policyPauseMonths, 10);
    const pastDueGraceDays = Number.parseInt(policyGraceDays, 10);

    try {
      await updatePolicy.mutateAsync({ maxPauseMonths, pastDueGraceDays });
      showToast({ tone: "success", title: "VIP policy saved" });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Could not save policy",
        description: error instanceof ApiError ? error.message : "Check values and try again."
      });
    }
  }

  async function handlePauseMember(member: VipMembershipListRecord) {
    if (!canManage) {
      return;
    }

    try {
      await pauseMembership.mutateAsync(member.id);
      showToast({ tone: "success", title: "Membership paused" });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Pause failed",
        description: error instanceof ApiError ? error.message : "Try again."
      });
    }
  }

  async function handleCancelMember(member: VipMembershipListRecord) {
    if (!canManage || !window.confirm(`Cancel VIP membership for ${customerName(member.customer)}?`)) {
      return;
    }

    try {
      await cancelMembership.mutateAsync({ membershipId: member.id });
      showToast({ tone: "success", title: "Cancellation scheduled" });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Cancel failed",
        description: error instanceof ApiError ? error.message : "Try again."
      });
    }
  }

  if (tiersQuery.isLoading || membersQuery.isLoading || policyQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[96px]" />
        <SkeletonCard className="h-[320px]" />
        <SkeletonCard className="h-[420px]" />
      </div>
    );
  }

  if (tiersQuery.isError || membersQuery.isError) {
    return (
      <PageLayout title="VIP memberships" subtitle="Operator console (Figma 61:2827 / 61:3133).">
        <EmptyState
          icon={Crown}
          title="VIP console unavailable"
          subtitle="Refresh to load tiers and members."
        />
      </PageLayout>
    );
  }

  const tierPending = createTier.isPending || updateTier.isPending;
  const memberActionPending = pauseMembership.isPending || cancelMembership.isPending;

  return (
    <>
      <PageLayout
        title="VIP memberships"
        subtitle="Operator console — tiers, members, pause and dunning policy (Figma 61:2827 / 61:3133)."
        actions={
          canManage ? (
            <button
              type="button"
              onClick={openCreateTier}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-4 text-sm font-semibold text-white transition hover:bg-brand-accent/90"
            >
              <Plus className="h-4 w-4" />
              New tier
            </button>
          ) : null
        }
      >
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Active members" value={String(summary.active)} tone="green" />
          <SummaryTile label="In grace / past due" value={String(summary.grace)} tone="orange" />
          <SummaryTile label="Paused" value={String(summary.paused)} tone="purple" />
          <SummaryTile label="Total memberships" value={String(summary.total)} tone="blue" />
        </div>

        <section className="mb-10 rounded-[28px] border border-neutral-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Settings2 className="mt-0.5 h-5 w-5 text-neutral-500" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-neutral-900">Pause & dunning policy</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Shop overrides for max pause duration and past-due grace before benefits lapse.
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-neutral-700">Max pause (months)</span>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    disabled={!canManage}
                    value={policyPauseMonths}
                    onChange={(event) => setPolicyPauseMonths(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-neutral-900"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-neutral-700">Past-due grace (days)</span>
                  <input
                    type="number"
                    min={1}
                    max={90}
                    disabled={!canManage}
                    value={policyGraceDays}
                    onChange={(event) => setPolicyGraceDays(event.target.value)}
                    className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5 text-neutral-900"
                  />
                </label>
              </div>
              {canManage ? (
                <button
                  type="button"
                  disabled={!policyDirty || updatePolicy.isPending}
                  onClick={() => {
                    void handleSavePolicy();
                  }}
                  className="mt-4 inline-flex min-h-10 items-center rounded-full bg-neutral-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {updatePolicy.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save policy"}
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <section className="mb-10">
          <h2 className="text-lg font-semibold text-neutral-900">VIP tiers</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {tiers.map((tier) => (
              <article
                key={tier.id}
                className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-neutral-900">{tier.name}</h3>
                    {tier.description ? (
                      <p className="mt-1 text-sm text-neutral-500">{tier.description}</p>
                    ) : null}
                  </div>
                  <StatBadge
                    label={tier.isActive ? "Active" : "Inactive"}
                    tone={tier.isActive ? "green" : "neutral"}
                  />
                </div>
                <p className="mt-3 text-sm text-neutral-600">
                  <CurrencyDisplay value={tier.monthlyPrice} />/mo · {tier.discountPercent}% service discount
                  {tier.includedVisitsPerMonth !== null
                    ? ` · ${tier.includedVisitsPerMonth} visits/mo`
                    : ""}
                </p>
                {canManage ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => openEditTier(tier)}
                      className="rounded-full px-3 py-1.5 text-xs font-semibold text-brand-accent ring-1 ring-brand-accent/30"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleDeleteTier(tier);
                      }}
                      className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-error ring-1 ring-error/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
            {tiers.length === 0 ? (
              <EmptyState
                icon={Crown}
                title="No VIP tiers yet"
                subtitle="Create a tier to start enrolling members."
                action={
                  canManage ? (
                    <button
                      type="button"
                      onClick={openCreateTier}
                      className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
                    >
                      Create tier
                    </button>
                  ) : undefined
                }
              />
            ) : null}
          </div>
        </section>

        <section>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">VIP members</h2>
            <div className="flex flex-wrap gap-2">
              {MEMBER_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setMemberFilter(filter.value)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                    memberFilter === filter.value
                      ? "bg-neutral-900 text-white"
                      : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  )}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[24px] border border-neutral-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-neutral-100 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Tier</th>
                  <th className="px-4 py-3 font-semibold">Lifecycle</th>
                  <th className="px-4 py-3 font-semibold">Price</th>
                  <th className="px-4 py-3 font-semibold">Since</th>
                  {canManage ? <th className="px-4 py-3 font-semibold">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const lifecycle = getMembershipLifecycle(member);

                  return (
                    <tr key={member.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-3">
                        <Link
                          href={`/customers/${member.customer.id}`}
                          className="font-medium text-brand-accent hover:underline"
                        >
                          {customerName(member.customer)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-700">{member.tierName}</td>
                      <td className="px-4 py-3">
                        <StatBadge label={lifecycle.label} tone={lifecycle.tone} />
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {member.monthlyPrice ? <CurrencyDisplay value={member.monthlyPrice} /> : "—"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600">{formatDate(member.startDate)}</td>
                      {canManage ? (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={memberActionPending || member.status !== "active"}
                              onClick={() => {
                                void handlePauseMember(member);
                              }}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-neutral-700 ring-1 ring-neutral-200 disabled:opacity-40"
                            >
                              <Pause className="h-3.5 w-3.5" />
                              Pause
                            </button>
                            <button
                              type="button"
                              disabled={
                                memberActionPending ||
                                member.status === "cancelled" ||
                                member.status === "expired"
                              }
                              onClick={() => {
                                void handleCancelMember(member);
                              }}
                              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-error ring-1 ring-error/20 disabled:opacity-40"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManage ? 6 : 5}
                      className="px-4 py-10 text-center text-neutral-500"
                    >
                      No memberships match this filter.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </PageLayout>

      <Sheet
        open={tierSheetOpen}
        title={editingTier ? "Edit VIP tier" : "New VIP tier"}
        description={VIP_TIER_FEE_NOTE}
        onClose={() => setTierSheetOpen(false)}
      >
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Name</span>
            <input
              value={tierForm.name}
              onChange={(event) => setTierForm((prev) => ({ ...prev, name: event.target.value }))}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Description</span>
            <textarea
              value={tierForm.description}
              onChange={(event) =>
                setTierForm((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={3}
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-neutral-700">Monthly price (USD)</span>
              <input
                value={tierForm.monthlyPrice}
                onChange={(event) =>
                  setTierForm((prev) => ({ ...prev, monthlyPrice: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-neutral-700">Discount %</span>
              <input
                value={tierForm.discountPercent}
                onChange={(event) =>
                  setTierForm((prev) => ({ ...prev, discountPercent: event.target.value }))
                }
                className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-neutral-700">Included visits / month (optional)</span>
            <input
              type="number"
              min={0}
              value={tierForm.includedVisitsPerMonth}
              onChange={(event) =>
                setTierForm((prev) => ({ ...prev, includedVisitsPerMonth: event.target.value }))
              }
              className="mt-1 w-full rounded-2xl border border-neutral-200 px-3 py-2.5"
            />
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
            <input
              type="checkbox"
              checked={tierForm.isActive}
              onChange={(event) =>
                setTierForm((prev) => ({ ...prev, isActive: event.target.checked }))
              }
            />
            Tier is active for new enrollments
          </label>
          <button
            type="button"
            disabled={tierPending || tierForm.name.trim().length === 0}
            onClick={() => {
              void handleSaveTier();
            }}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-brand-accent text-sm font-semibold text-white disabled:opacity-50"
          >
            {tierPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save tier"}
          </button>
        </div>
      </Sheet>
    </>
  );
}

function SummaryTile({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
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
    <div className="rounded-[24px] border border-neutral-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={cn("mt-2 text-3xl font-semibold tracking-tight", toneClass.split(" ")[1])}>
        {value}
      </p>
    </div>
  );
}
