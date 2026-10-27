import { randomUUID } from "node:crypto";

import jwt from "jsonwebtoken";
import { z } from "zod";

import { env } from "@fsm/config";
import { AppError, ErrorCode } from "@fsm/types";

import {
  isBookingManageTokenConsumed
} from "./booking-manage-token-store.js";

/** Customer self-service link validity (reschedule/cancel). */
export const BOOKING_MANAGE_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const bookingManageTokenPayloadSchema = z.object({
  companyId: z.string().uuid(),
  bookingRequestId: z.string().uuid(),
  jobId: z.string().uuid(),
  bookingSlug: z.string().min(1),
  referenceNumber: z.string().min(8),
  jti: z.string().uuid(),
  tokenType: z.literal("booking_manage"),
  exp: z.number().int().positive()
});

export type BookingManageTokenPayload = z.infer<typeof bookingManageTokenPayloadSchema>;

export function generateBookingManageToken(
  payload: Omit<BookingManageTokenPayload, "tokenType" | "jti" | "exp">
): string {
  return jwt.sign(
    {
      ...payload,
      jti: randomUUID(),
      tokenType: "booking_manage"
    },
    env.BOOKING_HOLD_TOKEN_SECRET,
    { expiresIn: BOOKING_MANAGE_TOKEN_TTL_SECONDS }
  );
}

export function verifyBookingManageToken(token: string): BookingManageTokenPayload {
  try {
    const decoded = jwt.verify(token, env.BOOKING_HOLD_TOKEN_SECRET);
    return bookingManageTokenPayloadSchema.parse(decoded);
  } catch {
    throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid or expired booking manage token");
  }
}

export async function assertBookingManageTokenActive(claims: BookingManageTokenPayload): Promise<void> {
  if (await isBookingManageTokenConsumed(claims.jti)) {
    throw new AppError(ErrorCode.CONFLICT, "This manage link has already been used");
  }
}

export function isEligibleForCustomerSelfService(recurring: { linked: boolean }): boolean {
  return !recurring.linked;
}

export function issueBookingManageTokenIfEligible(
  input: {
    companyId: string;
    bookingRequestId: string;
    jobId: string;
    bookingSlug: string;
    referenceNumber: string;
  },
  recurring: { linked: boolean; scheduleKind?: "vip" | "maintenance" | "none" }
): string | null {
  if (!isEligibleForCustomerSelfService(recurring)) {
    return null;
  }

  return generateBookingManageToken({
    companyId: input.companyId,
    bookingRequestId: input.bookingRequestId,
    jobId: input.jobId,
    bookingSlug: input.bookingSlug,
    referenceNumber: input.referenceNumber
  });
}
