"use client";

import { useState } from "react";

import { annualPrice, formatUsd, type MarketingContent } from "@/src/content/marketing-content";

export type BillingPeriod = "monthly" | "annual";

export function PricingSection({
  plans,
  pricing,
  defaultPeriod = "annual"
}: Pick<MarketingContent, "plans" | "pricing"> & { defaultPeriod?: BillingPeriod }) {
  const [period, setPeriod] = useState<BillingPeriod>(defaultPeriod);
  return (
    <section id="pricing" className="py-16 md:py-24" aria-labelledby="pricing-heading">
      <div className="mx-auto max-w-6xl px-4">
        <h2 id="pricing-heading" className="text-3xl font-semibold md:text-4xl" style={{ color: "var(--color-mkt-ink)" }}>
          {pricing.heading}
        </h2>
        <div role="radiogroup" aria-label="Billing period" className="mt-6 inline-flex rounded-full border p-1" style={{ borderColor: "var(--color-mkt-line)" }}>
          {(["monthly", "annual"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={period === p}
              onClick={() => setPeriod(p)}
              className="min-h-[44px] rounded-full px-5 text-[15px] font-medium transition-colors motion-reduce:transition-none"
              style={{
                background: period === p ? "var(--color-mkt-amber)" : "transparent",
                color: "var(--color-mkt-ink)"
              }}
            >
              {p === "monthly" ? "Monthly" : "Annual"}
            </button>
          ))}
        </div>
        {period === "annual" ? (
          <p className="mt-3 text-sm" style={{ color: "var(--color-mkt-muted)" }}>
            {pricing.annualNote}
          </p>
        ) : null}
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <article
              key={plan.id}
              data-plan={plan.id}
              className="rounded-2xl border bg-white p-6 transition-transform duration-150 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              style={{ borderColor: "var(--color-mkt-line)" }}
            >
              <h3 className="text-lg font-semibold" style={{ color: "var(--color-mkt-ink)" }}>
                {plan.name}
              </h3>
              <p data-testid={`price-${plan.id}`} className="mt-3 text-3xl font-semibold" style={{ color: "var(--color-mkt-ink)" }}>
                {period === "annual" ? `${formatUsd(annualPrice(plan.monthlyPrice))}/yr` : `${formatUsd(plan.monthlyPrice)}/mo`}
              </p>
              <p className="mt-3 text-sm" style={{ color: "var(--color-mkt-muted)" }}>
                {plan.blurb}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
