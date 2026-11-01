"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useState } from "react";

import { submitDemoRequest } from "@/app/(marketing)/demo/actions";
import { HOME_SERVICE_TRADES, TRADE_LABELS, type IntakeResult } from "@/src/lib/marketing-intake";

import { planInterestLine, type DemoPlanInterest } from "./pricing-config";
import { ScaleToFrame } from "./ScaleToFrame";
import { Field, FormAlert, Honeypot, SelectInput, SubmitButton, TextInput, ink, ink2, line } from "./IntakeFields";

export const DEMO = {
  eyebrow: "SEE IT WITH YOUR OWN WORKFLOW",
  headline: ["Your business.", "In Renvani."],
  title: "Let’s see your work.",
  submit: "Request my demo",
  note: "We’ll use these details to respond to your request.",
  /** Blank/invalid submit summary (Figma 254:5873 desktop, 254:5964 mobile). */
  invalid: { title: "Check the highlighted details.", body: "Complete your contact details, trade, and team size before continuing." },
  teamSizes: ["Just me", "2–5", "6–15", "16–50", "50+"],
  success: { eyebrow: "YOUR DEMO", title: "Let’s look at your business.", body: "Your request is in. We’ll be in touch by email.", primary: { label: "Explore the product", href: "/product" }, emailLabel: "YOUR CONTACT EMAIL", edit: "Edit request details" }
};

