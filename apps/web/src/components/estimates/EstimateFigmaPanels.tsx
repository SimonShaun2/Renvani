"use client";

import type { EstimateStatus } from "@fsm/types";
import { cn } from "@/src/lib/utils";
import { NOT_AVAILABLE, estimateApprovalPill, formatDiscountCheck, formatValidUntil } from "./estimate-builder.utils";
import "./estimate-builder-motion.css";

const PILL_TONES = {
  amber: "bg-[#fff4d6] text-[#7a5600]",
  green: "bg-[#e5f4ea] text-[#1f6b3a]",
  red: "bg-[#fde4df] text-[#a3261a]",
  neutral: "bg-[#eef0f6] text-[#2a3360]"
} as const;

function CheckRow({ label, value, tone }: { label: string; value: string; tone?: "muted" | "default" }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[13px]">
      <dt className="text-[#5e6684]">{label}</dt>
      <dd className={tone === "muted" ? "text-[#5e6684]" : "font-medium text-[#0f1530]"}>{value}</dd>
    </div>
  );
}

/** Figma 10:733 "Checks before sending". Rows without an API show "—" with neutral wording. */
export function EstimateChecksPanel({
  status,
  discountAmount,
  expiresAt
}: {
  status: EstimateStatus;
  discountAmount: string | null | undefined;
  expiresAt: string | null | undefined;
}) {
  const pill = estimateApprovalPill(status);
  const missing = `— · ${NOT_AVAILABLE}`;
  return (
    <section
      data-estimate-reveal
      aria-label="Checks before sending"
      className="rounded-[14px] border border-[#e6dccb] bg-white px-5 py-5"
    >
      <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", PILL_TONES[pill.tone])}>
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
        {pill.label}
      </span>
      <h2 className="mt-3 text-[15px] font-semibold text-[#0f1530]">Checks before sending</h2>
      <dl className="mt-3 space-y-2.5">
        <CheckRow label="Service area" value={missing} tone="muted" />
        <CheckRow label="Price book" value={missing} tone="muted" />
        <CheckRow label="Discount" value={formatDiscountCheck(discountAmount)} />
        <CheckRow label="First-time recurring" value={missing} tone="muted" />
        <CheckRow label="Email consent" value={missing} tone="muted" />
        <CheckRow label="Valid until" value={formatValidUntil(expiresAt)} />
      </dl>
    </section>
  );
}

/** Figma 10:718 "Options shown to customer". No frequency/recurring-plan API, so options stay hidden. */
export function EstimateFrequencyOptions() {
  return (
    <section aria-label="Options shown to customer" className="rounded-[14px] border border-[#e6dccb] bg-white px-5 py-5">
      <h2 className="text-[15px] font-semibold text-[#0f1530]">Options shown to customer</h2>
      <p className="mt-2 text-sm text-[#5e6684]">Visit frequency options aren&apos;t available yet.</p>
    </section>
  );
}

function money(value: number): string {
  return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Figma 10:707 totals card. Only amounts computed exactly from the estimate's lines,
 * tax rate and discount; no per-visit / first-visit / monthly figures (no recurring API).
 */
export function EstimateTotalsCard({
  label,
  subtotal,
  taxAmount,
  taxRate,
  discountAmount,
  total
}: {
  label?: string | null;
  subtotal: number;
  taxAmount: number;
  taxRate: number;
  discountAmount: number;
  total: number;
}) {
  const rows: Array<{ label: string; value: string; strong?: boolean }> = [
    { label: "Subtotal", value: money(subtotal) },
    { label: `Tax (${(taxRate * 100).toFixed(2)}%)`, value: money(taxAmount) }
  ];
  if (discountAmount > 0) rows.push({ label: "Discount", value: `−${money(discountAmount)}` });
  rows.push({ label: label ? `Total · ${label}` : "Total", value: money(total), strong: true });
  return (
    <section aria-label="Estimate totals" className="space-y-2.5 rounded-[14px] border border-[#e6dccb] bg-white p-5 text-[13px]">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-3">
          <span className="text-[#5e6684]">{row.label}</span>
          <span className={row.strong ? "font-semibold text-[#0f1530]" : "font-medium text-[#0f1530]"}>{row.value}</span>
        </div>
      ))}
    </section>
  );
}
