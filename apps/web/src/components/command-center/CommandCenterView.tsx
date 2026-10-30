import Link from "next/link";

import { EMPTY, KPIS, LOOP_STAGES } from "./command-center.config";
import { LocalDate, LocalGreeting } from "./LocalClock";
import { HeaderSummary, NeedsYou } from "./NeedsYou";
import "./command-center-motion.css";

const card = "rounded-[14px] border border-[#e6dccb] bg-white";
const mono = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#5e6684]";

export interface CommandCenterViewProps {
  firstName: string | null;
}

/** Server-rendered shell for Figma 10:2. Only NeedsYou/HeaderSummary hydrate (inbox query + actions). */
export function CommandCenterView({ firstName }: CommandCenterViewProps) {
  return (
    <div className="space-y-6 text-[#0f1530]" data-figma="10:2">
      <header className="flex flex-wrap items-center gap-4" data-figma="10:64">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h1 className="flex flex-wrap items-baseline gap-2.5 text-[32px] leading-tight">
            <span className="font-semibold tracking-[-0.02em]">
              <LocalGreeting />
            </span>
            {firstName ? <span className="font-serif italic text-[#2a3360]">{firstName}.</span> : null}
          </h1>
          <p className="text-sm text-[#5e6684]">
            <LocalDate /> · <HeaderSummary />
          </p>
        </div>
        <Link href="/customers" data-cc-button className="flex h-11 items-center rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-sm font-semibold hover:border-[#d4c6ad]">
          Search
        </Link>
        {/* No operator "new inquiry" route/endpoint on dev yet: shown disabled. */}
        <button type="button" disabled title="Coming soon" className="flex h-11 items-center rounded-[10px] bg-[#0f1530] px-[18px] text-sm font-semibold text-white opacity-60">
          New inquiry
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" data-figma="10:74" aria-label="Key numbers">
        {KPIS.map((kpi) => (
          <div key={kpi.key} className={`${card} space-y-1.5 p-5`} data-testid="cc-kpi">
            <p className={mono}>
              {kpi.label}
              {kpi.key === "direct" ? (
                <>
                  {" · "}
                  <LocalDate month />
                </>
              ) : null}
            </p>
            <p className="text-[36px] font-semibold leading-tight tracking-[-0.02em]">{kpi.value() ?? EMPTY}</p>
            <p className="text-[13px] font-medium text-[#2f7d4f]">{kpi.detail() ?? EMPTY}</p>
            <p className="text-xs text-[#5e6684]">Source: {kpi.source}</p>
          </div>
        ))}
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <NeedsYou />

        <aside className="space-y-4" data-figma="10:168">
          <section className={`${card} space-y-3.5 p-5`}>
            <div className="flex items-start gap-1">
              <h2 className="text-base font-semibold">This month’s loop</h2>
              <span className={mono}>
                <LocalDate month />
              </span>
            </div>
            {LOOP_STAGES.map((stage) => (
              <div key={stage.key} className="space-y-1.5" data-testid="cc-loop">
                <div className="flex justify-between text-[13px]">
                  <span className="font-medium">{stage.label}</span>
                  <span className="font-semibold">{EMPTY}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#f3eadc]">
                  <div data-cc-bar className={stage.tone === "dark" ? "h-2 bg-[#0f1530]" : "h-2 bg-[#f6b400]"} style={{ width: "0%" }} />
                </div>
              </div>
            ))}
          </section>
          <section className={`${card} space-y-3 p-5`}>
            <h2 className="text-base font-semibold">Today’s crews</h2>
            <p className="text-[13px] text-[#5e6684]">
              {EMPTY} Live crew status isn’t available yet. <Link href="/dispatch" className="font-medium text-[#2b4acb]">Open dispatch</Link>
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
