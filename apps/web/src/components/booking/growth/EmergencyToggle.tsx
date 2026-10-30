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
        <img alt="" width={44} height={24} className="h-[24px] w-[44px] shrink-0" src={on ? "/booking/toggle-on.svg" : "/booking/toggle-off.svg"} />
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
