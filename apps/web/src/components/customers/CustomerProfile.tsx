"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserRound, Wrench } from "lucide-react";

import { useCustomer, useCustomerAgreements, useCustomerInvoices, useCustomerJobs } from "@/src/hooks/customers.hooks";

import { CustomerAISuggestions } from "./CustomerAISuggestions";
import { ActivityTimeline } from "./ActivityTimeline";
import { CustomerNotesPanel } from "./CustomerNotesPanel";
import { AssetForm } from "./AssetForm";
import { CustomerForm } from "./CustomerForm";
import { CustomerHeader } from "./CustomerHeader";
import { CustomerStats } from "./CustomerStats";
import { CustomerTabs, type CustomerTabKey } from "./CustomerTabs";
import { PropertiesSection } from "./PropertiesSection";
import { PropertyForm } from "./PropertyForm";
import { getAssetConditionPresentation, getAssetSeverity, getLastJobDate } from "./customers.utils";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";
import { TimeAgo } from "../ui/TimeAgo";
import { useDeleteCustomer } from "@/src/hooks/customers.hooks";
import { ApiError } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";

export function CustomerProfile({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<CustomerTabKey>("jobs");
  const [customerFormOpen, setCustomerFormOpen] = useState(false);
  const [propertyFormOpen, setPropertyFormOpen] = useState(false);
  const [assetSheetPropertyId, setAssetSheetPropertyId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const customerQuery = useCustomer(customerId);
  const agreementsQuery = useCustomerAgreements(customerId);
  const invoicesQuery = useCustomerInvoices(customerId);
  const recentJobsQuery = useCustomerJobs(customerId, {
    sortBy: "createdAt",
    sortOrder: "desc",
    page: 1,
    limit: 25
  });
  const deleteCustomer = useDeleteCustomer();

  if (customerQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[168px]" />
        <SkeletonCard className="h-[108px]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <SkeletonCard className="h-[420px]" />
            <SkeletonCard className="h-[520px]" />
          </div>
          <div className="space-y-6">
            <SkeletonCard className="h-[320px]" />
            <SkeletonCard className="h-[420px]" />
          </div>
        </div>
      </div>
    );
  }

  if (customerQuery.isError || !customerQuery.data) {
    return (
      <EmptyState
        icon={UserRound}
        title="Customer not found"
        subtitle="This customer may have been deleted or you may not have access to it in the current company."
        action={
          <Link
            href="/customers"
            className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
          >
            Back to customers
          </Link>
        }
      />
    );
  }

  const customer = customerQuery.data.customer;
  const agreements = agreementsQuery.data?.data ?? [];
  const invoices = invoicesQuery.data?.data ?? [];
  const jobs = recentJobsQuery.data?.data ?? [];
  const keyAssets = customer.properties
    .flatMap((property) => property.assets ?? [])
    .slice()
    .sort((left, right) => getAssetSeverity(right) - getAssetSeverity(left))
    .slice(0, 4);
  const lastJobDate = getLastJobDate(jobs);

  async function handleDeleteCustomer() {
    try {
      await deleteCustomer.mutateAsync(customer.id);
      router.push("/customers");
    } catch {
      setDeleteDialogOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/customers" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-accent">
        <ArrowLeft className="h-4 w-4" />
        All Customers
      </Link>

      <CustomerHeader
        customer={customer}
        agreements={agreements}
        invoices={invoices}
        onMessage={() => setActiveTab("communications")}
        onEdit={() => setCustomerFormOpen(true)}
        onDelete={() => setDeleteDialogOpen(true)}
      />

      <CustomerStats
        customerSince={customer.firstServiceDate ?? customer.createdAt}
        lifetimeValue={customer.lifetimeValue}
        totalJobs={customer.totalJobs}
        lastJobDate={lastJobDate}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <PropertiesSection
            customerId={customer.id}
            properties={customer.properties}
            onAddProperty={() => setPropertyFormOpen(true)}
            onAddAsset={(propertyId) => setAssetSheetPropertyId(propertyId)}
          />

          <section className="surface-card px-6 py-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Key Assets ({keyAssets.length})</h2>
              <Link href={`/customers/${customer.id}/properties/${customer.properties[0]?.id ?? ""}`} className="text-sm font-semibold text-brand-accent">
                View properties
              </Link>
            </div>
            {keyAssets.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  icon={Wrench}
                  title="No assets yet"
                  subtitle="Assets added to this customer’s properties will surface here automatically."
                  compact
                />
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {keyAssets.map((asset) => {
                  const condition = getAssetConditionPresentation(asset);

                  return (
                    <div key={asset.id} className="flex flex-col gap-3 rounded-[24px] border border-neutral-200 px-4 py-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{asset.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                          <span>{asset.installDate ? `Installed ${asset.installDate}` : "Install date unknown"}</span>
                          {asset.lastServiceDate ? (
                            <>
                              <span>•</span>
                              <span>
                                Last service <TimeAgo value={asset.lastServiceDate} className="inline text-sm text-neutral-500" />
                              </span>
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
                            condition.tone === "green" && "bg-success-light text-success",
                            condition.tone === "orange" && "bg-warning-light text-warning",
                            condition.tone === "red" && "bg-error-light text-error",
                            condition.tone === "gray" && "bg-neutral-100 text-neutral-500",
                            condition.pulse && "animate-pulse"
                          )}
                        >
                          {condition.label}
                        </span>
                        <div className="text-right text-sm text-neutral-500">
                          <p>Condition</p>
                          <p className="font-semibold text-neutral-900">{asset.conditionScore ?? "—"}</p>
                        </div>
                        <Link
                          href={`/customers/${customer.id}/assets/${asset.id}?propertyId=${asset.propertyId}`}
                          className="text-sm font-semibold text-brand-accent"
                        >
                          View Asset
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <CustomerTabs customerId={customer.id} activeTab={activeTab} onActiveTabChange={setActiveTab} />
        </div>

        <div className="space-y-6">
          <CustomerAISuggestions customerId={customer.id} />
          <CustomerNotesPanel customerId={customer.id} />
          <ActivityTimeline customerId={customer.id} />
        </div>
      </div>

      <CustomerForm
        open={customerFormOpen}
        onClose={() => setCustomerFormOpen(false)}
        customer={customer}
      />
      <PropertyForm
        open={propertyFormOpen}
        onClose={() => setPropertyFormOpen(false)}
        customerId={customer.id}
      />
      <AssetForm
        open={Boolean(assetSheetPropertyId)}
        onClose={() => setAssetSheetPropertyId(null)}
        customerId={customer.id}
        propertyId={assetSheetPropertyId ?? customer.properties[0]?.id ?? ""}
      />
      <ConfirmDialog
        open={deleteDialogOpen}
        title="Delete customer?"
        description="This will soft-delete the customer and associated properties and assets. The record will disappear from the active customer list."
        confirmLabel="Delete customer"
        confirmTone="danger"
        isPending={deleteCustomer.isPending}
        onCancel={() => setDeleteDialogOpen(false)}
        onConfirm={() => {
          void handleDeleteCustomer();
        }}
      />
      {deleteCustomer.error instanceof ApiError ? (
        <p className="rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
          {deleteCustomer.error.message}
        </p>
      ) : null}
    </div>
  );
}
