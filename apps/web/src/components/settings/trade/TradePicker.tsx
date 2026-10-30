"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { HomeServiceTrade } from "@fsm/types";

import { useCompanyTrade, useUpdateCompanyTrade } from "@/src/hooks/company-trade.hooks";

import { TRADE_OPTIONS, TRADE_PICKER_COPY as COPY } from "./trade-picker.config";
import { buildTradePayload, TRADE_DESCRIBE_MAX, validateTradeSelection, type TradePickerStatus } from "./trade-picker.utils";

/** Settings / Company trade (Figma 309:3333, "Other" field 309:3498). */
export function TradePicker({ companyName }: { companyName?: string | undefined }) {
  const tradeQuery = useCompanyTrade();
  const updateTrade = useUpdateCompanyTrade();
  const savedTrade = tradeQuery.data?.trade.trade ?? null;
  const savedDescribe = tradeQuery.data?.trade.tradeDescription ?? "";

  const [selected, setSelected] = useState<HomeServiceTrade | null>(savedTrade);
  const [describe, setDescribe] = useState(savedDescribe);
  const [hydrated, setHydrated] = useState(Boolean(tradeQuery.data));
  const [describeError, setDescribeError] = useState(false);
  const [phase, setPhase] = useState<"idle" | "saving" | "error" | "saved">("idle");

  useEffect(() => {
    // Hydrate once from the saved trade, whether it was cached at mount or arrives later.
    if (hydrated || !tradeQuery.data) return;
    setSelected(savedTrade);
    setDescribe(savedDescribe);
    setHydrated(true);
  }, [hydrated, tradeQuery.data, savedTrade, savedDescribe]);

  const dirty = selected !== null && (selected !== savedTrade || (selected === "other" && describe.trim() !== savedDescribe));
  const status: TradePickerStatus =
    phase === "saving" ? "saving" : phase === "error" ? "error" : phase === "saved" ? "saved" : dirty ? "selected" : "default";
  const describeMissing = selected === "other" && describe.trim().length === 0;
  const canSave = (status === "selected" || status === "error") && !describeMissing;

  function choose(trade: HomeServiceTrade) {
    setSelected(trade);
    setDescribeError(false);
    setPhase("idle");
  }

  async function save() {
    if (!selected || phase === "saving") return;
    if (validateTradeSelection(selected, describe).describe) {
      setDescribeError(true);
      return;
    }
    setPhase("saving");
    try {
      await updateTrade.mutateAsync(buildTradePayload(selected, describe));
      setPhase("saved");
    } catch {
      setPhase("error");
    }
  }

  const saveButton = (
    <button
      type="button"
      onClick={() => void save()}
      disabled={!canSave}
      data-testid="trade-save"
      className={
        canSave
          ? "rounded-[10px] bg-[#f6b400] px-4 py-2.5 text-sm font-semibold text-[#0f1530]"
          : "inline-flex items-center gap-2 rounded-[10px] bg-[#eef0f5] px-4 py-2.5 text-sm font-semibold text-[#9aa0b4]"
      }
    >
      {status === "saving" ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {COPY.saving}
        </>
      ) : (
        COPY.save
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-5" data-status={status} data-testid="trade-picker">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold text-[#0f1530]">{COPY.pageTitle}</h1>
          {companyName ? <p className="mt-1 text-[13px] text-[#5e6684]">{companyName}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {status === "saved" ? (
            <span role="status" className="text-[13px] font-semibold text-[#2f7d4f]">
              {COPY.saved}
            </span>
          ) : null}
          {saveButton}
        </div>
      </header>

      {status === "error" ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-[10px] bg-[#fbe3dc] px-4 py-3 text-[13px] text-[#b42318]">
          <span>{COPY.error}</span>
          <button type="button" onClick={() => void save()} className="rounded-[8px] border border-[#e6dccb] bg-white px-3 py-1.5 font-semibold text-[#0f1530]">
            {COPY.retry}
          </button>
        </div>
      ) : null}

      <section className="rounded-[14px] border border-[#e6dccb] bg-white p-6">
        <h2 className="text-[17px] font-semibold text-[#0f1530]">{COPY.cardTitle}</h2>
        <p className="mt-1 text-[13px] text-[#5e6684]">{COPY.cardBody}</p>
        <div role="radiogroup" aria-label={COPY.cardTitle} className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          {TRADE_OPTIONS.map((option) => {
            const checked = selected === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={checked}
                disabled={status === "saving"}
                onClick={() => choose(option.value)}
                className={
                  checked
                    ? "flex flex-col gap-1 rounded-[10px] border-2 border-[#f6b400] bg-[#fff6dc] p-3 text-left"
                    : "flex flex-col gap-1 rounded-[10px] border border-[#e6dccb] bg-white p-3 text-left"
                }
              >
                <span className="text-[14px] font-semibold text-[#0f1530]">{option.label}</span>
                <span className="text-[12px] text-[#5e6684]">{option.description}</span>
              </button>
            );
          })}
        </div>

        {selected === "other" ? (
          <label className="mt-5 flex max-w-[420px] flex-col gap-2 text-[13px] text-[#2a3360]">
            <span>{COPY.describeLabel}</span>
            <input
              value={describe}
              required
              maxLength={TRADE_DESCRIBE_MAX}
              aria-invalid={describeError}
              disabled={status === "saving"}
              placeholder={COPY.describePlaceholder}
              onBlur={() => setDescribeError(validateTradeSelection(selected, describe).describe === true)}
              onChange={(event) => {
                setDescribe(event.target.value);
                setDescribeError(false);
                if (phase !== "saving") setPhase("idle");
              }}
              className={
                describeError
                  ? "rounded-[10px] border border-[#b42318] bg-white px-3 py-2.5 text-[14px]"
                  : "rounded-[10px] border border-[#e6dccb] bg-white px-3 py-2.5 text-[14px]"
              }
            />
            {describeError ? (
              <span className="text-[12px] text-[#b42318]">{COPY.describeError}</span>
            ) : (
              <span className="text-[12px] text-[#5e6684]">{COPY.describeHelp}</span>
            )}
          </label>
        ) : null}
      </section>
    </div>
  );
}
