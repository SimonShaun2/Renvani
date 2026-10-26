import { z } from "zod";

export interface VipMembershipTier {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  monthlyPrice: string;
  discountPercent: string;
  includedVisitsPerMonth: number | null;
  stripeMonthlyPriceId: string | null;
  sortOrder: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export const vipMembershipPolicySchema = z.object({
  maxPauseMonths: z.number().int().min(1).max(24).optional(),
  pastDueGraceDays: z.number().int().min(1).max(90).optional()
});

export type VipMembershipPolicyInput = z.infer<typeof vipMembershipPolicySchema>;

export const createVipMembershipTierSchema = z.object({
  name: z.string().trim().min(1).max(255),
  description: z.string().trim().max(5000).optional(),
  monthlyPrice: z.string().trim().min(1),
  discountPercent: z.string().trim().min(1),
  includedVisitsPerMonth: z.number().int().min(0).max(99).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional()
});

export type CreateVipMembershipTierInput = z.infer<typeof createVipMembershipTierSchema>;

export const updateVipMembershipTierSchema = createVipMembershipTierSchema.partial();

export type UpdateVipMembershipTierInput = z.infer<typeof updateVipMembershipTierSchema>;

export const vipMembershipCheckoutSchema = z.object({
  customerId: z.string().uuid(),
  vipTierId: z.string().uuid()
});

export type VipMembershipCheckoutInput = z.infer<typeof vipMembershipCheckoutSchema>;
