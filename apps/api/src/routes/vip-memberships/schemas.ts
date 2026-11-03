import { z } from "zod";

import {
  createVipMembershipTierSchema,
  updateVipMembershipTierSchema,
  vipMembershipCheckoutSchema,
  vipMembershipPolicySchema
} from "@fsm/types";

import { withZodValidation } from "../shared/validation.js";

export const tierIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const createTierValidation = withZodValidation({
  body: createVipMembershipTierSchema
});

export const updateTierValidation = withZodValidation({
  params: tierIdParamsSchema,
  body: updateVipMembershipTierSchema
});

export const deleteTierValidation = withZodValidation({
  params: tierIdParamsSchema
});

export const updatePolicyValidation = withZodValidation({
  body: vipMembershipPolicySchema
});

export const membershipIdParamsSchema = z.object({
  id: z.string().uuid()
});

export const checkoutValidation = withZodValidation({
  body: vipMembershipCheckoutSchema
});

export const pauseMembershipValidation = withZodValidation({
  params: membershipIdParamsSchema
});

export const cancelMembershipValidation = withZodValidation({
  params: membershipIdParamsSchema,
  body: z.object({
    cancelImmediately: z.boolean().optional()
  })
});

export const listTiersRouteSchema = {
  tags: ["vip-memberships"],
  summary: "List VIP membership tiers"
} as const;

export const createTierRouteSchema = {
  tags: ["vip-memberships"],
  summary: "Create VIP membership tier"
} as const;

export const updateTierRouteSchema = {
  tags: ["vip-memberships"],
  summary: "Update VIP membership tier"
} as const;

export const deleteTierRouteSchema = {
  tags: ["vip-memberships"],
  summary: "Archive VIP membership tier"
} as const;

export const getPolicyRouteSchema = {
  tags: ["vip-memberships"],
  summary: "Get VIP membership policy (pause + dunning defaults)"
} as const;

export const updatePolicyRouteSchema = {
  tags: ["vip-memberships"],
  summary: "Update VIP membership policy"
} as const;