/** Demo page. Figma page 11: desktop 176:737, tablet 253:6781, mobile 176:826. ScaleToFrame (1440) from 1280 up. */
export function DemoPage({ action = submitDemoRequest, plan = null }: { action?: (prev: IntakeResult | null, fd: FormData) => Promise<IntakeResult>; plan?: DemoPlanInterest | null }) {
  const [last, setLast] = useState<Record<string, string>>({});
  const email = last.email ?? "";
  const [editing, setEditing] = useState(false);
  const [state, formAction] = useActionState(async (prev: IntakeResult | null, fd: FormData) => {
    setLast(Object.fromEntries(["name", "email", "company", "trade", "teamSize"].map((k) => [k, String(fd.get(k) ?? "").trim()])));
    setEditing(false);
    return action(prev, fd);
  }, null);
  const errors = state?.status === "invalid" ? state.fields : {};
  if (state?.status === "success" && !editing) {
    return (
      <ScaleToFrame width={1440} from={1280}>
        <section data-node-id="204:9581" className="mx-auto flex max-w-[1440px] flex-col gap-8 p-6 md:p-8 xl:p-20" aria-labelledby="demo-done-title">
          <p className="text-[11px] font-medium leading-[1.38] tracking-[1.1px]" style={{ color: ink2 }}>
            {DEMO.success.eyebrow}
          </p>
          <div data-node-id="204:9583" role="status" className="flex w-full flex-col items-start gap-[14px] rounded-2xl border bg-white p-5 xl:w-[1000px] xl:shrink-0" style={{ borderColor: line }}>
            <svg aria-hidden="true" viewBox="0 0 42 42" className="size-[42px] shrink-0" fill="none" stroke={ink} strokeWidth="2.5">
              <path d="M8 22l9 9 17-19" />
            </svg>
            <h1 id="demo-done-title" className="w-full text-[32px] font-semibold leading-[1.08] tracking-[-0.8px] md:text-[46px] md:tracking-[-1.15px]" style={{ color: ink }}>
              {DEMO.success.title}
            </h1>
            <p className="w-full text-[16px] leading-[1.38]" style={{ color: ink2 }}>
              {DEMO.success.body}
            </p>
            <Link href={DEMO.success.primary.href} className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border px-5 py-3 text-[15px] font-medium" style={{ borderColor: ink, color: ink }}>
              {DEMO.success.primary.label}
            </Link>
            {state.confirmationId ? (
              <p className="w-full text-[11px] leading-[1.38]" style={{ color: ink2 }}>
                Confirmation {state.confirmationId}
              </p>
            ) : null}
            <div data-node-id="259:6060" className="flex w-full flex-col items-start gap-2 rounded-xl border bg-white p-4 md:w-[640px] md:max-w-full md:shrink-0" style={{ borderColor: line }}>
              <p className="w-full text-[12px] font-medium leading-[1.4] tracking-[0.96px]" style={{ color: ink2 }}>
                {DEMO.success.emailLabel}
              </p>
              {email ? (
                <p className="w-full break-words text-[14px] font-medium leading-[1.4]" style={{ color: ink }}>
                  {email}
                </p>
              ) : null}
              <button type="button" onClick={() => setEditing(true)} className="flex h-[44px] w-full items-center text-left text-[14px] font-medium leading-[1.4]" style={{ color: ink }}>
                {DEMO.success.edit}
              </button>
            </div>
          </div>
        </section>
      </ScaleToFrame>
    );
  }
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
            <form action={formAction} noValidate className="relative flex flex-col gap-[14px] md:gap-5 xl:gap-[14px]">
              <h2 className="text-[27px] font-semibold leading-[1.38] md:text-[28px] xl:text-[32px]" style={{ color: ink }}>
                {DEMO.title}
              </h2>
              {plan ? (
                <div data-node-id={plan === "flex" ? "257:5917" : "257:6047"} data-testid="demo-plan-interest" className="flex w-full flex-col items-start gap-[6px] rounded-xl bg-[#fbf6ef] p-4">
                  <p className="w-full text-[12px] font-medium leading-[1.4] tracking-[0.96px]" style={{ color: ink2 }}>
                    YOUR PLAN INTEREST
                  </p>
                  <p className="w-full text-[14px] font-medium leading-[1.4]" style={{ color: ink }}>
                    {planInterestLine(plan)}
                  </p>
                  <Link href="/pricing" className="flex h-[44px] w-full items-center text-[14px] font-medium leading-[1.4]" style={{ color: ink }}>
                    Change plan
                  </Link>
                </div>
              ) : null}
              {state?.status === "invalid" ? (
                <div data-node-id="254:5873" data-testid="demo-invalid-summary" role="alert" className="flex w-full flex-col items-start gap-2 rounded-xl p-4 leading-[1.4]" style={{ background: "#fff4d6" }}>
                  <p className="w-full text-[16px] font-semibold" style={{ color: ink }}>
                    {DEMO.invalid.title}
                  </p>
                  <p className="w-full text-[14px]" style={{ color: ink2 }}>
                    {DEMO.invalid.body}
                  </p>
                </div>
              ) : null}
              <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 md:gap-5 xl:gap-x-4 xl:gap-y-[14px]">
                <Field id="demo-name" label="Your name" error={errors.name} tone="amber" className="order-1 xl:col-span-2">
                  <TextInput id="demo-name" name="name" defaultValue={last.name ?? ""} placeholder="First and last name" autoComplete="name" maxLength={120} error={errors.name} tone="amber" />
                </Field>
                <Field id="demo-email" label="Work email" error={errors.email} tone="amber" className="order-2 md:order-3 md:col-span-2 xl:order-2">
                  <TextInput id="demo-email" name="email" defaultValue={last.email ?? ""} type="email" inputMode="email" placeholder="you@yourbusiness.com" autoComplete="email" maxLength={254} error={errors.email} tone="amber" />
                </Field>
                <Field id="demo-company" label="Business name" error={errors.company} tone="amber" className="order-3 md:order-2 xl:order-3 xl:col-span-2">
                  <TextInput id="demo-company" name="company" defaultValue={last.company ?? ""} placeholder="Your business" autoComplete="organization" maxLength={160} error={errors.company} tone="amber" />
                </Field>
                <Field id="demo-trade" label="Trade" error={errors.trade} tone="amber" className="order-4">
                  <SelectInput tabletChevron={false} defaultValue={last.trade ?? ""} id="demo-trade" name="trade" placeholder="Choose your trade" error={errors.trade} tone="amber" options={HOME_SERVICE_TRADES.map((t) => ({ value: t, label: TRADE_LABELS[t] }))} />
                </Field>
                <Field id="demo-team" label="Team size" error={errors.teamSize} tone="amber" className="order-5">
                  <SelectInput tabletChevron={false} defaultValue={last.teamSize ?? ""} id="demo-team" name="teamSize" placeholder="Choose team size" error={errors.teamSize} tone="amber" options={DEMO.teamSizes.map((t) => ({ value: t, label: t }))} />
                </Field>
              </div>
              <Honeypot />
              {state?.status === "invalid" ? null : <FormAlert state={state} />}
              <div>
                <SubmitButton label={DEMO.submit} pendingLabel="Sending…" />
              </div>
              <p className="text-[11px] leading-[1.38]" style={{ color: ink2 }}>
                {DEMO.note}
              </p>
            </form>
        </div>
      </div>
    </section>
    </ScaleToFrame>
  );
}
