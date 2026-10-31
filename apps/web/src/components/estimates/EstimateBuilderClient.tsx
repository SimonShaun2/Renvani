"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, ChevronDown, MonitorSmartphone, Send, WandSparkles } from "lucide-react";
import { addHours, format } from "date-fns";
import type { CreateEstimateInput, EstimateStatus } from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { Sheet } from "@/src/components/ui/Sheet";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import { useCustomers, useCustomer, useCustomerJobs } from "@/src/hooks/customers.hooks";
import { useCreateInvoice } from "@/src/hooks/invoices.hooks";
import { useCompany } from "@/src/hooks/jobs.hooks";
import {
  useEstimateGroup,
  type EstimateDetailRecord,
  type EstimateGroupRecord,
  type PublicEstimateRecord
} from "@/src/hooks/estimates.hooks";
import { useDispatchView } from "@/src/hooks/dispatch.hooks";
import { api } from "@/src/lib/api";
import { publicApi } from "@/src/lib/public-api";
import { cn } from "@/src/lib/utils";
import { getCompanyTaxRate } from "@/src/components/jobs/jobs.utils";

import { CustomerEstimateView } from "./CustomerEstimateView";
import { EditableLineItemsTable } from "./EditableLineItemsTable";
import { EstimateSendModal } from "./EstimateSendModal";
import { EstimateChecksPanel, EstimateFrequencyOptions, EstimateTotalsCard } from "./EstimateFigmaPanels";
import { buildEstimateSubtitle, canSendEstimate } from "./estimate-builder.utils";
import {
  buildEstimatePublicPath,
  computeRevenueTotals,
  formatMoneyInput,
  formatStatusLabel,
  formatQuantityInput,
  getEstimateStatusTone,
  groupEstimateDetails,
  lineItemFromEstimateItem,
  normalizeLineItems,
  parseMoneyValue,
  type RevenueLineItemDraft
} from "./estimates.utils";

type EstimateMode = "single" | "tiers";
type TierKey = "single" | "good" | "better" | "best";
type SaveState = "idle" | "saving" | "saved" | "error";

interface EstimateTierDraft {
  key: TierKey;
  label: string | null;
  estimateId: string | null;
  estimateNumber: string | null;
  approvalToken: string | null;
  status: EstimateStatus;
  isSelectedTier: boolean;
  items: RevenueLineItemDraft[];
}

interface EstimateDraftState {
  mode: EstimateMode;
  customerId: string;
  propertyId: string;
  jobId: string;
  title: string;
  messageToCustomer: string;
  financingOffered: boolean;
  discountAmount: string;
  single: EstimateTierDraft;
  tiers: EstimateTierDraft[];
}

interface ConvertFormState {
  title: string;
  technicianId: string;
  scheduledDate: string;
  scheduledTime: string;
}

interface DeclineFormState {
  reason: string;
}

const emptyDeclineForm: DeclineFormState = {
  reason: ""
};

function createEmptyTier(key: TierKey, label: string | null): EstimateTierDraft {
  return {
    key,
    label,
    estimateId: null,
    estimateNumber: null,
    approvalToken: null,
    status: "draft",
    isSelectedTier: label?.toLowerCase() === "better",
    items: []
  };
}

function createDefaultDraft(): EstimateDraftState {
  return {
    mode: "single",
    customerId: "",
    propertyId: "",
    jobId: "",
    title: "",
    messageToCustomer: "",
    financingOffered: false,
    discountAmount: "0.00",
    single: createEmptyTier("single", null),
    tiers: [
      createEmptyTier("good", "Good"),
      createEmptyTier("better", "Better"),
      createEmptyTier("best", "Best")
    ]
  };
}

function buildDraftFromEstimateGroup(group: EstimateGroupRecord): EstimateDraftState {
  const orderedEstimates = groupEstimateDetails(group.estimates);
  const primary = group.primary;

  if (!primary.tierGroupId) {
    return {
      mode: "single",
      customerId: primary.customerId,
      propertyId: primary.propertyId ?? "",
      jobId: primary.jobId ?? "",
      title: primary.title ?? "",
      messageToCustomer: primary.messageToCustomer ?? "",
      financingOffered: Boolean(primary.financingOffered),
      discountAmount: formatMoneyInput(primary.discountAmount ?? "0"),
      single: {
        key: "single",
        label: null,
        estimateId: primary.id,
        estimateNumber: primary.estimateNumber,
        approvalToken: primary.approvalToken,
        status: primary.status,
        isSelectedTier: Boolean(primary.isSelectedTier),
        items: normalizeLineItems(primary.items.map((item) => lineItemFromEstimateItem(item)))
      },
      tiers: [
        createEmptyTier("good", "Good"),
        createEmptyTier("better", "Better"),
        createEmptyTier("best", "Best")
      ]
    };
  }

  const tierMap = new Map(orderedEstimates.map((estimate) => [estimate.tierLabel?.toLowerCase() ?? "", estimate]));
  const good = tierMap.get("good");
  const better = tierMap.get("better");
  const best = tierMap.get("best");
  const anchor = better ?? orderedEstimates[0] ?? primary;

  return {
    mode: "tiers",
    customerId: anchor.customerId,
    propertyId: anchor.propertyId ?? "",
    jobId: anchor.jobId ?? "",
    title: anchor.title ?? "",
    messageToCustomer: anchor.messageToCustomer ?? "",
    financingOffered: Boolean(anchor.financingOffered),
    discountAmount: formatMoneyInput(anchor.discountAmount ?? "0"),
    single: createEmptyTier("single", null),
    tiers: [
      {
        key: "good",
        label: "Good",
        estimateId: good?.id ?? null,
        estimateNumber: good?.estimateNumber ?? null,
        approvalToken: good?.approvalToken ?? null,
        status: good?.status ?? "draft",
        isSelectedTier: Boolean(good?.isSelectedTier),
        items: normalizeLineItems((good?.items ?? []).map((item) => lineItemFromEstimateItem(item)))
      },
      {
        key: "better",
        label: "Better",
        estimateId: better?.id ?? null,
        estimateNumber: better?.estimateNumber ?? null,
        approvalToken: better?.approvalToken ?? null,
        status: better?.status ?? "draft",
        isSelectedTier: Boolean(better?.isSelectedTier) || !orderedEstimates.some((estimate) => estimate.isSelectedTier),
        items: normalizeLineItems((better?.items ?? []).map((item) => lineItemFromEstimateItem(item)))
      },
      {
        key: "best",
        label: "Best",
        estimateId: best?.id ?? null,
        estimateNumber: best?.estimateNumber ?? null,
        approvalToken: best?.approvalToken ?? null,
        status: best?.status ?? "draft",
        isSelectedTier: Boolean(best?.isSelectedTier),
        items: normalizeLineItems((best?.items ?? []).map((item) => lineItemFromEstimateItem(item)))
      }
    ]
  };
}

