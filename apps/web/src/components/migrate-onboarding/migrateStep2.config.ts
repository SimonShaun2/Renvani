import type { ColumnMapping, WizardImportEntityType } from "@fsm/types";

/* Figma 12:4 "Operator / 14 Import data". Tags, states and automation steps are config so new ones are one entry. */

/** Drop zone format tags (12:83, 12:85, 12:87, 12:89). */
export const FORMAT_TAGS = [
  "CSV",
  "QuickBooks export (.IIF / .QBO / .xlsx)",
  "Excel / Google Sheets",
  "Export from your current software"
] as const;

/** File types the imports API accepts today. */
export const ACCEPTED_FILE_TYPES = ".csv,.xlsx,.xls";

export const ENTITY_OPTIONS: Array<{ value: WizardImportEntityType; label: string }> = [
  { value: "customers", label: "Customers" },
  { value: "properties", label: "Properties / locations" },
  { value: "jobs", label: "Jobs" }
];

export function entityLabel(entity: string): string {
  return ENTITY_OPTIONS.find((o) => o.value === entity)?.label ?? entity.replace(/_/g, " ");
}

export type ChipTone = "neutral" | "blue" | "green" | "red";

export const CHIP_TONE_CLASS: Record<ChipTone, string> = {
  neutral: "bg-[#eef0f5] text-[#2a3360]",
  blue: "bg-[#e5eafb] text-[#2b4acb]",
  green: "bg-[#e4f1e8] text-[#2f7d4f]",
  red: "bg-[#fbe3dc] text-[#a3261a]"
};

/** Import session status → frame state chip (12:95 Mapped, 12:101 Cleaning, 12:104 Deduping). */
const SESSION_STATES: Record<string, { label: string; tone: ChipTone }> = {
  uploaded: { label: "Detecting", tone: "blue" },
  mapping: { label: "Mapped", tone: "green" },
  preview: { label: "Preview", tone: "blue" },
  importing: { label: "Importing", tone: "blue" },
  completed: { label: "Imported", tone: "green" },
  failed: { label: "Failed", tone: "red" },
  rolled_back: { label: "Rolled back", tone: "neutral" }
};

export function sessionStateChip(status: string): { label: string; tone: ChipTone } {
  return SESSION_STATES[status] ?? { label: status, tone: "neutral" };
}

export function formatRows(rows: number | null | undefined): string {
  return typeof rows === "number" ? rows.toLocaleString("en-US") : "—";
}

export type AutomationState = "done" | "active" | "waiting";

export interface AutomationStep {
  key: string;
  title: string;
  caption: string;
  state: AutomationState;
}

export interface AutomationInput {
  files: Array<{ status: string; mappings: ColumnMapping }>;
  isUploading: boolean;
}

/**
 * Right panel (12:141). Only "Detect file types" and "Map fields" have live data in step 2;
 * cleaning, dedupe, import and review run in steps 3–5, so they show "Waiting".
 */
export function deriveAutomationSteps({ files, isUploading }: AutomationInput): AutomationStep[] {
  const detecting = isUploading || files.some((f) => f.status === "uploaded");
  const columns = files.flatMap((f) => Object.values(f.mappings));
  const mapped = columns.filter((v) => v !== null && v !== "").length;
  const hasFiles = files.length > 0;
  return [
    {
      key: "detect",
      title: "Detect file types",
      caption: hasFiles ? `${files.length} ${files.length === 1 ? "file" : "files"}` : "Waiting for files",
      state: !hasFiles ? (isUploading ? "active" : "waiting") : detecting ? "active" : "done"
    },
    {
      key: "map",
      title: "Map fields",
      caption: columns.length > 0 ? `${mapped} of ${columns.length} columns mapped` : "Waiting",
      state: !hasFiles || columns.length === 0 ? (detecting ? "active" : "waiting") : mapped === columns.length ? "done" : "active"
    },
    { key: "clean", title: "Clean data", caption: "Waiting", state: "waiting" },
    { key: "dedupe", title: "Find duplicates", caption: "Waiting", state: "waiting" },
    { key: "import", title: "Import records", caption: "Waiting", state: "waiting" },
    { key: "review", title: "Review summary", caption: "Only flagged rows need you", state: "waiting" }
  ];
}

export function automationProgress(steps: AutomationStep[]): number {
  return steps.length === 0 ? 0 : steps.filter((s) => s.state === "done").length / steps.length;
}
