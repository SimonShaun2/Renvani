"use client";

import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  action?: React.ReactNode;
  compact?: boolean;
  /** Scoped operator-screen visual treatment; other screens keep their existing appearance. */
  variant?: "default" | "operator";
}

export function EmptyState({ title, subtitle, icon: Icon, action, compact = false, variant = "default" }: EmptyStateProps) {
  const operator = variant === "operator";
  return (
    <div
      className={[
        operator
          ? "flex flex-col items-center justify-center rounded-[14px] border border-[#e6dccb] bg-white text-center"
          : "flex flex-col items-center justify-center rounded-3xl border border-dashed border-neutral-200 bg-neutral-50/80 text-center",
        compact ? "px-5 py-8" : "px-6 py-12"
      ].join(" ")}
    >
      <div className={operator ? "flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#fff4d6] text-[#7a5600]" : "flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent-light text-brand-accent"}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className={operator ? "mt-4 text-base font-semibold text-[#0f1530]" : "mt-4 text-base font-semibold text-neutral-900"}>{title}</h3>
      <p className={operator ? "mt-2 max-w-md text-sm leading-6 text-[#5e6684]" : "mt-2 max-w-md text-sm leading-6 text-neutral-500"}>{subtitle}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
