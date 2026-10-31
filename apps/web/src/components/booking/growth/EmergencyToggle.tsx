"use client";

import { EMERGENCY_COPY as C } from "./booking-growth.utils";

/** Figma 310:251 (off) / 310:275 (on). */
export function EmergencyToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <div className="flex w-full flex-col gap-[14px]">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        data-testid="emergency-toggle"
        onClick={() => onChange(!on)}
        className={`flex w-full items-center gap-[12px] rounded-[10px] border p-[14px] text-left ${
          on ? "border-[#b42318] bg-[#fbe3dc]" : "border-[#e6dccb] bg-white"
        }`}
      >
        {/* Inline switch (Figma 310:293 Toggle/On, 44x24, 18px knob): no /booking/* asset, which is auth-gated for logged-out customers. */}
        <svg aria-hidden="true" data-testid="emergency-toggle-switch" data-state={on ? "on" : "off"} width={44} height={24} viewBox="0 0 44 24" fill="none" className="h-[24px] w-[44px] shrink-0">
          <rect width="44" height="24" rx="12" fill={on ? "#F6B400" : "#D9D3C7"} />
          <circle cx={on ? 32 : 12} cy="12" r="9" fill="white" />
        </svg>
        <span className="min-w-0 flex-1 text-[14px] font-medium text-[#0f1530]">{C.label}</span>
      </button>
      <p className="text-[12px] text-[#5e6684]">{on ? C.helpOn : C.helpOff}</p>
    </div>
  );
}

/** Figma 310:309. */
export function EmergencyBadge() {
  return (
    <span data-testid="emergency-badge" className="shrink-0 rounded-[999px] bg-[#b42318] px-[10px] py-[4px] font-mono text-[11px] font-medium text-white">
      {C.badge}
    </span>
  );
}
