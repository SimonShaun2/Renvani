import { z } from "zod";

import type {
  GrowthCheckFindingConfidence,
  GrowthCheckRubricFindingStatus
} from "./types.js";

/**
 * FS-56 Growth Check findings review. The machine observation on growth_check_findings is never modified;
 * every staff/owner change is an append-only revision (who, when, old -> new). Registries, not enums.
 */

export interface GrowthCheckReviewActionDefinition {
  key: string;
  label: string;
  /** Only the account owner may record this action (owner validation answers). */
  ownerOnly: boolean;
}

export const GROWTH_CHECK_REVIEW_ACTION_REGISTRY: readonly GrowthCheckReviewActionDefinition[] = [
  { key: "edit", label: "Edit finding", ownerOnly: false },
  { key: "mark_not_applicable", label: "Mark not applicable", ownerOnly: false },
  { key: "add_note", label: "Add note", ownerOnly: false },
  { key: "request_owner_validation", label: "Request owner validation", ownerOnly: false },
  { key: "dismiss", label: "Dismiss", ownerOnly: false },
  { key: "owner_confirm", label: "Owner confirms", ownerOnly: true },
  { key: "owner_reject", label: "Owner rejects", ownerOnly: true },
  { key: "owner_cannot_answer", label: "Owner cannot answer", ownerOnly: true }
];

/** Review state labels (derived from the latest revision). */
export const GROWTH_CHECK_REVIEW_STATE_REGISTRY: Readonly<Record<string, string>> = {
  machine: "Machine observation (unreviewed)",
  edited: "Edited by staff",
  not_applicable: "Not applicable",
  dismissed: "Dismissed",
  noted: "Note added"
};

/** Owner validation labels. Only "confirmed" turns a hypothesis into an owner-confirmed fact. */
export const GROWTH_CHECK_OWNER_VALIDATION_REGISTRY: Readonly<Record<string, string>> = {
  not_requested: "Not requested",
  requested: "Owner validation requested",
  confirmed: "Owner confirmed",
  rejected: "Owner rejected",
  cannot_answer: "Owner cannot answer"
};

const findingStatus = z.enum(["pass", "fail", "warning", "unknown"]);
const reason = z.string().trim().min(3).max(1000);
const note = z.string().trim().min(1).max(2000);
const base = {
  expectedRevision: z.number().int().min(0).max(1_000_000),
  idempotencyKey: z.string().trim().min(8).max(128)
};

export const growthCheckFindingReviewBodySchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("edit"),
      ...base,
      reason,
      status: findingStatus.optional(),
      summary: z.string().trim().min(1).max(2000).optional()
    })
    .strict(),
  z.object({ action: z.literal("mark_not_applicable"), ...base, reason }).strict(),
  z.object({ action: z.literal("dismiss"), ...base, reason }).strict(),
  z.object({ action: z.literal("add_note"), ...base, note }).strict(),
  z.object({ action: z.literal("request_owner_validation"), ...base, note: note.optional() }).strict(),
  z.object({ action: z.literal("owner_confirm"), ...base, note: note.optional() }).strict(),
  z.object({ action: z.literal("owner_reject"), ...base, note: note.optional() }).strict(),
  z.object({ action: z.literal("owner_cannot_answer"), ...base, note: note.optional() }).strict()
]).superRefine((value, ctx) => {
  if (value.action === "edit" && value.status === undefined && value.summary === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "edit requires status or summary", path: ["summary"] });
  }
});

export type GrowthCheckFindingReviewBody = z.infer<typeof growthCheckFindingReviewBodySchema>;

export const growthCheckScanListQuerySchema = z
  .object({ limit: z.coerce.number().int().min(1).max(50).optional() })
  .strict();

/** Effective (reviewed) view of a finding. */
export interface GrowthCheckFindingReviewState {
  status: GrowthCheckRubricFindingStatus;
  summary: string;
  reviewState: string;
  ownerValidation: string;
  /** True only after an explicit owner confirmation; machine output is always a hypothesis. */
  ownerConfirmedFact: boolean;
  lastNote: string | null;
}

export interface GrowthCheckFindingView {
  id: string;
  scanId: string;
  areaId: string;
  checkId: string;
  checkLabel: string | null;
  sourceUrl: string;
  observedAt: string;
  machine: {
    status: GrowthCheckRubricFindingStatus;
    confidence: GrowthCheckFindingConfidence;
    summary: string;
  };
  current: GrowthCheckFindingReviewState;
  revision: number;
  updatedAt: string;
}

export interface GrowthCheckFindingRevision {
  id: string;
  findingId: string;
  revision: number;
  action: string;
  actorUserId: string | null;
  reason: string | null;
  note: string | null;
  previous: GrowthCheckFindingReviewState;
  next: GrowthCheckFindingReviewState;
  /** Field names whose value changed (old -> new). */
  changedFields: string[];
  createdAt: string;
}

export interface GrowthCheckFindingDetailResponse {
  finding: GrowthCheckFindingView;
  history: GrowthCheckFindingRevision[];
}

export interface GrowthCheckFindingReviewResponse {
  finding: GrowthCheckFindingView;
  revision: GrowthCheckFindingRevision;
  replayed: boolean;
}

export interface GrowthCheckScanFindingsResponse {
  scanId: string;
  rubricId: string;
  rubricVersion: string;
  findings: GrowthCheckFindingView[];
}

export interface GrowthCheckScanHistoryItem {
  id: string;
  targetUrl: string;
  rubricId: string;
  rubricVersion: string;
  status: string;
  createdAt: string;
  findingCount: number;
  reviewedFindingCount: number;
  revisionCount: number;
  ownerValidationRequested: number;
  ownerConfirmed: number;
  lastChangedAt: string | null;
}

export interface GrowthCheckScanHistoryResponse {
  scans: GrowthCheckScanHistoryItem[];
}
