import { z } from "zod";

export const DispatchWeekQuerySchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    technician: z
      .union([z.literal("all"), z.literal("unassigned"), z.string().uuid()])
      .default("all"),
  })
  .strict();
export type DispatchWeekQuery = z.infer<typeof DispatchWeekQuerySchema>;
export const DispatchWeekJobSchema = z.object({
  id: z.string().uuid(),
  jobNumber: z.string(),
  title: z.string(),
  status: z.string(),
  scheduledStart: z.string().datetime(),
  scheduledEnd: z.string().datetime().nullable(),
  timingWarning: z.enum(["missing_end", "invalid_end"]).nullable(),
  technicianId: z.string().uuid().nullable(),
  technicianName: z.string().nullable(),
  assignmentState: z.enum([
    "assigned",
    "inactive",
    "unassigned",
    "unavailable",
  ]),
  customerName: z.string().nullable(),
  address: z.string().nullable(),
});
export type DispatchWeekJob = z.infer<typeof DispatchWeekJobSchema>;
export const DispatchWeekDaySchema = z.object({
  date: z.string(),
  start: z.string().datetime(),
  endExclusive: z.string().datetime(),
  jobIds: z.array(z.string().uuid()),
});
export const DispatchWeekResponseSchema = z.object({
  timezone: z.string(),
  today: z.string(),
  weekStart: z.string(),
  weekEnd: z.string(),
  previousWeek: z.string(),
  nextWeek: z.string(),
  rangeStart: z.string().datetime(),
  rangeEndExclusive: z.string().datetime(),
  generatedAt: z.string().datetime(),
  uniqueJobCount: z.number().int().nonnegative(),
  technicians: z.array(
    z.object({ id: z.string().uuid(), name: z.string(), status: z.string() }),
  ),
  days: z.array(DispatchWeekDaySchema).length(7),
  jobs: z.array(DispatchWeekJobSchema),
});
export type DispatchWeekResponse = z.infer<typeof DispatchWeekResponseSchema>;
