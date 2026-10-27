"use client";

import type {
  EstimateItemType,
  EstimateStatus,
  InvoiceItemType,
  InvoiceStatus,
  Product
} from "@fsm/types";

import type {
  EstimateDetailRecord,
  EstimateItemRecord,
  EstimateListRecord
} from "@/src/hooks/estimates.hooks";
import type { InvoiceItemRecord } from "@/src/hooks/invoices.hooks";
import { ESTIMATE_PUBLIC_APPROVAL_PATH_PREFIX } from "@/src/lib/estimate-public-route.compat";

export type RevenueLineItemType = EstimateItemType | InvoiceItemType;

export interface RevenueLineItemDraft {
  id?: string;
  localId: string;
  name: string;
  description: string;
  itemType: RevenueLineItemType;
  quantity: string;
  unitPrice: string;
  isTaxable: boolean;
  sortOrder: number;
}

export interface RevenueTotals {
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
}

export interface GroupedEstimateListRow {
  id: string;
  estimateId: string;
  estimateIds: string[];
  estimateNumber: string;
  title: string | null;
  status: EstimateStatus;
  total: string;
  subtotal: string;
  customer: EstimateListRecord["customer"];
  sentAt: string | null;
  expiresAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
  tierCount: number;
  tierLabel: string | null;
  tierGroupId: string | null;
}

export function parseMoneyValue(value: string | number | null | undefined): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMoneyInput(value: string | number | null | undefined): string {
  return parseMoneyValue(value).toFixed(2);
}

export function formatQuantityInput(value: string | number | null | undefined): string {
  const parsed = parseMoneyValue(value);
  return parsed > 0 ? parsed.toFixed(3).replace(/\.?0+$/, "") : "1";
}

export function getTierSortRank(label: string | null): number {
  switch ((label ?? "").trim().toLowerCase()) {
    case "good":
      return 0;
    case "better":
      return 1;
    case "best":
      return 2;
    default:
      return 99;
  }
}

export function computeRevenueTotals(
  items: RevenueLineItemDraft[],
  taxRate: number,
  discountAmount: number
): RevenueTotals {
  const subtotal = roundCurrency(
    items.reduce((sum, item) => sum + parseMoneyValue(item.quantity) * parseMoneyValue(item.unitPrice), 0)
  );
  const taxableSubtotal = roundCurrency(
    items.reduce((sum, item) => {
      if (!item.isTaxable) {
        return sum;
      }

      return sum + parseMoneyValue(item.quantity) * parseMoneyValue(item.unitPrice);
    }, 0)
  );
  const safeDiscount = roundCurrency(Math.max(0, discountAmount));
  const taxAmount = roundCurrency(Math.max(0, taxableSubtotal - safeDiscount) * taxRate);
  const total = roundCurrency(Math.max(0, subtotal - safeDiscount) + taxAmount);

  return {
    subtotal,
    taxAmount,
    discountAmount: safeDiscount,
    total
  };
}

export function createLineItemDraft(partial?: Partial<RevenueLineItemDraft>): RevenueLineItemDraft {
  return {
    localId: partial?.localId ?? crypto.randomUUID(),
    ...(partial?.id ? { id: partial.id } : {}),
    name: partial?.name ?? "",
    description: partial?.description ?? "",
    itemType: partial?.itemType ?? "service",
    quantity: partial?.quantity ?? "1",
    unitPrice: partial?.unitPrice ?? "0.00",
    isTaxable: partial?.isTaxable ?? true,
    sortOrder: partial?.sortOrder ?? 0
  };
}

export function lineItemFromProduct(product: Product, sortOrder: number): RevenueLineItemDraft {
  return createLineItemDraft({
    name: product.name,
    description: product.description ?? "",
    itemType: product.category === "labor" || product.category === "material" || product.category === "fee" ? product.category : "service",
    quantity: "1",
    unitPrice: formatMoneyInput(product.unitPrice),
    isTaxable: product.isTaxable ?? true,
    sortOrder
  });
}

export function lineItemFromEstimateItem(item: EstimateItemRecord): RevenueLineItemDraft {
  return createLineItemDraft({
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    itemType: item.itemType,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    isTaxable: item.isTaxable ?? true,
    sortOrder: item.sortOrder ?? 0
  });
}

export function lineItemFromInvoiceItem(item: InvoiceItemRecord): RevenueLineItemDraft {
  return createLineItemDraft({
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    itemType: item.itemType,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    isTaxable: item.isTaxable ?? true,
    sortOrder: item.sortOrder ?? 0
  });
}

export function normalizeLineItems(items: RevenueLineItemDraft[]): RevenueLineItemDraft[] {
  return items.map((item, index) => ({
    ...item,
    sortOrder: index,
    quantity: formatQuantityInput(item.quantity),
    unitPrice: formatMoneyInput(item.unitPrice)
  }));
}

