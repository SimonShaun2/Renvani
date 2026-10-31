"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import { submitGrowthCheck } from "@/app/(marketing)/growth-check/actions";
import { HOME_SERVICE_TRADES, TRADE_LABELS, type IntakeResult } from "@/src/lib/marketing-intake";

import { ScaleToFrame } from "./ScaleToFrame";
import { Field, FormAlert, Honeypot, SelectInput, SubmitButton, TextInput, ink, ink2, line } from "./IntakeFields";

export const GROWTH_CHECK = {
  eyebrow: "RENVANI GROWTH CHECK",
  headline: "Start with your business.",
  submit: "Send my report",
  note: "We’ll email your report.",
  done: { title: "Your Growth Check is on its way.", body: "We’ll email your report and its next steps.", primary: { label: "Explore the product", href: "/product" }, secondary: { label: "Get a free demo", href: "/demo" } }
};

/**
 * Growth Check request. Figma page 11: entry 203:4569 / 203:4754 (Home), layout from "contact" 204:9212 / 204:9218,
 * confirmation from "done" 204:9213 / 204:9219.
 */
export function GrowthCheckPage({ website = "", action = submitGrowthCheck }: { website?: string; action?: (prev: IntakeResult | null, fd: FormData) => Promise<IntakeResult> }) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.status === "invalid" ? state.fields : {};
  return (
    <ScaleToFrame width={1440} from={1024}>
    <section data-node-id="204:9515" className="mx-auto flex max-w-[1440px] flex-col gap-8 p-6 md:p-8 lg:p-20" aria-labelledby="growth-check-title">
      <p className="text-[11px] font-medium leading-[1.38] tracking-[1.1px]" style={{ color: ink2 }}>
        {GROWTH_CHECK.eyebrow}
      </p>
      {state?.status === "success" ? (
        <div data-node-id="204:9555" role="status" className="flex w-full flex-col items-start gap-[14px] rounded-2xl border bg-white p-5 lg:w-[1000px]" style={{ borderColor: line }}>
          <svg aria-hidden="true" viewBox="0 0 42 42" className="size-[42px]" fill="none" stroke={ink} strokeWidth="2.5">
            <path d="M8 22l9 9 17-19" />
          </svg>
          <h1 id="growth-check-title" className="text-[34px] font-semibold leading-[1.08] tracking-[-0.85px] md:text-[46px] md:tracking-[-1.15px]" style={{ color: ink }}>
            {GROWTH_CHECK.done.title}
          </h1>
          <p className="text-[16px] leading-[1.38]" style={{ color: ink2 }}>
            {GROWTH_CHECK.done.body}
          </p>
          <Link href={GROWTH_CHECK.done.primary.href} className="inline-flex min-h-[44px] items-center rounded-full px-5 py-3 text-[15px] font-medium" style={{ background: "var(--color-mkt-amber, #f6b400)", color: ink }}>
            {GROWTH_CHECK.done.primary.label}
          </Link>
          <Link href={GROWTH_CHECK.done.secondary.href} className="inline-flex min-h-[44px] items-center rounded-full border px-5 py-3 text-[15px] font-medium" style={{ borderColor: ink, color: ink }}>
            {GROWTH_CHECK.done.secondary.label}
          </Link>
          {state.confirmationId ? (
            <p className="text-[11px] leading-[1.38]" style={{ color: ink2 }}>
              Confirmation {state.confirmationId}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <h1 id="growth-check-title" className="text-[42px] font-semibold leading-[1.08] tracking-[-1.05px] md:text-[48px] md:tracking-[-1.2px] lg:text-[64px] lg:tracking-[-1.6px]" style={{ color: ink }}>
            {GROWTH_CHECK.headline}
          </h1>
          <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
            <form data-node-id="204:9519" action={formAction} noValidate className="relative flex w-full flex-col gap-[14px] rounded-2xl border bg-white p-5 lg:w-[600px] lg:shrink-0" style={{ borderColor: line }}>
              <Field id="gc-website" label="Business website" error={errors.websiteUrl}>
                <TextInput id="gc-website" name="websiteUrl" inputMode="url" autoComplete="url" placeholder="yourbusiness.com" defaultValue={website} maxLength={2048} error={errors.websiteUrl} />
              </Field>
              <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 md:gap-4">
                <Field id="gc-trade" label="Trade" error={errors.trade}>
                  <SelectInput id="gc-trade" name="trade" placeholder="Choose your trade" error={errors.trade} options={HOME_SERVICE_TRADES.map((t) => ({ value: t, label: TRADE_LABELS[t] }))} />
                </Field>
                <Field id="gc-location" label="ZIP or city" error={errors.location}>
                  <TextInput id="gc-location" name="location" placeholder="74103 or Tulsa" autoComplete="postal-code" maxLength={100} error={errors.location} />
                </Field>
              </div>
              <Field id="gc-email" label="Email address" error={errors.email}>
                <TextInput id="gc-email" name="email" type="email" inputMode="email" placeholder="you@yourbusiness.com" autoComplete="email" maxLength={254} error={errors.email} />
              </Field>
              <Honeypot />
              <FormAlert state={state} />
              <div>
                <SubmitButton label={GROWTH_CHECK.submit} pendingLabel="Sending…" />
              </div>
              <p className="text-[11px] leading-[1.38]" style={{ color: ink2 }}>
                {GROWTH_CHECK.note}
              </p>
            </form>
            <Image src="/marketing/demo/demo-hero.png" alt="Home service business owner using a tablet beside his open work van" width={1264} height={760} className="h-[200px] w-full rounded-2xl object-cover lg:h-[380px] lg:w-[632px] lg:shrink-0" />
          </div>
        </>
      )}
    </section>
    </ScaleToFrame>
  );
}
