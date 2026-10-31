"use client";

import { useId, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  rateLimitMessage,
  submitSiteInquiry,
  validateSiteInquiry,
  type InquiryField,
  type InquiryFieldErrors
} from "./site-inquiry";

interface ServiceInquiryCardProps {
  slug: string;
  service: string;
  zip: string;
}

const INPUT =
  "w-full rounded-[8px] border bg-white px-3 py-2.5 text-[15px] text-[#0f1530] placeholder:text-[#8a91a8] focus:outline-none focus:ring-2 focus:ring-[#2f7d4f]/30";

const FIELDS: Array<{ key: InquiryField; label: string; placeholder: string; type?: string; multiline?: boolean }> = [
  { key: "name", label: "Name", placeholder: "Jordan Lee" },
  { key: "phone", label: "Phone", placeholder: "(555) 010-0199", type: "tel" },
  { key: "email", label: "Email", placeholder: "jordan@example.com", type: "email" },
  { key: "message", label: "Message", placeholder: "", multiline: true }
];

/** Figma 155:109 (default) / 155:136 (form error) / 155:163 (submitted). Contract: site-inquiry.ts. */
export function ServiceInquiryCard({ slug, service, zip }: ServiceInquiryCardProps) {
  const id = useId();
  const [values, setValues] = useState<Record<InquiryField, string>>({ name: "", phone: "", email: "", message: "" });
  const [honeypot, setHoneypot] = useState("");
  const [fieldErrors, setFieldErrors] = useState<InquiryFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (honeypot.trim()) {
      setSent(""); // bot: decoy success, nothing sent
      return;
    }
    const local = validateSiteInquiry(values);
    setFieldErrors(local);
    if (Object.keys(local).length) return;
    setPending(true);
    const result = await submitSiteInquiry(slug, { ...values, service, zip });
    setPending(false);
    if (result.kind === "sent") setSent(result.referenceNumber);
    else if (result.kind === "invalid") {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError);
    } else if (result.kind === "rate_limited") setFormError(rateLimitMessage(result.retryAfterSeconds));
    else if (result.kind === "not_found") setFormError("This shop isn't taking online inquiries right now.");
    else setFormError(result.message);
  }

  if (sent !== null) {
    return (
      <div className="rounded-[14px] border border-[#dfe6e1] bg-white p-4" role="status" data-inquiry-state="submitted">
        <p className="text-[18px] font-semibold text-[#2f7d4f]">✓ Thanks — inquiry sent</p>
        <p className="mt-2 text-[13px] text-[#2a3360]">We&apos;ll reply by email.</p>
        {sent ? <p className="mt-2 font-mono text-[11px] text-[#5e6684]">Ref {sent}</p> : null}
      </div>
    );
  }

  return (
    <form
      className="space-y-3 rounded-[14px] border border-[#dfe6e1] bg-white p-4"
      onSubmit={(event) => void handleSubmit(event)}
      noValidate
      data-inquiry-state={Object.keys(fieldErrors).length || formError ? "error" : "default"}
    >
      <h2 className="text-[18px] font-semibold text-[#0f1530]">Ask a question</h2>
      {FIELDS.map((field) => {
        const error = fieldErrors[field.key];
        const inputId = `${id}-${field.key}`;
        const props = {
          id: inputId,
          name: field.key,
          value: values[field.key],
          placeholder: field.placeholder || `Need a quote for ${service.toLowerCase()}…`,
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error ? `${inputId}-error` : undefined,
          className: `${INPUT} ${error ? "border-[#b42318]" : "border-[#cfd8d2]"}`,
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
            setValues((v) => ({ ...v, [field.key]: e.target.value }))
        };
        return (
          <div key={field.key} className="space-y-1.5">
            <label htmlFor={inputId} className="block text-[13px] font-medium text-[#2a3360]">
              {field.label}
            </label>
            {field.multiline ? <textarea rows={3} {...props} /> : <input type={field.type ?? "text"} {...props} />}
            {error ? (
              <p id={`${inputId}-error`} className="text-[12px] text-[#b42318]">
                {error}
              </p>
            ) : null}
          </div>
        );
      })}
      <div aria-hidden className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-website`}>Website</label>
        <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>
      {formError ? (
        <p role="alert" className="text-[12px] text-[#b42318]">
          {formError}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#2f7d4f] text-sm font-semibold text-white hover:bg-[#286b44] disabled:opacity-70"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Send inquiry
      </button>
      <p className="text-[12px] text-[#5e6684]">We&apos;ll reply by email.</p>
    </form>
  );
}
