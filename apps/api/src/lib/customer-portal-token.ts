import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "@fsm/config";
import { AppError, ErrorCode } from "@fsm/types";

/** Magic-link validity for the customer portal. */
export const CUSTOMER_PORTAL_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const customerPortalTokenPayloadSchema = z.object({
  companyId: z.string().uuid(),
  customerId: z.string().uuid(),
  jti: z.string().uuid(),
  tokenType: z.literal("customer_portal"),
  exp: z.number().int().positive()
});

export type CustomerPortalTokenPayload = z.infer<typeof customerPortalTokenPayloadSchema>;

export function generateCustomerPortalToken(payload: { companyId: string; customerId: string }): {
  token: string;
  expiresAt: Date;
} {
  const token = jwt.sign(
    { companyId: payload.companyId, customerId: payload.customerId, jti: randomUUID(), tokenType: "customer_portal" },
    env.BOOKING_HOLD_TOKEN_SECRET,
    { expiresIn: CUSTOMER_PORTAL_TOKEN_TTL_SECONDS }
  );
  return { token, expiresAt: new Date(Date.now() + CUSTOMER_PORTAL_TOKEN_TTL_SECONDS * 1000) };
}

export function verifyCustomerPortalToken(token: string): CustomerPortalTokenPayload {
  try {
    const decoded = jwt.verify(token, env.BOOKING_HOLD_TOKEN_SECRET);
    return customerPortalTokenPayloadSchema.parse(decoded);
  } catch {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired portal link");
  }
}
