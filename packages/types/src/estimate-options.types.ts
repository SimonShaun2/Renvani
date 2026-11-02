/**
 * FS-212 estimate good-better-best option sets + financing (disabled).
 * An option set is the estimate rows sharing a tier_group_id; each option is one estimate row.
 * Financing is a disabled-only provider registry: no keys, no env reads, no network, no fee math.
 */
import { z } from "zod";

import type { EstimateItem, EstimateStatus } from "./estimate.types.js";

export const ESTIMATE_OPTION_TIER_REGISTRY = {
  good: { label: "Good", rank: 1 },
  better: { label: "Better", rank: 2 },
  best: { label: "Best", rank: 3 }
} as const;
export type EstimateOptionTierId = keyof typeof ESTIMATE_OPTION_TIER_REGISTRY;

export const ESTIMATE_OPTION_SET_MIN_OPTIONS = 2;
export const ESTIMATE_OPTION_SET_MAX_OPTIONS = 3;
export const ESTIMATE_OPTION_CUSTOM_TIER_RANK = 99;

/** Registry rank for a tier label (case-insensitive); custom labels sort after the registry tiers. */
export function estimateOptionTierRank(label: string | null | undefined): number {
  const key = (label ?? "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ESTIMATE_OPTION_TIER_REGISTRY, key)
    ? ESTIMATE_OPTION_TIER_REGISTRY[key as EstimateOptionTierId].rank
    : ESTIMATE_OPTION_CUSTOM_TIER_RANK;
}

const idempotencyKeySchema = z.string().trim().min(8).max(128);
const expectedVersionSchema = z.number().int().min(1);
const tierLabelSchema = z.string().trim().min(1).max(50);

export const estimateOptionItemInputSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    description: z.string().trim().max(2000).optional(),
    itemType: z.enum(["service", "labor", "material", "fee"]).optional(),
    quantity: z.number().min(0.001).max(1_000_000),
    unitPrice: z.number().min(0).max(10_000_000),
    isTaxable: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(10_000).optional(),
    priceBookItemId: z.string().uuid().optional()
  })
  .strict();

export const estimateOptionInputSchema = z
  .object({
    tierLabel: tierLabelSchema,
    title: z.string().trim().min(1).max(255).optional(),
    recommended: z.boolean().optional(),
    items: z.array(estimateOptionItemInputSchema).min(1).max(100),
    taxRate: z.number().min(0).max(1).optional(),
    discountAmount: z.number().min(0).max(10_000_000).optional()
  })
  .strict();
export type EstimateOptionInput = z.infer<typeof estimateOptionInputSchema>;

function uniqueLabels(labels: string[]): boolean {
  const normalized = labels.map((label) => label.trim().toLowerCase());
  return new Set(normalized).size === normalized.length;
}

export const estimateOptionSetCreateBodySchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    customerId: z.string().uuid(),
    jobId: z.string().uuid().optional(),
    propertyId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    messageToCustomer: z.string().trim().max(5000).optional(),
    financingOffered: z.boolean().optional(),
    options: z.array(estimateOptionInputSchema).min(ESTIMATE_OPTION_SET_MIN_OPTIONS).max(ESTIMATE_OPTION_SET_MAX_OPTIONS)
  })
  .strict()
  .refine((body) => uniqueLabels(body.options.map((o) => o.tierLabel)), { message: "Option tier labels must be unique", path: ["options"] })
  .refine((body) => body.options.filter((o) => o.recommended).length <= 1, { message: "At most one option can be recommended", path: ["options"] });
export type EstimateOptionSetCreateBody = z.infer<typeof estimateOptionSetCreateBodySchema>;

export const estimateOptionSetUpdateBodySchema = z
  .object({
    idempotencyKey: idempotencyKeySchema,
    expectedVersion: expectedVersionSchema,
    title: z.string().trim().min(1).max(255).nullable().optional(),
    messageToCustomer: z.string().trim().max(5000).nullable().optional(),
    recommendedEstimateId: z.string().uuid().nullable().optional(),
    financingOffered: z.boolean().optional(),
    options: z
      .array(z.object({ estimateId: z.string().uuid(), tierLabel: tierLabelSchema }).strict())
      .min(1)
      .max(ESTIMATE_OPTION_SET_MAX_OPTIONS)
      .optional()
  })
  .strict()
  .refine(
    (body) =>
      body.title !== undefined ||
      body.messageToCustomer !== undefined ||
      body.recommendedEstimateId !== undefined ||
      body.financingOffered !== undefined ||
      body.options !== undefined,
    { message: "Provide at least one change" }
  )
  .refine((body) => !body.options || new Set(body.options.map((o) => o.estimateId)).size === body.options.length, {
    message: "Each option may appear once",
    path: ["options"]
  });
export type EstimateOptionSetUpdateBody = z.infer<typeof estimateOptionSetUpdateBodySchema>;

export const estimateOptionSetAddOptionBodySchema = z
  .object({ idempotencyKey: idempotencyKeySchema, expectedVersion: expectedVersionSchema, option: estimateOptionInputSchema })
  .strict();
export type EstimateOptionSetAddOptionBody = z.infer<typeof estimateOptionSetAddOptionBodySchema>;

/** Send body; DELETE option uses the same fields as query parameters. */
export const estimateOptionSetVersionedBodySchema = z
  .object({ idempotencyKey: idempotencyKeySchema, expectedVersion: expectedVersionSchema })
  .strict();
export const estimateOptionSetVersionedQuerySchema = z
  .object({ idempotencyKey: idempotencyKeySchema, expectedVersion: z.coerce.number().int().min(1) })
  .strict();
export type EstimateOptionSetVersionedBody = z.infer<typeof estimateOptionSetVersionedBodySchema>;

export interface EstimateOption {
  estimateId: string;
  estimateNumber: string;
  tierLabel: string | null;
  rank: number;
  recommended: boolean;
  title: string | null;
  status: EstimateStatus;
  isSelectedTier: boolean;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  total: string;
  items: EstimateItem[];
}

export type EstimateOptionSetStatus = EstimateStatus | "mixed";

// ── Financing (disabled-only registry, FS-204 style) ──
export const FINANCING_PROVIDER_REGISTRY = {
  disabled: { label: "Not configured", enabled: false }
} as const;
export type FinancingProviderId = keyof typeof FINANCING_PROVIDER_REGISTRY;
export const FINANCING_DISABLED_REASON = "financing_disabled" as const;

export interface FinancingQuote {
  provider: FinancingProviderId;
  termMonths: number;
  aprBps: number;
  monthlyPayment: string;
  totalCost: string;
  disclosure: string;
  expiresAt: string;
}

export interface EstimateFinancingSummary {
  offered: boolean;
  provider: FinancingProviderId;
  providerReady: boolean;
  monthlyFrom: string | null;
  reason?: typeof FINANCING_DISABLED_REASON;
}

export interface EstimateFinancingQuotesResponse {
  quotes: FinancingQuote[];
  provider: FinancingProviderId;
  providerReady: boolean;
  reason?: typeof FINANCING_DISABLED_REASON;
}

export interface EstimateOptionSet {
  tierGroupId: string;
  customerId: string;
  jobId: string | null;
  propertyId: string | null;
  title: string | null;
  messageToCustomer: string | null;
  status: EstimateOptionSetStatus;
  selectedEstimateId: string | null;
  recommendedEstimateId: string | null;
  financingOffered: boolean;
  financing: EstimateFinancingSummary;
  options: EstimateOption[];
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface EstimateOptionSetResponse {
  optionSet: EstimateOptionSet;
  replayed?: boolean;
}
