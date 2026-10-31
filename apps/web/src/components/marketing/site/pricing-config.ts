/** Pricing plans (Figma 203:15719 / 203:15720). Single source for every figure on /pricing. */
export type Plan = {
  key: "flex" | "flat" | "founding" | "startup";
  name: string;
  monthly: number;
  /** Customer-paid Service Fee, percent of the service subtotal, charged only at checkout and non-refundable. 0 = none. */
  serviceFeePct: number;
  /** Discounted programs are Flex-based. */
  basedOn?: "flex";
  program?: boolean;
};

export const PLANS: Plan[] = [
  { key: "flex", name: "Flex", monthly: 399, serviceFeePct: 2 },
  { key: "flat", name: "Flat", monthly: 999, serviceFeePct: 0 },
  { key: "founding", name: "Founding", monthly: 199, serviceFeePct: 2, basedOn: "flex", program: true },
  { key: "startup", name: "Startup", monthly: 99, serviceFeePct: 2, basedOn: "flex", program: true }
];

/** Annual billing = 10 × monthly ("2 months free annually"). */
export const ANNUAL_MONTHS = 10;
/** Illustrative checkout subtotal used in the "See exactly what changes" example. */
export const EXAMPLE_SUBTOTAL = 274;

const plan = (k: Plan["key"]) => PLANS.find((p) => p.key === k)!;
const usd = (n: number, cents = false) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;

export function pricingTokens(): Record<string, string> {
  const flex = plan("flex");
  const flat = plan("flat");
  const fee = (p: Plan) => Math.round(EXAMPLE_SUBTOTAL * p.serviceFeePct) / 100;
  const flexTotal = EXAMPLE_SUBTOTAL + fee(flex);
  const flatTotal = EXAMPLE_SUBTOTAL + fee(flat);
  const programs = PLANS.filter((p) => p.program).sort((a, b) => a.monthly - b.monthly);
  return {
    "flex.name": flex.name,
    "flex.price": usd(flex.monthly),
    "flex.annual": `${usd(flex.monthly * ANNUAL_MONTHS)}/year, billed annually`,
    "flex.fee": `${flex.serviceFeePct}% customer-paid Service Fee`,
    "flat.name": flat.name,
    "flat.price": usd(flat.monthly),
    "flat.annual": `${usd(flat.monthly * ANNUAL_MONTHS)}/year, billed annually`,
    "flat.fee": "No customer-paid Service Fee",
    annualNote: `${12 - ANNUAL_MONTHS} months free annually`,
    features: "Every feature. Unlimited users.",
    annualFeeNote: "The Service Fee on Flex stays the same with annual billing.",
    "ex.subtotal": usd(EXAMPLE_SUBTOTAL, true),
    "ex.flexFeeLabel": `Service Fee · ${flex.serviceFeePct}%`,
    "ex.flexFee": usd(fee(flex), true),
    "ex.flexTotal": usd(flexTotal, true),
    "ex.flexPay": `Pay ${usd(flexTotal, true)}`,
    "ex.flatFee": usd(fee(flat), true),
    "ex.flatTotal": usd(flatTotal, true),
    "ex.flatPay": `Pay ${usd(flatTotal, true)}`,
    "programs.title": programs.map((p) => `${p.name} ${usd(p.monthly)}/mo`).join(" · "),
    "programs.note": "Ask about eligibility and availability."
  };
}
