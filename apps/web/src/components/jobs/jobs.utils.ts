"use client";

import { differenceInYears, format, formatDistanceToNowStrict, isSameDay } from "date-fns";
import type { JobAssetSummary, JobProduct, JobStatus, JobTask, TimeEntry } from "@fsm/types";

export interface ProductTotals {
  subtotal: number;
  taxableSubtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
}

export interface TimeSummary {
  travelMinutes: number;
  onSiteMinutes: number;
  breakMinutes: number;
  billableMinutes: number;
}

export function formatStatusLabel(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getStatusTone(status: JobStatus): "blue" | "orange" | "purple" | "green" | "red" | "gray" {
  switch (status) {
    case "lead":
    case "estimate_requested":
    case "estimate_sent":
      return "purple";
    case "scheduled":
    case "dispatched":
    case "in_progress":
      return "blue";
    case "estimate_approved":
    case "on_hold":
      return "orange";
    case "completed":
    case "invoiced":
    case "paid":
    case "closed":
      return "green";
    case "cancelled":
      return "red";
    default:
      return "gray";
  }
}

export function formatTaskMinutes(value: number | null): string {
  if (!value || value <= 0) {
    return "Est: —";
  }

  if (value < 60) {
    return `Est: ${value} min`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  if (minutes === 0) {
    return `Est: ${hours}h`;
  }

  return `Est: ${hours}h ${minutes}m`;
}

export function getTaskProgress(tasks: JobTask[]) {
  const total = tasks.length;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const pendingRequired = tasks.filter((task) => task.isRequired && task.status !== "completed");
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);

  return {
    total,
    completed,
    pendingRequired,
    percent
  };
}

export function parseMoney(value: string | number | null | undefined): number {
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

export function computeProductTotals(
  products: JobProduct[],
  taxRate: number,
  discountAmount = 0,
  quantityOverrides?: Record<string, number>
): ProductTotals {
  const subtotal = roundCurrency(
    products.reduce((sum, product) => {
      const quantity = quantityOverrides?.[product.id] ?? parseMoney(product.quantity);
      return sum + roundCurrency(quantity * parseMoney(product.unitPrice));
    }, 0)
  );
  const taxableSubtotal = roundCurrency(
    products.reduce((sum, product) => {
      if (!product.isTaxable) {
        return sum;
      }

      const quantity = quantityOverrides?.[product.id] ?? parseMoney(product.quantity);
      return sum + roundCurrency(quantity * parseMoney(product.unitPrice));
    }, 0)
  );
  const safeDiscount = roundCurrency(Math.max(0, discountAmount));
  const taxAmount = roundCurrency(Math.max(0, taxableSubtotal - safeDiscount) * taxRate);
  const total = roundCurrency(Math.max(0, subtotal - safeDiscount) + taxAmount);

  return {
    subtotal,
    taxableSubtotal,
    taxAmount,
    discountAmount: safeDiscount,
    total
  };
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  return format(new Date(value), "MMM d • h:mm a");
}

export function formatDateOnly(value: string | Date | null | undefined): string {
  if (!value) {
    return "—";
  }

  return format(new Date(value), "MMM d, yyyy");
}

export function formatElapsedSeconds(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) {
    return "0 min";
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) {
    return `${remainder} min`;
  }

  if (remainder === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${remainder}m`;
}

export function buildTimeSummary(entries: TimeEntry[], activeEntryExtraSeconds = 0): TimeSummary {
  const summary = entries.reduce<TimeSummary>(
    (accumulator, entry) => {
      const durationMinutes =
        entry.endedAt === null
          ? Math.max(0, Math.round((Date.now() - new Date(entry.startedAt).getTime()) / 60_000))
          : entry.durationMinutes ?? 0;

      switch (entry.entryType) {
        case "travel":
          accumulator.travelMinutes += durationMinutes;
          accumulator.billableMinutes += durationMinutes;
          break;
        case "on_site":
          accumulator.onSiteMinutes += durationMinutes;
          accumulator.billableMinutes += durationMinutes;
          break;
        case "break":
          accumulator.breakMinutes += durationMinutes;
          break;
        default:
          break;
      }

      return accumulator;
    },
    {
      travelMinutes: 0,
      onSiteMinutes: 0,
      breakMinutes: 0,
      billableMinutes: 0
    }
  );

  if (activeEntryExtraSeconds > 0 && entries.some((entry) => entry.endedAt === null)) {
    const activeEntry = entries.find((entry) => entry.endedAt === null);
    const liveMinutes = Math.round(activeEntryExtraSeconds / 60);

    if (activeEntry?.entryType === "travel") {
      summary.travelMinutes = Math.max(summary.travelMinutes, liveMinutes);
      summary.billableMinutes = summary.travelMinutes + summary.onSiteMinutes;
    }

    if (activeEntry?.entryType === "on_site") {
      summary.onSiteMinutes = Math.max(summary.onSiteMinutes, liveMinutes);
      summary.billableMinutes = summary.travelMinutes + summary.onSiteMinutes;
    }

    if (activeEntry?.entryType === "break") {
      summary.breakMinutes = Math.max(summary.breakMinutes, liveMinutes);
    }
  }

  return summary;
}

export function getAssetBadge(asset: JobAssetSummary | null): {
  label: string;
  tone: "green" | "orange" | "red" | "gray";
  installYear: string;
} {
  if (!asset?.installDate) {
    return {
      label: "Unknown",
      tone: "gray",
      installYear: "Install year unknown"
    };
  }

  const installDate = new Date(asset.installDate);
  const age = differenceInYears(new Date(), installDate);

  if (age >= 12) {
    return {
      label: "At Risk",
      tone: "red",
      installYear: `Installed ${installDate.getFullYear()}`
    };
  }

  if (age >= 8) {
    return {
      label: "Aging",
      tone: "orange",
      installYear: `Installed ${installDate.getFullYear()}`
    };
  }

  return {
    label: "Healthy",
    tone: "green",
    installYear: `Installed ${installDate.getFullYear()}`
  };
}

export function buildOnTheWayMessage(firstName: string, etaMinutes: number): string {
  return `Hi! ${firstName} from Renvani is on the way and should arrive in about ${etaMinutes} minutes.`;
}

export function wasSentToday(sentAt: string | null | undefined): boolean {
  if (!sentAt) {
    return false;
  }

  return isSameDay(new Date(sentAt), new Date());
}

export function sortNewestFirst<T extends { occurredAt?: string; createdAt?: string }>(items: T[]): T[] {
  return items
    .slice()
    .sort((left, right) => {
      const leftValue = new Date(left.occurredAt ?? left.createdAt ?? 0).getTime();
      const rightValue = new Date(right.occurredAt ?? right.createdAt ?? 0).getTime();

      return rightValue - leftValue;
    });
}

export function formatRelativeTime(value: string | Date): string {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function getCompanyTaxRate(settings: Record<string, unknown> | null | undefined): number {
  if (!settings) {
    return 0;
  }

  const candidateValues = [
    settings.taxRate,
    settings.defaultTaxRate,
    typeof settings.pricing === "object" && settings.pricing !== null
      ? (settings.pricing as Record<string, unknown>).taxRate
      : undefined,
    typeof settings.pricing === "object" && settings.pricing !== null
      ? (settings.pricing as Record<string, unknown>).defaultTaxRate
      : undefined,
    typeof settings.billing === "object" && settings.billing !== null
      ? (settings.billing as Record<string, unknown>).taxRate
      : undefined
  ];

  for (const candidate of candidateValues) {
    const parsed = parseMoney(candidate as string | number | null | undefined);
    if (parsed > 0) {
      return parsed;
    }
  }

  return 0;
}
