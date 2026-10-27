import type { ReactNode } from "react";

import { cn } from "@/src/lib/utils";

import type { ProfileKpi, ProfilePillTone } from "./customer-profile.utils";

/** Figma 1:17 primitives (cards, pills, buttons). Shared by every profile section. */
const PILL_TONES: Record<ProfilePillTone, string> = {
  blue: "bg-[#e5eafb] text-[#2b4acb]",
  green: "bg-[#e4f1e8] text-[#2f7d4f]",
  neutral: "bg-[#eef0f5] text-[#2a3360]",
  amber: "bg-[#fff4d6] text-[#7a5600]",
  red: "bg-[#fbe3dc] text-[#b42318]"
};

export function ProfilePillBadge({ label, tone }: { label: string; tone: ProfilePillTone }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold", PILL_TONES[tone])}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export function ProfileCard({
  title,
  action,
  className,
  children,
  ...rest
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, "title">) {
  return (
    <section className={cn("flex flex-col gap-3 rounded-[14px] border border-[#e6dccb] bg-white p-5", className)} aria-label={title} {...rest}>
      {title || action ? (
        <div className="flex items-center gap-3">
          {title ? <h2 className="flex-1 text-base font-semibold text-[#0f1530]">{title}</h2> : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

const BUTTON_VARIANTS = {
  secondary: "border border-[#e6dccb] bg-white text-[#0f1530] hover:bg-[#fbf6ef]",
  dark: "bg-[#0f1530] text-white hover:bg-[#1c2449]"
} as const;

export function profileButtonClass(variant: keyof typeof BUTTON_VARIANTS = "secondary") {
  return cn("inline-flex items-center rounded-[10px] px-[18px] py-3 text-sm font-semibold transition-colors disabled:opacity-50", BUTTON_VARIANTS[variant]);
}

export function ProfileMonoLabel({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] font-medium uppercase text-[#5e6684]">{children}</p>;
}

/** KPI tile (144:101 / 105 / 109 / 113). */
export function ProfileKpiCard({ kpi }: { kpi: ProfileKpi }) {
  return (
    <div data-kpi={kpi.key} className="flex min-w-0 flex-col gap-1.5 rounded-[14px] border border-[#e6dccb] bg-white p-5">
      <ProfileMonoLabel>{kpi.label}</ProfileMonoLabel>
      <p className="truncate text-[30px] font-semibold leading-tight text-[#0f1530]">{kpi.value}</p>
      <p className="truncate text-xs text-[#5e6684]">{kpi.caption}</p>
    </div>
  );
}
