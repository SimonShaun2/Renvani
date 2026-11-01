import { z } from "zod";

/**
 * FS-57 Growth Check owner report: editable draft built on FS-56 reviewed findings, preview, export and
 * share snapshots. Trade-neutral (field/home services). Registries, not enums.
 *
 * Owner output never contains internal notes (draft internalNotes or finding review notes/reasons).
 * Export and share require approval of the draft's current version; approval is an audited revision.
 */

export const GROWTH_CHECK_REPORT_MAX_OPPORTUNITIES = 3;

export const GROWTH_CHECK_REPORT_EXPORT_FORMATS = ["markdown", "html", "text", "json"] as const;
export type GrowthCheckReportExportFormat = (typeof GROWTH_CHECK_REPORT_EXPORT_FORMATS)[number];

/** Evidence labels shown on each report item. Only an explicit owner confirmation makes a finding a fact. */
export const GROWTH_CHECK_REPORT_EVIDENCE_LABEL_REGISTRY: Readonly<Record<string, string>> = {
  owner_confirmed: "Confirmed by owner",
  observed: "Observed on public pages",
  needs_confirmation: "Needs confirmation"
};
export type GrowthCheckReportEvidenceLabel = "owner_confirmed" | "observed" | "needs_confirmation";

/** Draft revision actions (audit history). */
export const GROWTH_CHECK_REPORT_DRAFT_ACTION_REGISTRY: Readonly<Record<string, string>> = {
  create: "Draft created",
  edit: "Draft edited",
  approve: "Approved for export and sharing"
};

/**
 * Outside delivery channels for a finished report. Every entry is disabled: no adapter is wired, no keys,
 * no env reads. Adding a channel means adding an adapter behind an explicit enable decision.
 */
export interface GrowthCheckReportDeliveryChannelDefinition {
  key: string;
  label: string;
  enabled: false;
}
export const GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY: readonly GrowthCheckReportDeliveryChannelDefinition[] = [
  { key: "email", label: "Email the report", enabled: false },
  { key: "sms", label: "Text a report link", enabled: false }
];

const idempotencyKey = z.string().trim().min(8).max(128);
const expectedVersion = z.number().int().min(1).max(1_000_000);
const shortText = (max: number) => z.string().trim().min(1).max(max);
const score = z.number().int().min(1).max(3);

export const growthCheckReportOpportunityInputSchema = z
  .object({
    findingId: z.string().uuid(),
    headline: shortText(200),
    nextStep: shortText(500),
    impact: score,
    evidence: score,
    actionability: score
  })
  .strict();
export type GrowthCheckReportOpportunityInput = z.infer<typeof growthCheckReportOpportunityInputSchema>;

const opportunities = z
  .array(growthCheckReportOpportunityInputSchema)
  .max(GROWTH_CHECK_REPORT_MAX_OPPORTUNITIES)
  .superRefine((items, ctx) => {
    const ids = new Set<string>();
    items.forEach((item, index) => {
      if (ids.has(item.findingId)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate findingId", path: [index, "findingId"] });
      }
      ids.add(item.findingId);
    });
  });

export const growthCheckReportDraftCreateBodySchema = z
  .object({
    idempotencyKey,
    title: shortText(200).optional(),
    businessName: shortText(200).optional(),
    serviceArea: shortText(200).optional()
  })
  .strict();
export type GrowthCheckReportDraftCreateBody = z.infer<typeof growthCheckReportDraftCreateBodySchema>;

const editableFields = {
  title: shortText(200).optional(),
  businessName: shortText(200).nullable().optional(),
  serviceArea: shortText(200).nullable().optional(),
  intro: shortText(2000).nullable().optional(),
  internalNotes: shortText(4000).nullable().optional(),
  opportunities: opportunities.optional(),
  excludedFindingIds: z.array(z.string().uuid()).max(200).optional()
};

export const GROWTH_CHECK_REPORT_EDITABLE_FIELDS = Object.keys(editableFields) as Array<keyof typeof editableFields>;

export const growthCheckReportDraftEditBodySchema = z
  .object({ expectedVersion, idempotencyKey, ...editableFields })
  .strict()
  .superRefine((value, ctx) => {
    if (!GROWTH_CHECK_REPORT_EDITABLE_FIELDS.some((field) => value[field] !== undefined)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "edit requires at least one field", path: ["title"] });
    }
  });
export type GrowthCheckReportDraftEditBody = z.infer<typeof growthCheckReportDraftEditBodySchema>;

