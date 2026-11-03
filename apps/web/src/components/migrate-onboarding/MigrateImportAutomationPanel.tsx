import { Check } from "lucide-react";

import { automationProgress, type AutomationStep } from "./migrateStep2.config";

/** Right-hand "Import automation" card (Figma 12:141). Presentational; no client JS. */
export function MigrateImportAutomationPanel({ steps, running }: { steps: AutomationStep[]; running: boolean }) {
  const progress = automationProgress(steps);
  return (
    <aside aria-label="Import automation" className="flex flex-col gap-4 rounded-[14px] border border-[#e6dccb] bg-white p-5">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            running ? "bg-[#e5eafb] text-[#2b4acb]" : "bg-[#eef0f5] text-[#2a3360]"
          }`}
        >
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          {running ? "Running" : "Idle"}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.8px] text-[#5e6684]">Import automation</span>
      </div>
      <h3 className="text-base font-semibold text-[#0f1530]">Importing your data</h3>
      <ol className="flex flex-col gap-3">
        {steps.map((step) => (
          <li key={step.key} className="flex items-start gap-3" data-state={step.state}>
            <span
              aria-hidden
              className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${
                step.state === "done" ? "bg-[#2f7d4f] text-white" : step.state === "active" ? "bg-[#f6b400]" : "bg-[#f3eadc]"
              }`}
            >
              {step.state === "done" ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <span>
              <span className={`block text-sm font-semibold ${step.state === "waiting" ? "text-[#5e6684]" : "text-[#0f1530]"}`}>
                {step.title}
              </span>
              <span className="block text-xs text-[#5e6684]">{step.caption}</span>
            </span>
          </li>
        ))}
      </ol>
      <div
        role="progressbar"
        aria-label="Import progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[#f3eadc]"
      >
        <div className="migrate-progress-fill h-full rounded-full bg-[#f6b400]" style={{ width: `${progress * 100}%` }} />
      </div>
    </aside>
  );
}
