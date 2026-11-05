import { and, asc, eq, isNull } from "drizzle-orm";
import {
  companies,
  technicians,
  users,
  runTransactionWithTenantSession,
} from "@fsm/db";
import {
  AppError,
  ErrorCode,
  DispatchWeekQuerySchema,
  DispatchWeekJobSchema,
  DispatchWeekResponseSchema,
  type DispatchWeekQuery,
  type DispatchWeekResponse,
  type UserRole,
} from "@fsm/types";
import {
  buildDispatchWeekCalendar,
  weekJobOverlaps,
} from "./dispatch-week.calendar.js";
import {
  buildDispatchWeekJobsQuery,
  MAX_DISPATCH_WEEK_JOBS,
} from "./dispatch-week.query.js";

export interface DispatchWeekActor {
  companyId: string;
  userId: string;
  role: UserRole;
}
export const DISPATCH_WEEK_ROLES: readonly UserRole[] = [
  "owner",
  "admin",
  "dispatcher",
  "office",
];
export async function getDispatchWeek(
  actor: DispatchWeekActor,
  input: DispatchWeekQuery,
): Promise<DispatchWeekResponse> {
  if (!DISPATCH_WEEK_ROLES.includes(actor.role))
    throw new AppError(
      ErrorCode.FORBIDDEN,
      "You do not have access to the weekly schedule",
    );
  const query = DispatchWeekQuerySchema.parse(input);
  return runTransactionWithTenantSession(actor.companyId, async (tx) => {
    const [user] = await tx
      .select({ role: users.role, isActive: users.isActive })
      .from(users)
      .where(
        and(
          eq(users.id, actor.userId),
          eq(users.companyId, actor.companyId),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);
    if (!user?.isActive || user.role !== actor.role)
      throw new AppError(
        ErrorCode.FORBIDDEN,
        "You do not have access to the weekly schedule",
      );
    const [company] = await tx
      .select({ timezone: companies.timezone })
      .from(companies)
      .where(
        and(eq(companies.id, actor.companyId), isNull(companies.deletedAt)),
      )
      .limit(1);
    if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
    const calendar = buildDispatchWeekCalendar(company.timezone, query.date);
    const crew = await tx
      .select({
        id: technicians.id,
        firstName: technicians.firstName,
        lastName: technicians.lastName,
        status: technicians.status,
      })
      .from(technicians)
      .where(
        and(
          eq(technicians.companyId, actor.companyId),
          isNull(technicians.deletedAt),
        ),
      )
      .orderBy(
        asc(technicians.firstName),
        asc(technicians.lastName),
        asc(technicians.id),
      );
    if (
      query.technician !== "all" &&
      query.technician !== "unassigned" &&
      !crew.some((t) => t.id === query.technician)
    )
      throw new AppError(
        ErrorCode.NOT_FOUND,
        "Technician unavailable in this workspace",
      );
    const rows = await tx.execute<{ payload: unknown }>(
      buildDispatchWeekJobsQuery(
        actor.companyId,
        calendar.rangeStart,
        calendar.rangeEndExclusive,
        query.technician,
      ),
    );
    if (rows.length > MAX_DISPATCH_WEEK_JOBS)
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        "This week has too many jobs to display together. Select a technician to narrow the schedule.",
      );
    const jobs = rows.map((row) => DispatchWeekJobSchema.parse(row.payload));
    const days = calendar.days.map((day) => ({
      ...day,
      jobIds: jobs
        .filter((job) => weekJobOverlaps(job, day.start, day.endExclusive))
        .map((job) => job.id),
    }));
    return DispatchWeekResponseSchema.parse({
      ...calendar,
      days,
      jobs,
      uniqueJobCount: jobs.length,
      generatedAt: new Date().toISOString(),
      technicians: crew.map((t) => ({
        id: t.id,
        name: `${t.firstName} ${t.lastName}`.trim(),
        status: t.status,
      })),
    });
  });
}