function getDraftSignature(draft: EstimateDraftState): string {
  return JSON.stringify({
    mode: draft.mode,
    customerId: draft.customerId,
    propertyId: draft.propertyId,
    jobId: draft.jobId,
    title: draft.title,
    messageToCustomer: draft.messageToCustomer,
    financingOffered: draft.financingOffered,
    discountAmount: formatMoneyInput(draft.discountAmount),
    single: draft.single.items.map((item) => ({
      name: item.name,
      description: item.description,
      itemType: item.itemType,
      quantity: formatQuantityInput(item.quantity),
      unitPrice: formatMoneyInput(item.unitPrice),
      isTaxable: item.isTaxable,
      sortOrder: item.sortOrder
    })),
    tiers: draft.tiers.map((tier) => ({
      key: tier.key,
      label: tier.label,
      items: tier.items.map((item) => ({
        name: item.name,
        description: item.description,
        itemType: item.itemType,
        quantity: formatQuantityInput(item.quantity),
        unitPrice: formatMoneyInput(item.unitPrice),
        isTaxable: item.isTaxable,
        sortOrder: item.sortOrder
      }))
    }))
  });
}

function getEstimateViewStatus(primaryStatus: EstimateStatus): EstimateStatus {
  if (primaryStatus === "viewed") {
    return "sent";
  }

  return primaryStatus;
}

function toEstimateLineItemPayload(item: RevenueLineItemDraft, index: number) {
  return {
    name: item.name,
    ...(item.description ? { description: item.description } : {}),
    itemType: item.itemType,
    quantity: parseMoneyValue(item.quantity),
    unitPrice: parseMoneyValue(item.unitPrice),
    isTaxable: item.isTaxable,
    sortOrder: index,
    ...(item.priceBookItemId ? { priceBookItemId: item.priceBookItemId } : {})
  };
}

function buildCreateEstimateInput(
  draft: EstimateDraftState,
  tier: EstimateTierDraft,
  taxRate: number,
  tierGroupId?: string
): CreateEstimateInput {
  return {
    customerId: draft.customerId,
    ...(draft.propertyId ? { propertyId: draft.propertyId } : {}),
    ...(draft.jobId ? { jobId: draft.jobId } : {}),
    ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
    ...(draft.messageToCustomer.trim() ? { messageToCustomer: draft.messageToCustomer.trim() } : {}),
    discountAmount: parseMoneyValue(draft.discountAmount),
    taxRate,
    financingOffered: draft.financingOffered,
    ...(tier.label ? { tierLabel: tier.label } : {}),
    ...(tierGroupId ? { tierGroupId } : {}),
    items: normalizeLineItems(tier.items).map((item, index) => toEstimateLineItemPayload(item, index))
  };
}

function buildPublicEstimatePreview(draft: EstimateDraftState, taxRate: number): PublicEstimateRecord {
  if (draft.mode === "single") {
    const totals = computeRevenueTotals(draft.single.items, taxRate, parseMoneyValue(draft.discountAmount));
    return {
      estimateNumber: draft.single.estimateNumber ?? "DRAFT",
      title: draft.title || "Estimate",
      status: draft.single.status,
      messageToCustomer: draft.messageToCustomer || null,
      subtotal: formatMoneyInput(totals.subtotal),
      taxRate: formatMoneyInput(taxRate),
      taxAmount: formatMoneyInput(totals.taxAmount),
      discountAmount: formatMoneyInput(totals.discountAmount),
      total: formatMoneyInput(totals.total),
      financingOffered: draft.financingOffered,
      tierLabel: null,
      expiresAt: null,
      tiers: null,
      items: normalizeLineItems(draft.single.items).map((item) => ({
        name: item.name,
        description: item.description || null,
        quantity: formatQuantityInput(item.quantity),
        unitPrice: formatMoneyInput(item.unitPrice),
        total: formatMoneyInput(parseMoneyValue(item.quantity) * parseMoneyValue(item.unitPrice))
      }))
    };
  }

  const tiers = draft.tiers.map((tier) => {
    const totals = computeRevenueTotals(tier.items, taxRate, parseMoneyValue(draft.discountAmount));
    return {
      estimateNumber: tier.estimateNumber ?? tier.key.toUpperCase(),
      title: draft.title || `Option ${tier.label ?? tier.key}`,
      tierLabel: tier.label,
      subtotal: formatMoneyInput(totals.subtotal),
      taxRate: formatMoneyInput(taxRate),
      taxAmount: formatMoneyInput(totals.taxAmount),
      discountAmount: formatMoneyInput(totals.discountAmount),
      total: formatMoneyInput(totals.total),
      items: normalizeLineItems(tier.items).map((item) => ({
        name: item.name,
        description: item.description || null,
        quantity: formatQuantityInput(item.quantity),
        unitPrice: formatMoneyInput(item.unitPrice),
        total: formatMoneyInput(parseMoneyValue(item.quantity) * parseMoneyValue(item.unitPrice))
      }))
    };
  });
  const selectedTier = tiers[1] ?? tiers[0];

  return {
    estimateNumber: selectedTier?.estimateNumber ?? "DRAFT",
    title: draft.title || "Estimate Options",
    status: draft.tiers.some((tier) => tier.status === "approved") ? "approved" : draft.tiers[0]?.status ?? "draft",
    messageToCustomer: draft.messageToCustomer || null,
    subtotal: selectedTier?.subtotal ?? "0.00",
    taxRate: selectedTier?.taxRate ?? formatMoneyInput(taxRate),
    taxAmount: selectedTier?.taxAmount ?? "0.00",
    discountAmount: selectedTier?.discountAmount ?? formatMoneyInput(draft.discountAmount),
    total: selectedTier?.total ?? "0.00",
    financingOffered: draft.financingOffered,
    tierLabel: selectedTier?.tierLabel ?? "Better",
    expiresAt: null,
    tiers,
    items: selectedTier?.items ?? []
  };
}

