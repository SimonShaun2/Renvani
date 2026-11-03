import type { CommandCenterKpi, CommandCenterSource } from "@fsm/types";

import { EMPTY } from "./command-center.config";
import { formatUsdFromDecimal } from "./direct-demand.utils";

/** Roles the API allows on /command-center/brief (dispatcher/technician get 403). */
const BRIEF_ROLES = new Set(["owner", "admin"]);
export const canViewBrief = (role: string | null | undefined) => Boolean(role && BRIEF_ROLES.has(role));

/** "1234.567" -> 123457n cents, string math only, half up. Invalid -> null. */
export function decimalToCents(value: string): bigint | null {
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(value.trim());
  if (!match || (!match[2] && !match[3])) return null;
  const frac = (match[3] ?? "").padEnd(3, "0");
  let cents = BigInt(match[2] || "0") * 100n + BigInt(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1n;
  return match[1] ? -cents : cents;
}

export function formatCents(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const text = `${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
  return `${negative ? "-" : ""}${formatUsdFromDecimal(text)}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function formatKpiValue(kpi: Pick<CommandCenterKpi, "unit" | "value">): string {
  const { unit, value } = kpi;
  if (value === null || value === undefined) return EMPTY;
  if (unit === "money") return typeof value === "string" ? formatUsdFromDecimal(value) : EMPTY;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return EMPTY;
  return unit === "percent" ? `${round2(n)}%` : n.toLocaleString("en-US");
}

/** "September" from the comparison start date (YYYY-MM-DD), zone-free. */
export function monthName(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? "last month" : d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
}

const signed = (text: string, negative: boolean, zero: boolean) => (zero ? `±${text}` : negative ? `−${text}` : `+${text}`);

/** Delta = value − previousValue, e.g. "+5 vs September", "−3.5 pts vs September", "+$120.00 vs September". */
export function kpiDelta(kpi: Pick<CommandCenterKpi, "unit" | "value" | "previousValue">, previousMonth: string): string | null {
  const { unit, value, previousValue } = kpi;
  if (value === null || previousValue === null) return null;
  const vs = ` vs ${previousMonth}`;
  if (unit === "money") {
    const a = decimalToCents(String(value));
    const b = decimalToCents(String(previousValue));
    if (a === null || b === null) return null;
    const d = a - b;
    return signed(formatCents(d < 0n ? -d : d), d < 0n, d === 0n) + vs;
  }
  const d = round2(Number(value) - Number(previousValue));
  if (!Number.isFinite(d)) return null;
  const abs = Math.abs(d).toLocaleString("en-US");
  return signed(unit === "percent" ? `${abs} pts` : abs, d < 0, d === 0) + vs;
}

export function ratioLabel(kpi: Pick<CommandCenterKpi, "unit" | "numerator" | "denominator">): string | null {
  if (kpi.unit !== "percent" || kpi.numerator === null || kpi.denominator === null || kpi.denominator === 0) return null;
  return `${kpi.numerator} of ${kpi.denominator}`;
}

export const CREW_STATUS: Record<string, { label: string; className: string }> = {
  on_route: { label: "On route", className: "bg-[#e3f1e8] text-[#2f7d4f]" },
  exception: { label: "Exception", className: "bg-[#fbe3dc] text-[#b42318]" },
  off: { label: "Off", className: "bg-[#f3eadc] text-[#5e6684]" },
  scheduled: { label: "Scheduled", className: "bg-[#f3eadc] text-[#2a3360]" }
};

/** Only app-relative routes are linked (sources come from the API; never an external URL). */
export const safeRoute = (source: Pick<CommandCenterSource, "route">) => (source.route.startsWith("/") && !source.route.startsWith("//") ? source.route : null);

export function formatTimeIn(iso: string | null, timeZone?: string): string {
  if (!iso) return EMPTY;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return EMPTY;
  try {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone });
  } catch {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
}
