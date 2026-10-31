"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { LoyaltyReminderCandidateV1, LoyaltyReminderRuleFamily } from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useLoyaltyReminderCandidates, type LoyaltyReminderCandidatesQuery } from "@/src/hooks/loyalty.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import {
  HORIZON_DEFAULT,
  HORIZON_MAX,
  HORIZON_MIN,
  LAPSED_MAX,
  LAPSED_MIN,
  RULE_FAMILY_LABELS,
  canViewReminderCandidates,
  describeDaysSince,
  describeDaysUntilDue,
  formatLocalDate,
  groupByRuleFamily,
  parseHorizonDays,
  parseLapsedDays
} from "./reminder-candidates.utils";

// Styles from Figma 10:2083 "Operator / 09 Marketing automations".
// Table card 10:2186: white, #e6dccb border, radius 14. Header row 10:2187: #fbf6ef, 20/10 padding, 10px medium #5e6684.
// Body rows 10:2193: 20/14 padding, 13px; first column semibold #0f1530, others #2a3360.
// Dark button 10:2152: 44px tall, 18px padding, radius 10, #0f1530 with white 14px semibold text.
const tableCard = "overflow-x-auto rounded-[14px] border border-[#e6dccb] bg-white";
const headCell = "bg-[#fbf6ef] px-5 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide text-[#5e6684]";
const bodyCell = "px-5 py-3.5 text-[13px] text-[#2a3360]";
const darkButton =
  "inline-flex h-11 items-center justify-center rounded-[10px] bg-[#0f1530] px-[18px] text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "mt-1 h-11 w-32 rounded-[10px] border border-[#e6dccb] bg-white px-3 text-sm text-[#0f1530] outline-none focus:border-[#0f1530]";
// Status pills 10:2173 (Live #e4f1e8/#2f7d4f) and 10:2176 (Asks you first #fff4d6/#7a5600): 24px, radius 999, 10/4 padding, 12px semibold.
const pillTone: Record<LoyaltyReminderRuleFamily, string> = {
  plan_cadence: "bg-[#e4f1e8] text-[#2f7d4f]",
  lapsed_reactivation: "bg-[#fff4d6] text-[#7a5600]"
};

function Pill({ family }: { family: LoyaltyReminderRuleFamily }) {
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold ${pillTone[family]}`}>
      {RULE_FAMILY_LABELS[family].pill}
    </span>
  );
}

function rowKey(c: LoyaltyReminderCandidateV1, i: number) {
  return `${c.ruleFamily}-${c.customerId}-${c.maintenancePlanId ?? c.evidenceJobId ?? i}`;
}

function CandidateTable({ family, items }: { family: LoyaltyReminderRuleFamily; items: LoyaltyReminderCandidateV1[] }) {
  const label = RULE_FAMILY_LABELS[family];
  const isPlan = family === "plan_cadence";
  return (
    <section aria-labelledby={`rc-${family}`} className="space-y-3" data-testid={`group-${family}`}>
      <div>
        <h3 id={`rc-${family}`} className="text-lg font-semibold text-[#0f1530]">
          {label.title} <span className="text-sm font-medium text-[#5e6684]">· {items.length}</span>
        </h3>
        <p className="text-[13px] text-[#5e6684]">{label.description}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-[14px] border border-[#e6dccb] bg-white px-5 py-4 text-[13px] text-[#5e6684]">
          {isPlan ? "No plan visits due in this window." : "No lapsed customers for this window."}
        </p>
      ) : (
        <div className={tableCard}>
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th className={headCell}>Customer</th>
                <th className={headCell}>Plan</th>
                <th className={headCell}>{isPlan ? "Next service" : "Last service"}</th>
                <th className={headCell}>{isPlan ? "Days until due" : "Days since last service"}</th>
                <th className={headCell}>Type</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c, i) => (
                <tr key={rowKey(c, i)} className="border-t border-[#e6dccb]">
                  <td className={`${bodyCell} font-semibold text-[#0f1530]`}>
                    <Link href={`/customers/${c.customerId}`} className="hover:underline">
                      {c.customerName}
                    </Link>
                  </td>
                  <td className={bodyCell}>{c.planName ?? "No plan"}</td>
                  <td className={bodyCell}>{formatLocalDate(isPlan ? c.nextServiceDate : c.lastServiceDate)}</td>
                  <td className={bodyCell}>{isPlan ? describeDaysUntilDue(c.daysUntilDue) : describeDaysSince(c.daysSinceLastService)}</td>
                  <td className={bodyCell}>
                    <Pill family={c.ruleFamily} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ReminderCandidatesClient() {
  const role = useAuthStore((s) => s.user?.role ?? null);
  const allowed = canViewReminderCandidates(role);
  const [horizonInput, setHorizonInput] = useState(String(HORIZON_DEFAULT));
  const [lapsedInput, setLapsedInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [query, setQuery] = useState<LoyaltyReminderCandidatesQuery>({ horizonDays: HORIZON_DEFAULT });
  const result = useLoyaltyReminderCandidates(query, allowed);

  if (!allowed) {
    return (
      <PageLayout title="Service reminders">
        <p role="status" className="surface-card px-6 py-4 text-sm text-neutral-700">
          You don&apos;t have access to service reminders. Ask an owner, admin or dispatcher.
        </p>
      </PageLayout>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const h = parseHorizonDays(horizonInput);
    if (!h.ok) return setFormError(h.message);
    const l = parseLapsedDays(lapsedInput);
    if (!l.ok) return setFormError(l.message);
    setFormError(null);
    setQuery({ horizonDays: h.value ?? HORIZON_DEFAULT, ...(l.value !== undefined ? { lapsedDays: l.value } : {}) });
  }

  const candidates = result.data?.candidates ?? [];

  return (
    <PageLayout
      title="Service reminders"
      subtitle="Customers due for a maintenance plan visit (tune-ups, inspections) and past customers who haven't booked in a while."
    >
      <div className="space-y-6">
        <div role="note" data-testid="preview-banner" className="rounded-[14px] border border-[#e6dccb] bg-[#fff4d6] px-5 py-4 text-[13px] text-[#7a5600]">
          <strong className="font-semibold">Preview only: no messages are sent.</strong> This list shows who would get a reminder. Nothing goes to customers from this page.
        </div>

        <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-4 rounded-[14px] border border-[#e6dccb] bg-white px-5 py-4">
          <label className="text-[13px] font-medium text-[#2a3360]">
            Due within (days)
            <input
              className={`${inputClass} block`}
              inputMode="numeric"
              min={HORIZON_MIN}
              max={HORIZON_MAX}
              value={horizonInput}
              onChange={(e) => setHorizonInput(e.target.value)}
              aria-describedby="rc-horizon-help"
            />
            <span id="rc-horizon-help" className="mt-1 block text-[11px] text-[#5e6684]">{HORIZON_MIN}–{HORIZON_MAX}</span>
          </label>
          <label className="text-[13px] font-medium text-[#2a3360]">
            No visit in (days)
            <input
              className={`${inputClass} block`}
              inputMode="numeric"
              min={LAPSED_MIN}
              max={LAPSED_MAX}
              placeholder="Default"
              value={lapsedInput}
              onChange={(e) => setLapsedInput(e.target.value)}
              aria-describedby="rc-lapsed-help"
            />
            <span id="rc-lapsed-help" className="mt-1 block text-[11px] text-[#5e6684]">Optional, {LAPSED_MIN}–{LAPSED_MAX}</span>
          </label>
          <button type="submit" className={`${darkButton} mb-5`} disabled={result.isFetching}>
            Update preview
          </button>
          {formError ? (
            <p role="alert" data-testid="filter-error" className="w-full text-[13px] text-error">
              {formError}
            </p>
          ) : null}
        </form>

        {result.isLoading ? (
          <SkeletonCard />
        ) : result.isError ? (
          <ErrorState title="Couldn't load service reminders" onRetry={() => void result.refetch()} />
        ) : candidates.length === 0 ? (
          <p role="status" data-testid="empty-state" className="rounded-[14px] border border-[#e6dccb] bg-white px-5 py-6 text-[13px] text-[#5e6684]">
            No customers are due for a reminder in this window. Try a longer window, or check back after more service history is imported.
          </p>
        ) : (
          groupByRuleFamily(candidates).map((g) => <CandidateTable key={g.family} family={g.family} items={g.items} />)
        )}
      </div>
    </PageLayout>
  );
}
