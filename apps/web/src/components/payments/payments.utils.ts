export const PAYMENT_STATUSES = ["pending", "succeeded", "failed", "refunded", "disputed"] as const;
export const PAYMENT_METHODS = ["card", "ach", "cash", "check", "financing", "other"] as const;

export interface PaymentFilters {
  status: string;
  method: string;
  from: string;
  to: string;
  page: number;
}

function dayEdge(value: string, edge: "start" | "end"): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const [y = 0, m = 1, d = 1] = value.split("-").map(Number);
  const date = edge === "start" ? new Date(y, m - 1, d) : new Date(y, m - 1, d, 23, 59, 59, 999);
  return date.toISOString();
}

/** Query string for GET /api/v1/payments (ListPaymentsQuerySchema on dev). */
export function buildPaymentsQuery(filters: Partial<PaymentFilters>, limit = 25): string {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.method && filters.method !== "all") params.set("method", filters.method);
  const after = filters.from ? dayEdge(filters.from, "start") : undefined;
  const before = filters.to ? dayEdge(filters.to, "end") : undefined;
  if (after) params.set("createdAfter", after);
  if (before) params.set("createdBefore", before);
  params.set("sortBy", "createdAt");
  params.set("sortOrder", "desc");
  params.set("page", String(Math.max(1, filters.page ?? 1)));
  params.set("limit", String(limit));
  return params.toString();
}

export function formatMoney(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number.isNaN(amount) ? 0 : amount);
}

export function paymentStatusTone(status: string): "green" | "orange" | "red" | "gray" | "purple" {
  switch (status) {
    case "succeeded":
      return "green";
    case "pending":
      return "orange";
    case "failed":
    case "disputed":
      return "red";
    case "refunded":
      return "gray";
    default:
      return "purple";
  }
}

/** "Service Fee" wording; percent comes from the API (Stripe connect status), never hardcoded. */
export function serviceFeeLabel(platformFeePercent: number | null | undefined): string | null {
  if (platformFeePercent === null || platformFeePercent === undefined || platformFeePercent <= 0) {
    return null;
  }
  return `Service Fee (${platformFeePercent}%) · paid by customer at checkout`;
}

/** Frame 52:469 status chip copy: Stripe "pending" reads as "Processing". */
export function paymentStatusLabel(status: string): string {
  if (status === "pending") return "Processing";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

/** Status chip filters from frame 52:469, mapped to ListPaymentsQuerySchema statuses. */
export const STATUS_CHIPS: Array<{ value: string; label: string }> = [
  { value: "all", label: "All" },
  { value: "succeeded", label: "Succeeded" },
  { value: "pending", label: "Processing" },
  { value: "refunded", label: "Refunded" },
  { value: "disputed", label: "Disputed" },
  { value: "failed", label: "Failed" }
];

const CHIP_TONES: Record<string, string> = {
  succeeded: "bg-[#e5f4ea] text-[#1f6b3a]",
  pending: "bg-[#fff4d6] text-[#7a5600]",
  refunded: "bg-[#eef0f6] text-[#5e6684]",
  disputed: "bg-[#fde4df] text-[#a3261a]",
  failed: "bg-[#fde4df] text-[#a3261a]"
};

export function paymentChipClass(status: string): string {
  return CHIP_TONES[status] ?? "bg-[#eef0f6] text-[#5e6684]";
}

/** "Oct 22" like the frame's Date column. */
export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

/** Column header "Service Fee (2%)"; null hides the column (Flat plan or no fee from the API). */
export function serviceFeeColumnLabel(platformFeePercent: number | null | undefined): string | null {
  if (platformFeePercent === null || platformFeePercent === undefined || platformFeePercent <= 0) return null;
  return `Service Fee (${platformFeePercent}%)`;
}

export function planLabel(tier: "flex" | "flat" | null | undefined): string | null {
  if (tier === "flex") return "Flex plan";
  if (tier === "flat") return "Flat plan";
  return null;
}