function getAnchorTier(draft: EstimateDraftState): EstimateTierDraft | null {
  if (draft.mode === "single") {
    return draft.single.estimateId ? draft.single : null;
  }

  return draft.tiers.find((tier) => tier.isSelectedTier && tier.estimateId)
    ?? draft.tiers.find((tier) => tier.key === "better" && tier.estimateId)
    ?? draft.tiers.find((tier) => tier.estimateId)
    ?? null;
}

function getSelectedEstimateForAction(draft: EstimateDraftState, activeTierKey: TierKey): EstimateTierDraft | null {
  if (draft.mode === "single") {
    return draft.single.estimateId ? draft.single : null;
  }

  return draft.tiers.find((tier) => tier.key === activeTierKey && tier.estimateId)
    ?? getAnchorTier(draft);
}

function getConvertDefaults(draft: EstimateDraftState): ConvertFormState {
  return {
    title: draft.title || "Scheduled job",
    technicianId: "",
    scheduledDate: format(new Date(), "yyyy-MM-dd"),
    scheduledTime: "09:00"
  };
}

export function EstimateBuilderClient({ estimateId }: { estimateId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const groupQuery = useEstimateGroup(estimateId ?? null);
  const companyQuery = useCompany();
  const customersQuery = useCustomers({
    page: 1,
    limit: 100,
    sortBy: "lastName",
    sortOrder: "asc"
  });
  const createInvoice = useCreateInvoice();

  const [draft, setDraft] = useState<EstimateDraftState>(() => createDefaultDraft());
  const [activeTierKey, setActiveTierKey] = useState<TierKey>("single");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [customerViewOpen, setCustomerViewOpen] = useState(false);
  const [customerViewApproved, setCustomerViewApproved] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [convertForm, setConvertForm] = useState<ConvertFormState>(() => getConvertDefaults(createDefaultDraft()));
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineForm, setDeclineForm] = useState<DeclineFormState>(emptyDeclineForm);
  const [editingOverride, setEditingOverride] = useState(false);
  const [saveNow, setSaveNow] = useState(0);
  const saveNowRef = useRef(false);

  const hydratedEstimateIdRef = useRef<string | null>(null);
  const savedSignatureRef = useRef<string>(getDraftSignature(createDefaultDraft()));
  const draftSignature = getDraftSignature(draft);
  const isDirty = draftSignature !== savedSignatureRef.current;

  const selectedCustomerId = draft.customerId || null;
  const customerDetailQuery = useCustomer(selectedCustomerId);
  const customerJobsQuery = useCustomerJobs(selectedCustomerId, {
    page: 1,
    limit: 100,
    sortBy: "createdAt",
    sortOrder: "desc"
  });

  const scheduleDate = convertForm.scheduledDate || format(new Date(), "yyyy-MM-dd");
  const dispatchViewQuery = useDispatchView(scheduleDate);

  const primaryEstimate = groupQuery.data?.primary;
  const currentStatus = primaryEstimate ? getEstimateViewStatus(primaryEstimate.status) : "draft";
  const isExisting = Boolean(estimateId);
  const isEditable = !isExisting || editingOverride || currentStatus === "draft" || currentStatus === "revised";
  const taxRate = primaryEstimate?.taxRate
    ? parseMoneyValue(primaryEstimate.taxRate)
    : getCompanyTaxRate(companyQuery.data?.company.settings);
  const preview = useMemo(() => buildPublicEstimatePreview(draft, taxRate), [draft, taxRate]);
  const activeTier =
    draft.mode === "single"
      ? draft.single
      : draft.tiers.find((tier) => tier.key === activeTierKey)
        ?? draft.tiers[1]
        ?? draft.tiers[0]
        ?? createEmptyTier("better", "Better");
  const activeTotals = computeRevenueTotals(activeTier.items, taxRate, parseMoneyValue(draft.discountAmount));
  const anchorTier = getAnchorTier(draft);
  const anchorPublicPath = buildEstimatePublicPath(anchorTier?.approvalToken);
  const anchorPublicUrl =
    typeof window !== "undefined" && anchorPublicPath ? `${window.location.origin}${anchorPublicPath}` : anchorPublicPath;

  useEffect(() => {
    if (!groupQuery.data || hydratedEstimateIdRef.current === groupQuery.data.primary.id) {
      return;
    }

    const nextDraft = buildDraftFromEstimateGroup(groupQuery.data);
    hydratedEstimateIdRef.current = groupQuery.data.primary.id;
    savedSignatureRef.current = getDraftSignature(nextDraft);
    setDraft(nextDraft);
    setActiveTierKey(nextDraft.mode === "tiers" ? "better" : "single");
    setConvertForm(getConvertDefaults(nextDraft));
    setEditingOverride(false);
    setCustomerViewApproved(false);
    setSaveState("idle");
    setErrorMessage(null);
  }, [groupQuery.data]);

  useEffect(() => {
    if (!isEditable || !draft.customerId || draftSignature === savedSignatureRef.current) {
      return;
    }

    const delay = saveNowRef.current ? 0 : 2000;
    const timeoutId = window.setTimeout(() => {
      saveNowRef.current = false;
      void (async () => {
        setSaveState("saving");
        setErrorMessage(null);

        try {
          if (draft.mode === "single") {
            const singleTier = draft.single;

            if (!singleTier.estimateId) {
              const response = await api.post<{ estimate: EstimateDetailRecord }>(
                "/api/v1/estimates",
                buildCreateEstimateInput(draft, singleTier, taxRate)
              );
              const created = response.estimate;
              const nextDraft: EstimateDraftState = {
                ...draft,
                single: {
                  ...draft.single,
                  estimateId: created.id,
                  estimateNumber: created.estimateNumber,
                  approvalToken: created.approvalToken,
                  status: created.status,
                  isSelectedTier: Boolean(created.isSelectedTier)
                }
              };
              savedSignatureRef.current = draftSignature;
              setDraft(nextDraft);
              setSaveState("saved");
              router.replace(`/estimates/${created.id}`);
              return;
            }

            await api.patch<{ estimate: EstimateDetailRecord }>(`/api/v1/estimates/${singleTier.estimateId}`, {
              ...(draft.customerId ? { customerId: draft.customerId } : {}),
              ...(draft.propertyId ? { propertyId: draft.propertyId } : {}),
              ...(draft.jobId ? { jobId: draft.jobId } : {}),
              ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
              messageToCustomer: draft.messageToCustomer,
              financingOffered: draft.financingOffered,
              discountAmount: parseMoneyValue(draft.discountAmount),
              taxRate
            });

            const latestDetail = await api.get<{ estimate: EstimateDetailRecord }>(
              `/api/v1/estimates/${singleTier.estimateId}`
            );
            const existingById = new Map(latestDetail.estimate.items.map((item) => [item.id, item]));
            const normalizedItems = normalizeLineItems(singleTier.items);

            for (const [index, item] of normalizedItems.entries()) {
                if (!item.id) {
                  await api.post(`/api/v1/estimates/${singleTier.estimateId}/items`, toEstimateLineItemPayload(item, index));
                continue;
              }

              const existing = existingById.get(item.id);
              if (!existing) {
                continue;
              }

              const normalizedExisting = lineItemFromEstimateItem(existing);
              if (
                normalizedExisting.name === item.name &&
                normalizedExisting.description === item.description &&
                normalizedExisting.itemType === item.itemType &&
                formatQuantityInput(normalizedExisting.quantity) === formatQuantityInput(item.quantity) &&
                formatMoneyInput(normalizedExisting.unitPrice) === formatMoneyInput(item.unitPrice) &&
                normalizedExisting.isTaxable === item.isTaxable &&
                normalizedExisting.sortOrder === item.sortOrder &&
                (normalizedExisting.priceBookItemId ?? null) === (item.priceBookItemId ?? null)
              ) {
                continue;
              }

              await api.patch(`/api/v1/estimates/${singleTier.estimateId}/items/${item.id}`, toEstimateLineItemPayload(item, index));
            }

            const localIds = new Set(normalizedItems.map((item) => item.id).filter((value): value is string => Boolean(value)));
            for (const existing of latestDetail.estimate.items) {
              if (!localIds.has(existing.id)) {
                await api.delete(`/api/v1/estimates/${singleTier.estimateId}/items/${existing.id}`);
              }
            }
          } else {
            const currentGroupId = draft.tiers.find((tier) => tier.estimateId)?.estimateId
              ? groupQuery.data?.primary.tierGroupId ?? crypto.randomUUID()
              : crypto.randomUUID();

            const nextTiers: EstimateTierDraft[] = [];

            for (const tier of draft.tiers) {
              if (!tier.estimateId) {
                const response = await api.post<{ estimate: EstimateDetailRecord }>(
                  "/api/v1/estimates",
                  buildCreateEstimateInput(draft, tier, taxRate, currentGroupId)
                );
                nextTiers.push({
                  ...tier,
                  estimateId: response.estimate.id,
                  estimateNumber: response.estimate.estimateNumber,
                  approvalToken: response.estimate.approvalToken,
                  status: response.estimate.status,
                  isSelectedTier: Boolean(response.estimate.isSelectedTier)
                });
                continue;
              }

              await api.patch<{ estimate: EstimateDetailRecord }>(`/api/v1/estimates/${tier.estimateId}`, {
                customerId: draft.customerId,
                ...(draft.propertyId ? { propertyId: draft.propertyId } : {}),
                ...(draft.jobId ? { jobId: draft.jobId } : {}),
                ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
                messageToCustomer: draft.messageToCustomer,
                financingOffered: draft.financingOffered,
                discountAmount: parseMoneyValue(draft.discountAmount),
                taxRate,
                tierLabel: tier.label ?? undefined,
                tierGroupId: currentGroupId
              });

              const latestDetail = await api.get<{ estimate: EstimateDetailRecord }>(
                `/api/v1/estimates/${tier.estimateId}`
              );
              const existingById = new Map(latestDetail.estimate.items.map((item) => [item.id, item]));
              const normalizedItems = normalizeLineItems(tier.items);

              for (const [index, item] of normalizedItems.entries()) {
                if (!item.id) {
                  await api.post(`/api/v1/estimates/${tier.estimateId}/items`, toEstimateLineItemPayload(item, index));
                  continue;
                }

                const existing = existingById.get(item.id);
                if (!existing) {
                  continue;
                }

                const normalizedExisting = lineItemFromEstimateItem(existing);
                if (
                  normalizedExisting.name === item.name &&
                  normalizedExisting.description === item.description &&
                  normalizedExisting.itemType === item.itemType &&
                  formatQuantityInput(normalizedExisting.quantity) === formatQuantityInput(item.quantity) &&
                  formatMoneyInput(normalizedExisting.unitPrice) === formatMoneyInput(item.unitPrice) &&
                  normalizedExisting.isTaxable === item.isTaxable &&
                  normalizedExisting.sortOrder === item.sortOrder &&
                  (normalizedExisting.priceBookItemId ?? null) === (item.priceBookItemId ?? null)
                ) {
                  continue;
                }

                await api.patch(`/api/v1/estimates/${tier.estimateId}/items/${item.id}`, toEstimateLineItemPayload(item, index));
              }

              const localIds = new Set(normalizedItems.map((item) => item.id).filter((value): value is string => Boolean(value)));
              for (const existing of latestDetail.estimate.items) {
                if (!localIds.has(existing.id)) {
                  await api.delete(`/api/v1/estimates/${tier.estimateId}/items/${existing.id}`);
                }
              }

              nextTiers.push({
                ...tier,
                estimateNumber: latestDetail.estimate.estimateNumber,
                approvalToken: latestDetail.estimate.approvalToken,
                status: latestDetail.estimate.status,
                isSelectedTier: Boolean(latestDetail.estimate.isSelectedTier)
              });
            }

            const nextDraft = {
              ...draft,
              tiers: nextTiers
            };
            setDraft(nextDraft);

            const routeEstimateId =
              nextTiers.find((tier) => tier.key === "better" && tier.estimateId)?.estimateId
              ?? nextTiers[0]?.estimateId;
            if (!isExisting && routeEstimateId) {
              router.replace(`/estimates/${routeEstimateId}`);
            }
          }

          savedSignatureRef.current = draftSignature;
          setSaveState("saved");
          window.setTimeout(() => setSaveState("idle"), 1800);
          await queryClient.invalidateQueries({ queryKey: ["estimates"] });
        } catch (error) {
          setSaveState("error");
          setErrorMessage(error instanceof Error ? error.message : "Estimate draft could not be saved.");
        }
      })();
    }, delay);

    return () => window.clearTimeout(timeoutId);
  }, [
    draft,
    draftSignature,
    estimateId,
    groupQuery.data?.primary.tierGroupId,
    isEditable,
    isExisting,
    queryClient,
    router,
    saveNow,
    taxRate
  ]);

  async function refreshEstimateData() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["estimates"] }),
      queryClient.invalidateQueries({ queryKey: ["invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["jobs"] }),
      groupQuery.refetch()
    ]);
  }

  async function sendEstimateToCustomer(input: { channel: "email" | "sms" | "both"; message: string }) {
    setErrorMessage(null);

    const persistedTiers = draft.mode === "single"
      ? (draft.single.estimateId ? [draft.single] : [])
      : draft.tiers.filter((tier) => tier.estimateId);

    if (persistedTiers.length === 0) {
      setErrorMessage("Save the estimate draft before sending it to the customer.");
      return;
    }

    for (const tier of persistedTiers) {
      await api.post(`/api/v1/estimates/${tier.estimateId}/send`, {});
    }

    if ((input.channel === "sms" || input.channel === "both") && customerDetailQuery.data?.customer.phone && anchorPublicUrl) {
      const encodedMessage = encodeURIComponent(input.message.replace("{{link}}", anchorPublicUrl));
      window.open(`sms:${customerDetailQuery.data.customer.phone}?body=${encodedMessage}`, "_blank");
    }

    await refreshEstimateData();
    setSendModalOpen(false);
  }

  async function handlePublicApprove(input: { approvedByName: string; selectedEstimateNumber?: string }) {
    if (!anchorTier?.approvalToken) {
      return;
    }

    await publicApi.post(`/api/v1/public/estimates/${anchorTier.approvalToken}/approve`, input);
    await refreshEstimateData();
    setCustomerViewApproved(true);
  }

  async function handlePublicDecline(reason?: string) {
    if (!anchorTier?.approvalToken) {
      return;
    }

    await publicApi.post(`/api/v1/public/estimates/${anchorTier.approvalToken}/decline`, {
      ...(reason ? { reason } : {})
    });
    await refreshEstimateData();
    setCustomerViewOpen(false);
  }

  async function handleDispatcherApprove() {
    const target = getSelectedEstimateForAction(draft, activeTierKey);
    if (!target?.estimateId) {
      return;
    }

    await api.post(`/api/v1/estimates/${target.estimateId}/approve`, {});
    await refreshEstimateData();
  }

  async function handleDeclineEstimate() {
    const target = getSelectedEstimateForAction(draft, activeTierKey);
    if (!target?.estimateId) {
      return;
    }

    await api.post(`/api/v1/estimates/${target.estimateId}/decline`, {
      ...(declineForm.reason.trim() ? { reason: declineForm.reason.trim() } : {})
    });
    setDeclineOpen(false);
    setDeclineForm(emptyDeclineForm);
    await refreshEstimateData();
  }

  async function handleConvertToJob() {
    const target = getSelectedEstimateForAction(draft, activeTierKey);
    if (!target?.estimateId) {
      return;
    }

    const response = await api.post<{ job: { id: string; title: string } }>(
      `/api/v1/estimates/${target.estimateId}/convert-to-job`,
      {}
    );

    if (convertForm.title.trim()) {
      await api.patch(`/api/v1/jobs/${response.job.id}`, {
        title: convertForm.title.trim()
      });
    }

    if (convertForm.technicianId) {
      await api.post(`/api/v1/jobs/${response.job.id}/assign`, {
        technicianId: convertForm.technicianId
      });
    }

    if (convertForm.scheduledDate && convertForm.scheduledTime) {
      const scheduledStart = new Date(`${convertForm.scheduledDate}T${convertForm.scheduledTime}:00`);
      await api.post(`/api/v1/jobs/${response.job.id}/schedule`, {
        scheduledStart: scheduledStart.toISOString(),
        scheduledEnd: addHours(scheduledStart, 2).toISOString()
      });
    }

    setConvertOpen(false);
    router.push(`/jobs/${response.job.id}`);
  }

  async function handleCreateInvoice() {
    const target = getSelectedEstimateForAction(draft, activeTierKey);
    if (!target?.estimateId) {
      return;
    }

    const response = await createInvoice.mutateAsync({
      customerId: draft.customerId,
      ...(draft.jobId ? { jobId: draft.jobId } : {}),
      fromEstimateId: target.estimateId
    });

    router.push(`/invoices/${response.invoice.id}`);
  }

  const loading = isExisting && groupQuery.isLoading;
  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[140px]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
          <SkeletonCard className="h-[900px]" />
          <SkeletonCard className="h-[720px]" />
        </div>
      </div>
    );
  }

  if (isExisting && groupQuery.isError) {
    return (
      <ErrorState
        title="Estimate couldn't load"
        onRetry={() => void groupQuery.refetch()}
        isRetrying={groupQuery.isFetching}
      />
    );
  }

  if (isExisting && !groupQuery.data) {
    return (
      <EmptyState
        icon={WandSparkles}
        title="Estimate not found"
        subtitle="This estimate may have been deleted or you may not have access to it in the current company."
        action={(
          <Link href="/estimates" className="rounded-full bg-brand-accent px-4 py-2 text-sm font-semibold text-white">
            Back to estimates
          </Link>
        )}
      />
    );
  }

  return (
    <>
      <PageLayout
        title={isExisting ? "Estimate" : "New estimate"}
        subtitle={
          (isExisting
            ? buildEstimateSubtitle({
                estimateNumber: primaryEstimate?.estimateNumber ?? null,
                customerName: primaryEstimate ? `${primaryEstimate.customer.firstName} ${primaryEstimate.customer.lastName}` : null,
                address: primaryEstimate?.property?.addressLine1 ?? null
              })
            : null) ?? "Build a single quote or a Good / Better / Best option set."
        }
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/estimates" className="text-sm font-semibold text-brand-accent">
              ← All Estimates
            </Link>
            {isExisting ? (
              <StatBadge label={formatStatusLabel(currentStatus)} tone={getEstimateStatusTone(currentStatus)} />
            ) : null}
            {isEditable ? (
              <>
                <button
                  type="button"
                  disabled={!draft.customerId || saveState === "saving" || draftSignature === savedSignatureRef.current}
                  onClick={() => {
                    saveNowRef.current = true;
                    setSaveNow((n) => n + 1);
                  }}
                  className="rounded-[10px] border border-[#e6dccb] bg-white px-4 py-2 text-sm font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveState === "saving" ? "Saving…" : "Save draft"}
                </button>
                <button
                  type="button"
                  disabled={!canSendEstimate({ hasEstimateId: Boolean(anchorTier?.estimateId), isDirty, saveState })}
                  onClick={() => setSendModalOpen(true)}
                  className="rounded-[10px] bg-[#f6b400] px-4 py-2 text-sm font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Approve &amp; send
                </button>
              </>
            ) : null}
          </div>
        )}
      >
        <div className="space-y-6">
          <section className="surface-card px-6 py-6">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] xl:grid-cols-[repeat(4,minmax(0,1fr))]">
              <div className="space-y-2 xl:col-span-1">
                <label className="text-sm font-semibold text-neutral-700">Customer</label>
                <select
                  value={draft.customerId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      customerId: event.target.value,
                      propertyId: "",
                      jobId: ""
                    }))
                  }
                  disabled={!isEditable}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-neutral-900 outline-none transition",
                    isEditable
                      ? "border-neutral-200 bg-neutral-50 focus:border-brand-accent"
                      : "border-neutral-100 bg-neutral-50/70 text-neutral-600"
                  )}
                >
                  <option value="">Select customer</option>
                  {(customersQuery.data?.data ?? []).map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.displayName ?? `${customer.firstName} ${customer.lastName}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Property</label>
                <select
                  value={draft.propertyId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      propertyId: event.target.value
                    }))
                  }
                  disabled={!isEditable || !draft.customerId}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-neutral-900 outline-none transition",
                    isEditable
                      ? "border-neutral-200 bg-neutral-50 focus:border-brand-accent"
                      : "border-neutral-100 bg-neutral-50/70 text-neutral-600"
                  )}
                >
                  <option value="">No property selected</option>
                  {(customerDetailQuery.data?.customer.properties ?? []).map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.addressLine1}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Related Job</label>
                <select
                  value={draft.jobId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      jobId: event.target.value
                    }))
                  }
                  disabled={!isEditable || !draft.customerId}
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-neutral-900 outline-none transition",
                    isEditable
                      ? "border-neutral-200 bg-neutral-50 focus:border-brand-accent"
                      : "border-neutral-100 bg-neutral-50/70 text-neutral-600"
                  )}
                >
                  <option value="">No related job</option>
                  {(customerJobsQuery.data?.data ?? []).map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.jobNumber} — {job.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-neutral-700">Estimate Title</label>
                <input
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value
                    }))
                  }
                  readOnly={!isEditable}
                  placeholder="Walk-in cooler repair"
                  className={cn(
                    "w-full rounded-2xl border px-4 py-3 text-neutral-900 outline-none transition",
                    isEditable
                      ? "border-neutral-200 bg-neutral-50 focus:border-brand-accent"
                      : "border-neutral-100 bg-neutral-50/70 text-neutral-600"
                  )}
                />
              </div>
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
            <div className="space-y-6">
              <section className="surface-card px-6 py-6">
                <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold tracking-tight text-neutral-900">Quote Mode</h2>
                    <p className="mt-1 text-sm text-neutral-500">Choose a single quote or build three customer-facing options.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {[
                      { value: "single" as const, label: "Single Quote" },
                      { value: "tiers" as const, label: "Good / Better / Best" }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        disabled={!isEditable || Boolean(anchorTier?.estimateId)}
                        onClick={() => {
                          setDraft((current) => ({
                            ...current,
                            mode: option.value
                          }));
                          setActiveTierKey(option.value === "tiers" ? "better" : "single");
                        }}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-semibold transition",
                          draft.mode === option.value
                            ? "bg-brand-accent text-white"
                            : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700",
                          (!isEditable || Boolean(anchorTier?.estimateId)) && "cursor-not-allowed opacity-50"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {draft.mode === "single" ? (
                  <div className="mt-5">
                    <EditableLineItemsTable
                      title="Line Items"
                      subtitle="Add products, labor, fees, or materials from the catalog and keep the estimate draft current."
                      items={draft.single.items}
                      readOnly={!isEditable}
                      variant="frame"
                      discountAmount={activeTotals.discountAmount}
                      onChange={(items) =>
                        setDraft((current) => ({
                          ...current,
                          single: {
                            ...current.single,
                            items
                          }
                        }))
                      }
                    />
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {draft.tiers.map((tier) => {
                      const tierTotals = computeRevenueTotals(tier.items, taxRate, parseMoneyValue(draft.discountAmount));
                      const expanded = activeTierKey === tier.key;

                      return (
                        <section key={tier.key} className="rounded-[28px] border border-neutral-200 bg-neutral-50/70">
                          <button
                            type="button"
                            onClick={() => setActiveTierKey(tier.key)}
                            className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-base font-semibold text-neutral-900">{tier.label}</p>
                                {tier.key === "better" ? <StatBadge label="Recommended" tone="purple" /> : null}
                                {tier.isSelectedTier ? <StatBadge label="Selected" tone="green" /> : null}
                              </div>
                              <p className="mt-1 text-sm text-neutral-500">
                                {tier.items.length} {tier.items.length === 1 ? "line item" : "line items"}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <CurrencyDisplay value={tierTotals.total} showCents className="text-lg font-semibold text-neutral-900" />
                              <ChevronDown className={cn("h-4 w-4 text-neutral-400 transition", expanded && "rotate-180")} />
                            </div>
                          </button>

                          {expanded ? (
                            <div className="border-t border-neutral-200 px-5 pb-5 pt-4">
                              <EditableLineItemsTable
                                title={`${tier.label} Items`}
                                subtitle={`Scope and pricing for the ${tier.label?.toLowerCase()} option.`}
                                items={tier.items}
                                readOnly={!isEditable}
                                variant="frame"
                                discountAmount={tierTotals.discountAmount}
                                onChange={(items) =>
                                  setDraft((current) => ({
                                    ...current,
                                    tiers: current.tiers.map((entry) =>
                                      entry.key === tier.key
                                        ? {
                                            ...entry,
                                            items
                                          }
                                        : entry
                                    )
                                  }))
                                }
                              />
                            </div>
                          ) : null}
                        </section>
                      );
                    })}
                  </div>
                )}
              </section>

              <EstimateTotalsCard
                label={draft.mode === "tiers" ? activeTier.label : null}
                subtotal={activeTotals.subtotal}
                taxAmount={activeTotals.taxAmount}
                taxRate={taxRate}
                discountAmount={activeTotals.discountAmount}
                total={activeTotals.total}
              />

              <EstimateFrequencyOptions />

              {errorMessage ? (
                <section className="rounded-[28px] border border-error/20 bg-error-light px-5 py-4 text-sm text-error">
                  {errorMessage}
                </section>
              ) : null}
            </div>

            <aside className="space-y-6">
              <EstimateChecksPanel
                status={currentStatus}
                discountAmount={activeTotals.discountAmount}
                expiresAt={primaryEstimate?.expiresAt ?? null}
              />
              <section className="surface-card px-5 py-5">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-neutral-700">Notes to customer</label>
                  <textarea
                    value={draft.messageToCustomer}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        messageToCustomer: event.target.value
                      }))
                    }
                    readOnly={!isEditable}
                    rows={5}
                    placeholder="Outline the scope, assumptions, and next steps for the customer."
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-neutral-700 outline-none transition",
                      isEditable
                        ? "border-neutral-200 bg-neutral-50 focus:border-brand-accent"
                        : "border-neutral-100 bg-neutral-50/70 text-neutral-600"
                    )}
                  />
                </div>

                <label className="mt-4 inline-flex items-center gap-3 text-sm font-medium text-neutral-600">
                  <input
                    type="checkbox"
                    checked={draft.financingOffered}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        financingOffered: event.target.checked
                      }))
                    }
                    disabled={!isEditable}
                    className="h-4 w-4 rounded border-neutral-300 text-brand-accent focus:ring-brand-accent"
                  />
                  Offer financing on this estimate
                </label>

                <div className="mt-5 border-t border-neutral-200 pt-4 text-sm">
                  {draft.mode === "tiers" ? (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      {draft.tiers.map((tier) => (
                        <button
                          key={tier.key}
                          type="button"
                          onClick={() => setActiveTierKey(tier.key)}
                          className={cn(
                            "rounded-full px-3 py-1.5 text-xs font-semibold transition",
                            activeTierKey === tier.key
                              ? "bg-brand-accent text-white"
                              : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-700"
                          )}
                        >
                          {tier.label}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 text-neutral-500">
                    <span>Discount</span>
                    {isEditable ? (
                      <input
                        value={draft.discountAmount}
                        onChange={(event) =>
                          setDraft((current) => ({
                            ...current,
                            discountAmount: event.target.value
                          }))
                        }
                        className="w-24 rounded-xl border border-neutral-200 bg-white px-2 py-1 text-right text-sm text-neutral-900 outline-none transition focus:border-brand-accent"
                      />
                    ) : (
                      <CurrencyDisplay value={draft.discountAmount} showCents />
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {isEditable ? (
                    <>
                      <button
                        type="button"
                        disabled={!canSendEstimate({ hasEstimateId: Boolean(anchorTier?.estimateId), isDirty, saveState })}
                        onClick={() => setSendModalOpen(true)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Send className="h-4 w-4" />
                        Send to Customer
                      </button>
                      <button
                        type="button"
                        disabled={!anchorTier?.estimateId}
                        onClick={() => {
                          setCustomerViewApproved(false);
                          setCustomerViewOpen(true);
                        }}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <MonitorSmartphone className="h-4 w-4" />
                        Show on Screen
                      </button>
                    </>
                  ) : currentStatus === "sent" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSendModalOpen(true)}
                        className="w-full rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary"
                      >
                        Re-send
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDispatcherApprove().catch((error) => {
                            setErrorMessage(error instanceof Error ? error.message : "Estimate could not be approved.");
                          });
                        }}
                        className="w-full rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Mark Approved
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeclineOpen(true)}
                        className="w-full rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-600 transition hover:border-error/30 hover:text-error"
                      >
                        Decline
                      </button>
                    </>
                  ) : currentStatus === "approved" || currentStatus === "converted" ? (
                    <>
                      {currentStatus !== "converted" ? (
                        <button
                          type="button"
                          onClick={() => setConvertOpen(true)}
                          className="w-full rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary"
                        >
                          Convert to Job
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          void handleCreateInvoice().catch((error) => {
                            setErrorMessage(error instanceof Error ? error.message : "Invoice could not be created.");
                          });
                        }}
                        className="w-full rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Create Invoice
                      </button>
                    </>
                  ) : currentStatus === "declined" ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setSendModalOpen(true)}
                        className="w-full rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary"
                      >
                        Re-send
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOverride(true)}
                        className="w-full rounded-full border border-neutral-200 px-5 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-100"
                      >
                        Edit
                      </button>
                    </>
                  ) : null}
                </div>

                <p className={cn("mt-3 text-xs", saveState === "saved" ? "text-success" : "text-neutral-400")}>
                  {saveState === "saving"
                    ? "Draft auto-saving..."
                    : saveState === "saved"
                      ? "Draft saved."
                      : "Draft changes auto-save every 2 seconds."}
                </p>
              </section>

              {anchorTier ? (
                <section className="surface-card px-5 py-5">
                  <h3 className="text-sm font-semibold text-neutral-900">Customer Preview</h3>
                  <div className="mt-4 rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Approval Link</p>
                    <p className="mt-2 break-all text-sm text-brand-accent">
                      {anchorPublicUrl ?? "Approval link will be available after the draft is saved."}
                    </p>
                  </div>
                  {draft.mode === "tiers" ? (
                    <div className="mt-4 space-y-3">
                      {draft.tiers.map((tier) => (
                        <div key={tier.key} className="flex items-center justify-between rounded-[20px] border border-neutral-200 bg-neutral-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-neutral-900">{tier.label}</p>
                            <p className="text-xs text-neutral-500">{tier.items.length} items</p>
                          </div>
                          <CurrencyDisplay
                            value={computeRevenueTotals(tier.items, taxRate, parseMoneyValue(draft.discountAmount)).total}
                            showCents
                            className="font-semibold text-neutral-900"
                          />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </aside>
          </div>
        </div>
      </PageLayout>

      <EstimateSendModal
        open={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        customerName={
          customerDetailQuery.data
            ? `${customerDetailQuery.data.customer.firstName} ${customerDetailQuery.data.customer.lastName}`
            : "Customer"
        }
        customerEmail={customerDetailQuery.data?.customer.email ?? null}
        customerPhone={customerDetailQuery.data?.customer.phone ?? null}
        estimateNumber={anchorTier?.estimateNumber ?? "DRAFT"}
        publicUrl={anchorPublicUrl}
        defaultMessage={`Hi ${customerDetailQuery.data?.customer.firstName ?? ""}, here is your Renvani estimate. Review and approve here: {{link}}`}
        isPending={false}
        onSend={sendEstimateToCustomer}
      />

      {customerViewOpen ? (
        <div className="fixed inset-0 z-50 bg-white">
          <CustomerEstimateView
            estimate={preview}
            approvedState={customerViewApproved}
            isSubmitting={false}
            onBack={() => setCustomerViewOpen(false)}
            backLabel="Back to office view"
            onApprove={handlePublicApprove}
            onDecline={handlePublicDecline}
          />
        </div>
      ) : null}

      <Sheet
        open={convertOpen}
        onClose={() => setConvertOpen(false)}
        title="Convert to Job"
        description="Create the job record now, then optionally assign a technician and schedule the first visit."
      >
        <div className="space-y-5 px-6 py-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Job Title</label>
            <input
              value={convertForm.title}
              onChange={(event) => setConvertForm((current) => ({ ...current, title: event.target.value }))}
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">Technician</label>
              <select
                value={convertForm.technicianId}
                onChange={(event) =>
                  setConvertForm((current) => ({
                    ...current,
                    technicianId: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
              >
                <option value="">Assign later</option>
                {(dispatchViewQuery.data?.technicians ?? []).map((technician) => (
                  <option key={technician.id} value={technician.id}>
                    {technician.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-neutral-700">Schedule Date</label>
              <input
                type="date"
                value={convertForm.scheduledDate}
                onChange={(event) =>
                  setConvertForm((current) => ({
                    ...current,
                    scheduledDate: event.target.value
                  }))
                }
                className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Start Time</label>
            <input
              type="time"
              value={convertForm.scheduledTime}
              onChange={(event) =>
                setConvertForm((current) => ({
                  ...current,
                  scheduledTime: event.target.value
                }))
              }
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-900 outline-none transition focus:border-brand-accent"
            />
          </div>

          <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
            The estimate will become a job and the current option will carry forward. If a technician and time are provided, the job will also be scheduled immediately.
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-5">
            <button
              type="button"
              onClick={() => setConvertOpen(false)}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleConvertToJob().catch((error) => {
                  setErrorMessage(error instanceof Error ? error.message : "Job could not be created.");
                });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand-primary"
            >
              Create Job
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Sheet>

      <Sheet
        open={declineOpen}
        onClose={() => {
          setDeclineOpen(false);
          setDeclineForm(emptyDeclineForm);
        }}
        title="Decline Estimate"
        description="Capture an internal reason and move the estimate into a declined state."
      >
        <div className="space-y-5 px-6 py-6">
          <div className="rounded-[24px] border border-warning/20 bg-warning-light px-4 py-4 text-sm text-neutral-700">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <p>The customer will no longer see this estimate as accepted until it is revised and re-sent.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-neutral-700">Reason</label>
            <textarea
              value={declineForm.reason}
              onChange={(event) => setDeclineForm({ reason: event.target.value })}
              rows={4}
              placeholder="Optional internal note about why this was declined."
              className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-neutral-700 outline-none transition focus:border-brand-accent"
            />
          </div>

          <div className="flex justify-end gap-3 border-t border-neutral-200 pt-5">
            <button
              type="button"
              onClick={() => {
                setDeclineOpen(false);
                setDeclineForm(emptyDeclineForm);
              }}
              className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                void handleDeclineEstimate().catch((error) => {
                  setErrorMessage(error instanceof Error ? error.message : "Estimate could not be declined.");
                });
              }}
              className="rounded-full bg-error px-5 py-2 text-sm font-semibold text-white transition hover:brightness-95"
            >
              Decline Estimate
            </button>
          </div>
        </div>
      </Sheet>
    </>
  );
}
