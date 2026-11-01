/** Roles the API allows on /reporting/direct-demand. */
const DIRECT_DEMAND_ROLES = new Set(["owner", "admin", "dispatcher"]);
export const canViewDirectDemand = (role: string | null | undefined) => Boolean(role && DIRECT_DEMAND_ROLES.has(role));

/** YYYY-MM-DD of `date` in `timeZone` (IANA), else the browser's local zone. */
export function isoDateIn(date: Date, timeZone?: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
  } catch {
    return isoDateIn(date);
  }
}

/** Calendar month to date (1st of the month through today) in the shop time zone, else the browser's. */
export function monthToDateRange(now: Date, timeZone?: string) {
  const endDate = isoDateIn(now, timeZone);
  return { startDate: `${endDate.slice(0, 8)}01`, endDate };
}

/** "1234.5" -> "$1,234.50" using string math only (no float drift). Rounds half up to cents. */
export function formatUsdFromDecimal(value: string | null | undefined): string {
  const raw = (value ?? "0").trim();
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(raw);
  if (!match) return "$0.00";
  const negative = match[1] === "-";
  let whole = (match[2] || "0").replace(/^0+(?=\d)/, "");
  const frac = (match[3] ?? "").padEnd(3, "0");
  let cents = Number(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1;
  if (cents === 100) {
    cents = 0;
    const digits = whole.split("").map(Number);
    let i = digits.length - 1;
    while (i >= 0) {
      if (digits[i]! < 9) { digits[i]! += 1; break; }
      digits[i] = 0;
      i -= 1;
    }
    whole = (i < 0 ? "1" : "") + digits.join("");
  }
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const isZero = /^0+$/.test(whole) && cents === 0;
  return `${negative && !isZero ? "-" : ""}$${grouped}.${String(cents).padStart(2, "0")}`;
}

export const jobsLabel = (n: number) => `${n} ${n === 1 ? "job" : "jobs"}`;
