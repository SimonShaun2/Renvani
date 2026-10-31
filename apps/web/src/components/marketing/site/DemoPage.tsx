"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState } from "react";

import { submitDemoRequest } from "@/app/(marketing)/demo/actions";
import { HOME_SERVICE_TRADES, TRADE_LABELS, type IntakeResult } from "@/src/lib/marketing-intake";

import { ScaleToFrame } from "./ScaleToFrame";
import { Field, FormAlert, Honeypot, SelectInput, SubmitButton, TextInput, ink, ink2, line } from "./IntakeFields";

export const DEMO = {
  eyebrow: "SEE IT WITH YOUR OWN WORKFLOW",
  headline: ["Your business.", "In Renvani."],
  title: "Let’s see your work.",
  submit: "Request my demo",
  note: "We’ll use these details to respond to your request.",
  teamSizes: ["Just me", "2–5", "6–15", "16–50", "50+"],
  success: { title: "Thanks. Your demo request is in.", body: "We’ll reply by email to set a time that works for you." }
};

/** Demo page. Figma page 11: desktop 176:737, tablet 253:6781, mobile 176:826. ScaleToFrame (1440) from 1280 up. */
export function DemoPage({ action = submitDemoRequest }: { action?: (prev: IntakeResult | null, fd: FormData) => Promise<IntakeResult> }) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.status === "invalid" ? state.fields : {};
  return (
    <ScaleToFrame width={1440} from={1280}>
    <section data-node-id="204:9229" className="mx-auto flex max-w-[1440px] flex-col gap-8 p-6 md:gap-7 md:p-8 xl:gap-8 xl:p-20" aria-labelledby="demo-title">
      <div className="flex flex-col gap-8 md:gap-7 xl:flex-row xl:gap-16">
        <div className="flex flex-col gap-6 md:gap-7 xl:w-[600px] xl:shrink-0 xl:gap-6">
          <p className="text-[11px] font-medium leading-[1.38] tracking-[1.1px]" style={{ color: ink2 }}>
            {DEMO.eyebrow}
          </p>
          <h1 id="demo-title" className="text-[42px] font-semibold leading-[1.08] tracking-[-1.05px] md:text-[48px] md:tracking-[-1.2px] xl:text-[64px] xl:tracking-[-1.6px]" style={{ color: ink }}>
            <span className="block md:inline xl:block">{DEMO.headline[0]}</span> <span className="block md:inline xl:block">{DEMO.headline[1]}</span>
          </h1>
          <Image src="/marketing/demo/demo-hero.png" alt="Home service business owner using a tablet beside his open work van" width={1200} height={760} priority className="h-[230px] w-full rounded-2xl object-cover md:hidden xl:block xl:h-[380px]" />
        </div>
        <div data-node-id="204:9235" className="flex w-full flex-col gap-[14px] rounded-2xl border bg-white p-5 md:gap-5 md:p-6 xl:w-[616px] xl:shrink-0 xl:gap-[14px] xl:p-5" style={{ borderColor: line }}>
          {state?.status === "success" ? (
            <div role="status" className="flex flex-col gap-3">
              <h2 className="text-[27px] font-semibold leading-[1.38] md:text-[28px] xl:text-[32px]" style={{ color: ink }}>
                {DEMO.success.title}
              </h2>
              <p className="text-[15px] leading-[1.38]" style={{ color: ink2 }}>
                {DEMO.success.body}
              </p>
              {state.confirmationId ? (
                <p className="text-[12px] leading-[1.38]" style={{ color: ink2 }}>
                  Confirmation {state.confirmationId}
                </p>
              ) : null}
              <Link href="/product" className="text-[14px] font-medium" style={{ color: ink }}>
                Explore the product →
              </Link>
            </div>
          ) : (
            <form action={formAction} noValidate className="relative flex flex-col gap-[14px] md:gap-5 xl:gap-[14px]">
              <h2 className="text-[27px] font-semibold leading-[1.38] md:text-[28px] xl:text-[32px]" style={{ color: ink }}>
                {DEMO.title}
              </h2>
              <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 md:gap-5 xl:gap-x-4 xl:gap-y-[14px]">
                <Field id="demo-name" label="Your name" error={errors.name} className="order-1 xl:col-span-2">
                  <TextInput id="demo-name" name="name" placeholder="First and last name" autoComplete="name" maxLength={120} error={errors.name} />
                </Field>
                <Field id="demo-email" label="Work email" error={errors.email} className="order-2 md:order-3 md:col-span-2 xl:order-2">
                  <TextInput id="demo-email" name="email" type="email" inputMode="email" placeholder="you@yourbusiness.com" autoComplete="email" maxLength={254} error={errors.email} />
                </Field>
                <Field id="demo-company" label="Business name" error={errors.company} className="order-3 md:order-2 xl:order-3 xl:col-span-2">
                  <TextInput id="demo-company" name="company" placeholder="Your business" autoComplete="organization" maxLength={160} error={errors.company} />
                </Field>
                <Field id="demo-trade" label="Trade" error={errors.trade} className="order-4">
                  <SelectInput tabletChevron={false} id="demo-trade" name="trade" placeholder="Choose your trade" error={errors.trade} options={HOME_SERVICE_TRADES.map((t) => ({ value: t, label: TRADE_LABELS[t] }))} />
                </Field>
                <Field id="demo-team" label="Team size" error={errors.teamSize} className="order-5">
                  <SelectInput tabletChevron={false} id="demo-team" name="teamSize" placeholder="Choose team size" error={errors.teamSize} required={false} options={DEMO.teamSizes.map((t) => ({ value: t, label: t }))} />
                </Field>
              </div>
              <Honeypot />
              <FormAlert state={state} />
              <div>
                <SubmitButton label={DEMO.submit} pendingLabel="Sending…" />
              </div>
              <p className="text-[11px] leading-[1.38]" style={{ color: ink2 }}>
                {DEMO.note}
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
    </ScaleToFrame>
  );
}
