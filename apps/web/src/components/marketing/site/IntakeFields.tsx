"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { MARKETING_HONEYPOT_FIELD, type IntakeResult } from "@/src/lib/marketing-intake";

export const ink = "var(--color-mkt-ink, #0f1530)";
export const ink2 = "var(--color-mkt-ink2, #2a3360)";
export const line = "var(--color-mkt-line, #e6dccb)";

/** Contract honeypot: visually hidden (not type=hidden), out of tab order, never autofilled, sent empty. */
export function Honeypot() {
  return (
    <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }}>
      <label htmlFor={`${MARKETING_HONEYPOT_FIELD}-field`}>Leave this field empty</label>
      <input id={`${MARKETING_HONEYPOT_FIELD}-field`} type="text" name={MARKETING_HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

const control =
  "h-[52px] w-full rounded-[12px] border p-4 placeholder:text-[#2a3360] text-[14px] leading-[1.38] outline-none focus-visible:ring-2 aria-[invalid=true]:border-[#b42318] md:bg-[#fbf6ef] md:text-[15px] lg:bg-white lg:text-[14px]";

export function Field({ id, label, error, className = "", children }: { id: string; label: string; error?: string | undefined; className?: string; children: ReactNode }) {
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <label htmlFor={id} className="text-[13px] font-medium leading-[1.38] md:text-[14px] lg:text-[13px]" style={{ color: ink }}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[12px] leading-[1.38] text-[#b42318]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = { id: string; name: string; error?: string | undefined; placeholder: string; type?: string; autoComplete?: string; inputMode?: "url" | "email" | "text" | "numeric"; defaultValue?: string; maxLength?: number };

export function TextInput({ id, name, error, type = "text", ...rest }: InputProps) {
  return <input id={id} name={name} type={type} required aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className={control} style={{ borderColor: line, color: ink }} {...rest} />;
}

export function SelectInput({ id, name, error, placeholder, options, required = true }: { id: string; name: string; error?: string | undefined; placeholder: string; options: { value: string; label: string }[]; required?: boolean }) {
  return (
    <div className="relative">
      <select id={id} name={name} required={required} defaultValue="" aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-error` : undefined} className={`${control} appearance-none pr-10`} style={{ borderColor: line, color: ink }}>
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2" fill="none" stroke={ink} strokeWidth="1.5">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </div>
  );
}

export function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex min-h-[44px] items-center justify-center rounded-full px-5 py-3 text-[15px] font-medium leading-[1.5] disabled:opacity-70" style={{ background: "var(--color-mkt-amber, #f6b400)", color: ink }}>
      {pending ? pendingLabel : label}
    </button>
  );
}

/** Form-level error with a retry (re-submits the same form). 429 shows the API's Retry-After. */
export function FormAlert({ state }: { state: IntakeResult | null }) {
  if (!state || state.status === "success") return null;
  const wait = state.status === "rate-limited" && state.retryAfterSeconds ? ` You can try again in ${state.retryAfterSeconds} seconds.` : "";
  return (
    <div role="alert" className="flex w-full flex-wrap items-center gap-3 rounded-[12px] border border-[#f3c4bf] bg-[#fdf1ef] p-3 text-[13px] leading-[1.38] text-[#7a1d14]">
      <span className="min-w-0 flex-1">
        {state.message}
        {wait}
      </span>
      {state.status !== "invalid" ? (
        <button type="submit" className="rounded-full border border-current px-3 py-1 text-[13px] font-medium">
          Try again
        </button>
      ) : null}
    </div>
  );
}
