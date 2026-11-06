import { Decimal } from "decimal.js";

/** Pure contract arithmetic only; no operational posting, payroll-policy decision, database or provider effect. */
const MONEY = /^-?(?:0|[1-9]\d{0,15})\.\d{2}$/u;
const QUANTITY = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,6})?$/u;
function money(value: string): Decimal {
  if (!MONEY.test(value) || value === "-0.00") throw new Error("Canonical decimal money required");
  return new Decimal(value);
}
function quantity(value: string): Decimal { if (!QUANTITY.test(value)) throw new Error("Nonnegative exact quantity required"); return new Decimal(value); }
const format = (value: Decimal): string => { const result = value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2); return result === "-0.00" ? "0.00" : result; };

export function directJobMargin(input: { currency: string; sales: string; labor: string | null; burden: string | null;
  materials: string | null; equipment: string | null; openCommitment: string }): {
    currency: string; completeness: "complete" | "partial"; knownCostSubtotal: string; actualCost: string | null;
    margin: string | null; marginPercent: string | null; openCommitment: string;
  } {
  if (!/^[A-Z]{3}$/u.test(input.currency)) throw new Error("Currency required");
  const sales = money(input.sales); money(input.openCommitment);
  const components = [input.labor, input.burden, input.materials, input.equipment];
  const known = components.reduce<Decimal>((sum, value) => value === null ? sum : sum.plus(money(value)), new Decimal(0));
  const complete = components.every((value) => value !== null);
  return { currency: input.currency, completeness: complete ? "complete" : "partial", knownCostSubtotal: format(known),
    actualCost: complete ? format(known) : null, margin: complete ? format(sales.minus(known)) : null,
    marginPercent: complete && !sales.isZero() ? format(sales.minus(known).div(sales).mul(100)) : null, openCommitment: input.openCommitment };
}

/** Ratios aggregate numerator/denominator; do not average individual percentages. */
export function weightedPercent(rows: readonly { numerator: string; denominator: string }[]): string | null {
  let numerator = new Decimal(0); let denominator = new Decimal(0);
  for (const row of rows) { const n = quantity(row.numerator); const d = quantity(row.denominator); if (n.gt(d)) throw new Error("Invalid bounded ratio"); numerator = numerator.plus(n); denominator = denominator.plus(d); }
  return denominator.isZero() ? null : format(numerator.div(denominator).mul(100));
}

/** Stable largest-remainder allocation in cents; the resulting allocations must sum exactly to their one source amount. */
export function allocateMoney(total: string, weights: readonly { id: string; weight: string }[]): { id: string; amount: string }[] {
  const amount = money(total);
  if (weights.length === 0 || new Set(weights.map((w) => w.id)).size !== weights.length || weights.some((w) => !/^[A-Za-z0-9._:-]{1,128}$/u.test(w.id))) throw new Error("Unique allocation identities required");
  const values = weights.map((w) => ({ id: w.id, weight: quantity(w.weight) }));
  const denominator = values.reduce((sum, w) => sum.plus(w.weight), new Decimal(0));
  if (denominator.isZero()) throw new Error("Positive allocation weight required");
  const cents = amount.abs().mul(100);
  const parts = values.map((w) => { const exact = cents.mul(w.weight).div(denominator); return { id: w.id, cents: exact.floor(), remainder: exact.minus(exact.floor()) }; });
  let remainder = cents.minus(parts.reduce((sum, p) => sum.plus(p.cents), new Decimal(0)));
  const ordered = [...parts].sort((a, b) => b.remainder.comparedTo(a.remainder) || a.id.localeCompare(b.id));
  for (const part of ordered) { if (remainder.lte(0)) break; part.cents = part.cents.plus(1); remainder = remainder.minus(1); }
  if (!remainder.isZero()) throw new Error("Allocation precision exceeded");
  return parts.map((part) => ({ id: part.id, amount: format(part.cents.div(100).mul(amount.isNegative() ? -1 : 1)) }));
}

export function availableStock(onHand: string, reserved: string, expectedInbound: string): { available: string; inboundExcluded: string } {
  const on = quantity(onHand); const hold = quantity(reserved); quantity(expectedInbound);
  if (hold.gt(on)) throw new Error("Reservation exceeds verified stock");
  return { available: on.minus(hold).toFixed(), inboundExcluded: expectedInbound };
}
export interface EconomicObservation { tenantId: string; canonicalId: string; revision: string; kind: "sale" | "collection" | "assistance"; currency: string; amount: string; }
/** Synthetic/read projection oracle, NOT an alternative live financial ledger. */
export function observedSales(rows: readonly EconomicObservation[], tenantId: string, currency: string): string {
  const seen = new Map<string, EconomicObservation>();
  for (const row of rows) {
    if (row.tenantId !== tenantId || row.currency !== currency) throw new Error("Incompatible economic scope");
    money(row.amount);
    const key = JSON.stringify([row.kind, row.canonicalId]); const old = seen.get(key);
    if (old && (old.revision !== row.revision || old.amount !== row.amount)) throw new Error("Economic revision requires reconciliation");
    seen.set(key, row);
  }
  return format([...seen.values()].filter((r) => r.kind === "sale").reduce((sum, r) => sum.plus(money(r.amount)), new Decimal(0)));
}