export function getEstimateStatusTone(status: EstimateStatus): "blue" | "orange" | "purple" | "green" | "red" | "gray" {
  switch (status) {
    case "draft":
      return "gray";
    case "sent":
    case "viewed":
      return "blue";
    case "approved":
    case "converted":
      return "green";
    case "declined":
      return "red";
    case "expired":
      return "orange";
    case "revised":
      return "purple";
    default:
      return "gray";
  }
}

export function getInvoiceStatusTone(status: InvoiceStatus): "blue" | "orange" | "purple" | "green" | "red" | "gray" {
  switch (status) {
    case "draft":
      return "gray";
    case "sent":
    case "viewed":
      return "blue";
    case "partially_paid":
      return "orange";
    case "paid":
      return "green";
    case "overdue":
    case "void":
      return "red";
    case "written_off":
      return "purple";
    default:
      return "gray";
  }
}

export function formatStatusLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getEstimateGroupStatus(records: EstimateListRecord[]): EstimateStatus {
  if (records.some((record) => record.status === "approved" || record.status === "converted")) {
    return records.some((record) => record.status === "converted") ? "converted" : "approved";
  }

  if (records.some((record) => record.status === "viewed")) {
    return "viewed";
  }

  if (records.some((record) => record.status === "sent")) {
    return "sent";
  }

  if (records.some((record) => record.status === "declined")) {
    return "declined";
  }

  if (records.some((record) => record.status === "expired")) {
    return "expired";
  }

  if (records.some((record) => record.status === "revised")) {
    return "revised";
  }

  return "draft";
}

function pickPrimaryEstimateRecord(records: EstimateListRecord[]): EstimateListRecord {
  const sorted = records.slice().sort((left, right) => {
    const tierComparison = getTierSortRank(left.tierLabel) - getTierSortRank(right.tierLabel);
    if (tierComparison !== 0) {
      return tierComparison;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });

  return sorted.find((record) => record.status === "approved" || record.status === "converted")
    ?? sorted.find((record) => record.tierLabel?.toLowerCase() === "better")
    ?? sorted[0]!;
}

export function groupEstimateList(records: EstimateListRecord[]): GroupedEstimateListRow[] {
  const grouped = new Map<string, EstimateListRecord[]>();

  for (const record of records) {
    const key = record.tierGroupId ?? record.id;
    const current = grouped.get(key) ?? [];
    current.push(record);
    grouped.set(key, current);
  }

  return Array.from(grouped.entries()).map(([key, groupRecords]) => {
    const primary = pickPrimaryEstimateRecord(groupRecords);
    const totalRecord =
      groupRecords.find((record) => record.status === "approved" || record.status === "converted")
      ?? groupRecords.find((record) => record.tierLabel?.toLowerCase() === "better")
      ?? primary;

    return {
      id: key,
      estimateId: primary.id,
      estimateIds: groupRecords.map((record) => record.id),
      estimateNumber: totalRecord.estimateNumber,
      title: primary.title,
      status: getEstimateGroupStatus(groupRecords),
      total: totalRecord.total,
      subtotal: totalRecord.subtotal,
      customer: primary.customer,
      sentAt: primary.sentAt,
      expiresAt: primary.expiresAt,
      approvedAt: groupRecords.find((record) => record.approvedAt)?.approvedAt ?? primary.approvedAt,
      declinedAt: primary.declinedAt,
      createdAt: primary.createdAt,
      tierCount: groupRecords.length,
      tierLabel: totalRecord.tierLabel,
      tierGroupId: primary.tierGroupId
    };
  });
}

export function groupEstimateDetails(records: EstimateDetailRecord[]): EstimateDetailRecord[] {
  return records.slice().sort((left, right) => {
    const tierComparison = getTierSortRank(left.tierLabel) - getTierSortRank(right.tierLabel);
    if (tierComparison !== 0) {
      return tierComparison;
    }

    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  });
}

export function buildEstimatePublicPath(token: string | null | undefined): string | null {
  if (!token) {
    return null;
  }

  return `${ESTIMATE_PUBLIC_APPROVAL_PATH_PREFIX}/${token}`;
}

export function buildInvoicePublicPath(token: string | null | undefined): string | null {
  if (!token) {
    return null;
  }

  return `/pay/${token}`;
}

export type EstimateFilter = "all" | "draft" | "sent" | "approved" | "declined" | "expired" | "revised" | "converted";

export function matchesEstimateFilter(status: string, filter: EstimateFilter): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "sent") {
    return status === "sent" || status === "viewed";
  }

  return status === filter;
}
