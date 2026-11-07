import type { MobileReportIssueBody } from "@fsm/types";

export const ISSUE_LABELS = {
  access: "Access",
  customer_not_home: "Customer not home",
  safety: "Safety",
  parts_needed: "Parts needed",
  equipment: "Equipment",
  scope_change: "Scope change",
  other: "Other"
} as const satisfies Record<MobileReportIssueBody["category"], string>;

export type IssueCategory = keyof typeof ISSUE_LABELS;
export type IssueSeverity = MobileReportIssueBody["severity"];
export const ISSUE_SEVERITIES = ["low", "medium", "high"] as const satisfies readonly IssueSeverity[];
export const ISSUE_DESCRIPTION_LIMIT = 5000;

/** Presentation validation only; the existing API remains authoritative. */
export function buildIssueSubmission(input: {
  category: IssueCategory | null;
  severity: IssueSeverity;
  description: string;
  recordVersion: string | null | undefined;
}): MobileReportIssueBody | null {
  const description = input.description.trim();
  if (!input.category || !Object.hasOwn(ISSUE_LABELS, input.category) ||
      !ISSUE_SEVERITIES.includes(input.severity) || !description ||
      description.length > ISSUE_DESCRIPTION_LIMIT || !input.recordVersion?.trim()) return null;
  return {
    category: input.category,
    severity: input.severity,
    description,
    recordVersion: input.recordVersion
  };
}
