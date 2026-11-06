import { ANNUAL_MONTHS, PLANS } from "./pricing-config";

/** Subscription-only comparison; does not change prices or calculate net business savings. */
export function subscriptionSavings(): Record<string, string> {
  const flex = PLANS.find(plan => plan.key === "flex")!;
  const flat = PLANS.find(plan => plan.key === "flat")!;
  const difference = flat.monthly - flex.monthly;
  const usd = (amount: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(amount);
  return { "savings.monthly": usd(difference), "savings.annual": usd(difference * ANNUAL_MONTHS) };
}