export const growthCheckReportDraftApproveBodySchema = z.object({ expectedVersion, idempotencyKey }).strict();
export type GrowthCheckReportDraftApproveBody = z.infer<typeof growthCheckReportDraftApproveBodySchema>;

export const growthCheckReportExportQuerySchema = z
  .object({ format: z.enum(GROWTH_CHECK_REPORT_EXPORT_FORMATS).default("markdown") })
  .strict();
export type GrowthCheckReportExportQuery = z.input<typeof growthCheckReportExportQuerySchema>;

export const growthCheckReportShareCreateBodySchema = z
  .object({ idempotencyKey, expectedVersion, expiresInDays: z.number().int().min(1).max(90).optional() })
  .strict();
export type GrowthCheckReportShareCreateBody = z.infer<typeof growthCheckReportShareCreateBodySchema>;

export const growthCheckReportShareRevokeBodySchema = z.object({}).strict();
export type GrowthCheckReportShareRevokeBody = z.infer<typeof growthCheckReportShareRevokeBodySchema>;

export const growthCheckReportDeliveryBodySchema = z.object({ channel: z.string().trim().min(1).max(32) }).strict();
export type GrowthCheckReportDeliveryBody = z.infer<typeof growthCheckReportDeliveryBodySchema>;

export interface GrowthCheckReportDraftContent {
  title: string;
  businessName: string | null;
  serviceArea: string | null;
  intro: string | null;
  /** Staff-only. Never rendered in preview, export or share snapshots. */
  internalNotes: string | null;
  opportunities: GrowthCheckReportOpportunityInput[];
  excludedFindingIds: string[];
}

export interface GrowthCheckReportDraft {
  id: string;
  scanId: string;
  version: number;
  content: GrowthCheckReportDraftContent;
  /** True when the current version is the approved version. */
  approved: boolean;
  approvedVersion: number | null;
  approvedByUserId: string | null;
  approvedAt: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthCheckReportDraftRevision {
  id: string;
  draftId: string;
  version: number;
  action: string;
  actorUserId: string | null;
  changedFields: string[];
  previous: GrowthCheckReportDraftContent | null;
  next: GrowthCheckReportDraftContent;
  createdAt: string;
}

export interface GrowthCheckReportDraftMutationResponse {
  draft: GrowthCheckReportDraft;
  revision: GrowthCheckReportDraftRevision;
  replayed: boolean;
}

export interface GrowthCheckReportDraftDetailResponse {
  draft: GrowthCheckReportDraft;
  history: GrowthCheckReportDraftRevision[];
}

export interface GrowthCheckReportItem {
  findingId: string;
  areaId: string;
  checkLabel: string;
  summary: string;
  evidenceLabel: GrowthCheckReportEvidenceLabel;
  sourceUrl: string;
}

export interface GrowthCheckReportOpportunity extends GrowthCheckReportItem {
  rank: number;
  headline: string;
  nextStep: string;
  score: { impact: number; evidence: number; actionability: number; total: number };
}

export interface GrowthCheckReportDocument {
  title: string;
  business: { name: string | null; serviceArea: string | null; website: string };
  intro: string | null;
  source: { scanId: string; rubricId: string; rubricVersion: string; scannedAt: string };
  whatsWorking: GrowthCheckReportItem[];
  opportunities: GrowthCheckReportOpportunity[];
  needsConfirmationCount: number;
  draftVersion: number;
}

export interface GrowthCheckReportPreviewResponse {
  draftId: string;
  version: number;
  approved: boolean;
  contentHash: string;
  report: GrowthCheckReportDocument;
  /** Fully escaped HTML fragment; safe to render. */
  html: string;
  text: string;
}

export type GrowthCheckReportShareStatus = "active" | "revoked" | "expired";

export interface GrowthCheckReportShare {
  id: string;
  draftId: string;
  draftVersion: number;
  contentHash: string;
  createdByUserId: string | null;
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  status: GrowthCheckReportShareStatus;
}

export interface GrowthCheckReportShareCreateResponse {
  share: GrowthCheckReportShare;
  /** Raw share token, returned once on creation only (stored hashed). Null on replay. */
  token: string | null;
  replayed: boolean;
}

export interface GrowthCheckReportShareListResponse {
  shares: GrowthCheckReportShare[];
}

export interface GrowthCheckReportShareRevokeResponse {
  share: GrowthCheckReportShare;
  alreadyRevoked: boolean;
}
