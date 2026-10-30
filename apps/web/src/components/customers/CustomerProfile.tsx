"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserRound } from "lucide-react";

import { useCustomer, useCustomerAgreements, useCustomerInvoices, useCustomerJobs } from "@/src/hooks/customers.hooks";

import { ActivityTimeline } from "./ActivityTimeline";
import { CustomerNotesPanel } from "./CustomerNotesPanel";
import { AssetForm } from "./AssetForm";
import { CustomerForm } from "./CustomerForm";
import { CustomerTabs, type CustomerTabKey } from "./CustomerTabs";
import { PropertiesSection } from "./PropertiesSection";
import { PropertyForm } from "./PropertyForm";
import { getCustomerName } from "./customers.utils";
import { buildProfileKpis, buildProfileSubtitle } from "./profile/customer-profile.utils";
import { AgentProposalCard, ContactPropertyCard, CustomerJobsTable, EquipmentCard } from "./profile/ProfileSections";
import { ProfileKpiCard, profileButtonClass } from "./profile/ProfileUi";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";
import { useDeleteCustomer } from "@/src/hooks/customers.hooks";
import { ApiError } from "@/src/lib/api";

/**
 * Operator / 08 Customer profile (Figma 1:17, main 144:91).
 * Figma sections first (header 144:92, KPIs 144:100, notes/contact/equipment 144:118, jobs + agent 144:153);
 * existing operator tools (properties, tabs, activity) follow below as extension slots.
 */
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
  const kpis = buildProfileKpis({ customer, invoices, agreements, jobs });

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

      <header className="flex flex-wrap items-center gap-4">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
          <h1 className="break-words text-[32px] font-semibold text-[#0f1530]">{getCustomerName(customer)}</h1>
          <p className="mt-1.5 text-sm text-[#5e6684]">{buildProfileSubtitle(customer)}</p>
        </div>
        {customer.email && !customer.doNotContact ? (
          <a href={`mailto:${customer.email}`} className={profileButtonClass()}>
            Email customer
          </a>
        ) : null}
        <Link href={`/jobs?new=1&customerId=${customer.id}`} className={profileButtonClass("dark")}>
          New job
        </Link>
        <Link href={`/service-agreements?enrollCustomerId=${customer.id}`} className={profileButtonClass()}>
          New agreement
        </Link>
        <button type="button" onClick={() => setCustomerFormOpen(true)} className={profileButtonClass()}>
          Edit
        </button>
        <button type="button" onClick={() => setDeleteDialogOpen(true)} className={profileButtonClass()}>
          Delete
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <ProfileKpiCard key={kpi.key} kpi={kpi} />
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <CustomerNotesPanel customerId={customer.id} />
          <ContactPropertyCard customer={customer} agreements={agreements} />
          <EquipmentCard customer={customer} />
        </div>
        <div className="flex flex-col gap-4">
          <CustomerJobsTable jobs={jobs} />
          <AgentProposalCard customerId={customer.id} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <PropertiesSection
            customerId={customer.id}
            properties={customer.properties}
            onAddProperty={() => setPropertyFormOpen(true)}
            onAddAsset={(propertyId) => setAssetSheetPropertyId(propertyId)}
          />
          <CustomerTabs customerId={customer.id} activeTab={activeTab} onActiveTabChange={setActiveTab} />
        </div>
        <ActivityTimeline customerId={customer.id} />
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
