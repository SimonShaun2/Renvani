import type { ReactNode } from "react";

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  variant?: "default" | "operator";
  /** Nest settings panels below the main Settings h1 without duplicate h1s. */
  headingLevel?: 1 | 2;
  children: ReactNode;
}

export function PageLayout({ title, subtitle, actions, children, variant = "default", headingLevel = 1 }: PageLayoutProps) {
  const operator = variant === "operator";
  return (
    <div className={operator ? "space-y-6 text-[#0f1530]" : "space-y-6"}>
      <section className={operator
        ? "flex min-h-[84px] flex-col justify-between gap-4 border-b border-[#e6dccb] pb-5 md:flex-row md:items-center"
        : "flex min-h-16 flex-col justify-between gap-4 rounded-[28px] border border-neutral-200 bg-white px-6 py-5 shadow-sm md:flex-row md:items-center"}>
        <div className="min-w-0">
          {operator && headingLevel === 1 ? (
            <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] text-[#0f1530]">{title}</h1>
          ) : operator ? (
            <h2 className="text-[26px] font-semibold leading-tight tracking-[-0.03em] text-[#0f1530]">{title}</h2>
          ) : (
            <h2 className="text-2xl font-semibold tracking-tight text-neutral-900">{title}</h2>
          )}
          {subtitle ? <p className={operator ? "mt-1 text-sm leading-6 text-[#5e6684]" : "mt-1 text-sm text-neutral-500"}>{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
      </section>
      <div>{children}</div>
    </div>
  );
}
