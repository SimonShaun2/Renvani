"use client";

import { useState } from "react";
import { ZIP_CHECK_COPY as C, normalizeUsZip, type ZipCheckState } from "./booking-growth.utils";

const btnPrimary =
  "inline-flex shrink-0 items-center justify-center rounded-[12px] bg-[#f6b400] px-[18px] py-[12px] text-[14px] font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-60";
const input = "min-w-0 flex-1 rounded-[10px] border bg-white px-[14px] py-[12px] text-[15px] text-[#0f1530] outline-none placeholder:text-[#9aa0b4]";

export interface ZipCheckCardProps {
  companyName: string;
  zip: string;
  onZipChange: (zip: string) => void;
  checkZip: (zip: string) => Promise<{ served: boolean }>;
  onContinue: (zip: string) => void;
  captureEmail: (input: { zip: string; email: string }) => Promise<unknown>;
}

/** Figma 310:122/143/166 (desktop 640px card) and 310:186/207/230 (mobile 358px card at 390px). */
export function ZipCheckCard({ companyName, zip, onZipChange, checkZip, onContinue, captureEmail }: ZipCheckCardProps) {
  const [state, setState] = useState<ZipCheckState>("idle");
  const [checkedZip, setCheckedZip] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const run = async () => {
    const normalized = normalizeUsZip(zip);
    if (!normalized) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setState("checking");
    try {
      const { served } = await checkZip(normalized);
      setCheckedZip(normalized);
      setState(served ? "in_area" : "out_of_area");
    } catch {
      setState("error");
    }
  };

  const sendEmail = async () => {
    setEmailState("saving");
    try {
      await captureEmail({ zip: checkedZip, email: email.trim() });
      setEmailState("saved");
    } catch {
      setEmailState("error");
    }
  };

  const errored = state === "error" || invalid;

  return (
    <section
      data-testid="zip-check"
      data-state={state}
      className="flex w-full flex-col items-start gap-[14px] rounded-[14px] border border-[#e6dccb] bg-white p-[24px]"
    >
      <h2 className="text-[22px] font-semibold text-[#0f1530] md:text-[28px]">{C.title}</h2>
      <p className="text-[13px] text-[#5e6684]">{C.intro(companyName)}</p>
      <form
        className="flex w-full gap-[8px]"
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <input
          aria-label="ZIP code"
          inputMode="numeric"
          autoComplete="postal-code"
          value={zip}
          onChange={(event) => {
            onZipChange(event.target.value);
            setInvalid(false);
          }}
          aria-invalid={errored}
          className={`${input} ${errored ? "border-[#b42318]" : "border-[#e6dccb]"}`}
        />
        <button type="submit" disabled={state === "checking" || zip.trim().length < 5} className={btnPrimary}>
          {state === "checking" ? C.checking : C.check}
        </button>
      </form>
      {invalid ? <p className="text-[12px] text-[#b42318]">{C.invalid}</p> : null}

      {state === "in_area" ? (
        <div className="flex w-full flex-col items-start gap-[10px] rounded-[10px] bg-[#e4f1e8] p-[14px]">
          <p className="text-[15px] font-semibold text-[#2f7d4f]">{C.servedTitle(checkedZip)}</p>
          <p className="text-[13px] text-[#2a3360]">{C.servedBody}</p>
          <button type="button" className={btnPrimary} onClick={() => onContinue(checkedZip)}>
            {C.continue}
          </button>
        </div>
      ) : null}

      {state === "out_of_area" ? (
        <div className="flex w-full flex-col items-start gap-[10px] rounded-[10px] bg-[#fff6dc] p-[14px]">
          <p className="text-[15px] font-semibold text-[#0f1530]">{C.outTitle(checkedZip)}</p>
          <p className="text-[13px] text-[#2a3360]">{C.outBody}</p>
          {emailState === "saved" ? (
            <p role="status" className="text-[13px] font-medium text-[#2f7d4f]">{C.emailSaved}</p>
          ) : (
            <>
              <input
                aria-label="Email"
                type="email"
                autoComplete="email"
                placeholder={C.emailPlaceholder}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`${input} w-full border-[#e6dccb]`}
              />
              <button type="button" className={btnPrimary} disabled={!email.trim() || emailState === "saving"} onClick={() => void sendEmail()}>
                {C.emailCta}
              </button>
              {emailState === "error" ? <p role="alert" className="text-[12px] text-[#b42318]">We couldn&apos;t save that email. Try again.</p> : null}
            </>
          )}
        </div>
      ) : null}

      {state === "error" ? (
        <div className="flex w-full items-center gap-[12px] rounded-[10px] bg-[#fbe3dc] px-[14px] py-[12px]">
          <p role="alert" className="min-w-0 flex-1 text-[13px] font-medium text-[#b42318]">{C.error}</p>
          <button
            type="button"
            onClick={() => void run()}
            className="inline-flex shrink-0 items-center justify-center rounded-[12px] border border-[#e6dccb] bg-white px-[18px] py-[12px] text-[14px] font-semibold text-[#0f1530]"
          >
            {C.retry}
          </button>
        </div>
      ) : null}
    </section>
  );
}
