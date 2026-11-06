"use client";

import { HOME_SERVICE_TRADES, TRADE_LABELS } from "@/src/lib/marketing-intake";
import { MARKETING_TEAM_SIZES } from "@fsm/types";
import { Field, SelectInput, TextInput, type ErrorTone } from "./IntakeFields";

export const LEAD_FIELD_NAMES = ["firstName", "lastName", "email", "phone", "company", "trade", "teamSize"] as const;

/** Shared field order and accessible labels for every public lead-capture form. */
export function LeadContactFields({ prefix, values = {}, errors = {}, tone = "red" }: {
  prefix: string;
  values?: Record<string, string>;
  errors?: Record<string, string>;
  tone?: ErrorTone;
}) {
  const text = (key: string, label: string, placeholder: string, autoComplete: string, maxLength: number, full = false, type = "text") => {
    const id = prefix + "-" + key;
    return <Field id={id} label={label} error={errors[key]} tone={tone} className={full ? "md:col-span-2" : ""}>
      <TextInput id={id} name={key} defaultValue={values[key] ?? ""} placeholder={placeholder} autoComplete={autoComplete} maxLength={maxLength} type={type} inputMode={type === "tel" ? "tel" : type === "email" ? "email" : "text"} error={errors[key]} tone={tone} />
    </Field>;
  };
  return <div className="grid grid-cols-1 gap-[14px] md:grid-cols-2 md:gap-4" data-lead-contact-fields="">
    {text("firstName", "First Name", "First name", "given-name", 60)}
    {text("lastName", "Last Name", "Last name", "family-name", 60)}
    {text("email", "Work Email", "you@yourbusiness.com", "email", 254, false, "email")}
    {text("phone", "Contact Number", "(918) 555-0100", "tel", 32, false, "tel")}
    {text("company", "Business Name", "Your business", "organization", 160, true)}
    <Field id={prefix + "-trade"} label="Trade" error={errors.trade} tone={tone}>
      <SelectInput id={prefix + "-trade"} name="trade" defaultValue={values.trade ?? ""} placeholder="Choose your trade" error={errors.trade} tone={tone} options={HOME_SERVICE_TRADES.map(value => ({ value, label: TRADE_LABELS[value] }))} />
    </Field>
    <Field id={prefix + "-team"} label="Team Size" error={errors.teamSize} tone={tone}>
      <SelectInput id={prefix + "-team"} name="teamSize" defaultValue={values.teamSize ?? ""} placeholder="Choose team size" error={errors.teamSize} tone={tone} options={MARKETING_TEAM_SIZES.map(value => ({ value, label: value }))} />
    </Field>
  </div>;
}
