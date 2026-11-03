"use client";

import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { api } from "@/src/lib/api";

interface AgreementPortalView {
  agreementName: string;
  companyName: string;
  brandName: string;
  portalUrl: string;
  amountDue: string | null;
  dueDate: string | null;
  paymentMethodLabel: string | null;
  stripeStatus: string;
  payOnRenvaniMessage: string;
}

export default function AgreementPortalPage() {
  const params = useParams<{ token: string }>();
  const portalQuery = useQuery({
    queryKey: ["agreement-portal", params.token],
    queryFn: () => api.get<AgreementPortalView>(`/api/v1/public/agreements/portal/${params.token}`)
  });

  if (portalQuery.isLoading || !portalQuery.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <Loader2 className="h-10 w-10 animate-spin text-brand-accent" />
      </div>
    );
  }

  const portal = portalQuery.data;

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="w-full max-w-lg rounded-[32px] border border-neutral-200 bg-white px-8 py-10 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
          {portal.brandName} · maintenance billing
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-neutral-900">{portal.agreementName}</h1>
        <p className="mt-2 text-sm text-neutral-500">{portal.companyName}</p>
        <dl className="mt-8 space-y-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-neutral-600">Status</dt>
            <dd className="font-medium text-neutral-900">{portal.stripeStatus}</dd>
          </div>
          {portal.amountDue ? (
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">Amount due</dt>
              <dd className="font-medium text-neutral-900">${portal.amountDue}</dd>
            </div>
          ) : null}
          {portal.dueDate ? (
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">Due date</dt>
              <dd className="font-medium text-neutral-900">{portal.dueDate}</dd>
            </div>
          ) : null}
          {portal.paymentMethodLabel ? (
            <div className="flex justify-between gap-4">
              <dt className="text-neutral-600">Payment method</dt>
              <dd className="font-medium text-neutral-900">{portal.paymentMethodLabel}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-6 text-xs leading-5 text-neutral-500">{portal.payOnRenvaniMessage}</p>
      </div>
    </div>
  );
}
