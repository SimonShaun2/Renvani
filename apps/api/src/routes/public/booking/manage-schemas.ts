import { z } from "zod";

import { withZodValidation } from "../../shared/validation.js";

const manageTokenSchema = z.string().trim().min(20).max(4096);
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

export const BookingManageTokenParamsSchema = z.object({
  token: manageTokenSchema
}).strict();

export const BookingManageAvailabilityQuerySchema = z.object({
  date: z.string().regex(isoDatePattern).refine(isValidIsoDate, "Invalid ISO date")
}).strict();

export const PublicBookingManageHoldBodySchema = z.object({
  technicianId: z.string().uuid(),
  scheduledStart: z.string().datetime({ offset: true }),
  scheduledEnd: z.string().datetime({ offset: true })
}).strict();

export const PublicBookingManageRescheduleBodySchema = PublicBookingManageHoldBodySchema;

export type BookingManageTokenParams = z.infer<typeof BookingManageTokenParamsSchema>;
export type BookingManageAvailabilityQuery = z.infer<typeof BookingManageAvailabilityQuerySchema>;

export const bookingManageTokenValidation = withZodValidation({
  params: BookingManageTokenParamsSchema
});

export const bookingManageAvailabilityValidation = withZodValidation({
  params: BookingManageTokenParamsSchema,
  query: BookingManageAvailabilityQuerySchema
});

export const bookingManageHoldValidation = withZodValidation({
  params: BookingManageTokenParamsSchema,
  body: PublicBookingManageHoldBodySchema
});

export const bookingManageRescheduleValidation = withZodValidation({
  params: BookingManageTokenParamsSchema,
  body: PublicBookingManageRescheduleBodySchema
});

export const bookingManageCancelValidation = withZodValidation({
  params: BookingManageTokenParamsSchema
});
