import Link from "next/link";

import { BriefKpis, BriefRail, DailyBriefCard } from "./DailyBriefCard";
import { DirectDemandCard } from "./DirectDemandCard";
import { LocalDate, LocalGreeting } from "./LocalClock";
import { HeaderSummary, NeedsYou } from "./NeedsYou";
import "./command-center-motion.css";

export interface CommandCenterViewProps {
  firstName: string | null;
}

/** Server-rendered shell for Figma 10:2. NeedsYou/HeaderSummary hydrate the inbox; DailyBriefCard/BriefKpis/BriefRail hydrate GET /command-center/brief (FS-29). */
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

      <DailyBriefCard />

      <BriefKpis />

      <DirectDemandCard />

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
        <NeedsYou />

        <aside className="space-y-4" data-figma="10:168">
          <BriefRail />
        </aside>
      </div>
    </div>
  );
}
