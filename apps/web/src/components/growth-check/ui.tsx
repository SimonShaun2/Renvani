import type { ReactNode } from "react";

// Figma 366:4217 (Operator / 10a Growth Check · Findings review) shared styles.
export const cardClass = "rounded-[14px] border border-[#e6dccb] bg-white p-5";
export const cardTitle = "text-[17px] font-semibold text-[#0f1530]";
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] focus-visible:ring-offset-2";
export const secondaryButton = `inline-flex h-11 items-center justify-center rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-[13px] font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50 lg:h-10 ${focusRing}`;
export const darkButton = `inline-flex h-11 items-center justify-center rounded-[10px] bg-[#0f1530] px-[18px] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 lg:h-10 ${focusRing}`;
export const fieldLabel = "block text-[13px] font-medium text-[#2a3360]";
export const inputClass = "mt-1.5 block w-full rounded-[8px] border border-[#e6dccb] bg-white px-3 text-sm text-[#0f1530] outline-none placeholder:text-[#5e6684] focus:border-[#0f1530]";

const PILL = {
  neutral: "bg-[#eef0f5] text-[#2a3360]",
  warn: "bg-[#fff4d6] text-[#0f1530]",
  success: "bg-[#e4f1e8] text-[#2f7d4f]",
  error: "bg-[#fbe3dc] text-[#b42318]"
} as const;
export function Pill({ tone, children }: { tone: keyof typeof PILL; children: ReactNode }) {
  return <span className={`inline-flex h-[22px] items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-[0.06em] ${PILL[tone]}`}>{children}</span>;
}

const ALERT = {
  neutral: ["bg-[#eef0f5]", "text-[#0f1530]", "text-[#2a3360]"],
  error: ["bg-[#fbe3dc]", "text-[#b42318]", "text-[#b42318]"]
} as const;
export function Alert({ tone, title, detail, children, role }: { tone: keyof typeof ALERT; title: string; detail?: string; children?: ReactNode; role?: string }) {
  const [box, t, d] = ALERT[tone];
  return (
    <div role={role} className={`space-y-1.5 rounded-[10px] p-3.5 ${box}`}>
      <p className={`text-sm font-semibold ${t}`}>{title}</p>
      {detail ? <p className={`text-[13px] ${d}`}>{detail}</p> : null}
      {children}
    </div>
  );
}

/** Figma finding pill: owner-confirmed fact, unreviewed machine observation, or a reviewed hypothesis. */
export function findingKind(current: { reviewState: string; ownerConfirmedFact: boolean }): { label: string; tone: keyof typeof PILL } {
  if (current.ownerConfirmedFact) return { label: "Owner-confirmed", tone: "success" };
  if (current.reviewState === "machine") return { label: "Machine observation", tone: "neutral" };
  return { label: "Hypothesis", tone: "warn" };
}
