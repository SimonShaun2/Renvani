"use client";

import { useState } from "react";

import { formatUsd } from "@/src/content/marketing-content";
import { type PricingData } from "@/src/content/page-sections";

export type BillingPeriod = "monthly" | "annual";

export function PricingSection({
  pricing,
  heading,
  subhead
}: {
  pricing: PricingData;
  heading?: string | undefined;
  subhead?: string | undefined;
}) {
  const [period, setPeriod] = useState<BillingPeriod>(pricing.defaultBilling);
  return (
    <section id="pricing" className="py-16 md:py-24" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="pricing-heading" className="text-3xl font-semibold md:text-4xl" style={{ color: "var(--color-mkt-ink)" }}>
          {heading ?? "Simple pricing. Everything included."}
        </h2>
        {subhead ? (
          <p className="mt-3 max-w-2xl" style={{ color: "var(--color-mkt-muted)" }}>
            {subhead}
          </p>
        ) : null}
        <div role="radiogroup" aria-label="Billing period" className="mt-6 inline-flex rounded-full border p-1" style={{ borderColor: "var(--color-mkt-line)" }}>
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className="min-h-[44px] rounded-full px-5 text-[15px] font-medium transition-colors motion-reduce:transition-none"
              style={{ background: period === p ? "var(--color-mkt-amber)" : "transparent", color: "var(--color-mkt-ink)" }}
            >
              {p === "monthly" ? "Monthly" : pricing.annualLabel}
            </button>
          ))}
        </div>
        {period === "annual" && pricing.saveBadge ? (
          <p className="mt-3 text-sm" style={{ color: "var(--color-mkt-muted)" }}>
            {pricing.saveBadge}
          </p>
        ) : null}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {pricing.plans.map((plan) => (
            <article
              key={plan.id}
              data-plan={plan.id}
              className="rounded-2xl border bg-white p-6 transition-transform duration-150 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              style={{ borderColor: "var(--color-mkt-line)" }}
            >
              {plan.badge ? (
                <span className="rounded-full px-2 py-[3px] text-[11px] font-semibold" style={{ background: "var(--color-mkt-amber-soft)", color: "var(--color-mkt-ink)" }}>
                  {plan.badge}
                </span>
              ) : null}
              <h3 className="mt-2 text-lg font-semibold" style={{ color: "var(--color-mkt-ink)" }}>
                {plan.name}
              </h3>
              <p data-testid={`price-${plan.id}`} className="mt-3 text-3xl font-semibold" style={{ color: "var(--color-mkt-ink)" }}>
                {period === "annual" ? `${formatUsd(plan.annual)}/yr` : `${formatUsd(plan.monthly)}/mo`}
              </p>
              {plan.fee ? (
                <p className="mt-3 text-sm" style={{ color: "var(--color-mkt-muted)" }}>
                  {plan.fee}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
