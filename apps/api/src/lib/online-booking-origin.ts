import { and, eq, isNull } from "drizzle-orm";

import { bookingRequests, db } from "@fsm/db";

type SelectExecutor = Pick<typeof db, "select">;

/**
 * Online-booking origin for the $1.99 booking fee. Derived ONLY from persisted server state:
 * a tenant-scoped booking_requests row linked to the invoice's job (set when a public booking
 * is confirmed into a job). Job tags are user-editable and are deliberately NOT consulted, and
 * no request body/query/client field can influence the result.
 */
export async function isJobFromOnlineBooking(
  companyId: string,
  jobId: string | null | undefined,
  executor: SelectExecutor = db
): Promise<boolean> {
  if (!jobId) {
    return false;
  }
  const [row] = await executor
    .select({ id: bookingRequests.id, companyId: bookingRequests.companyId })
    .from(bookingRequests)
    .where(
      and(
        eq(bookingRequests.companyId, companyId),
        eq(bookingRequests.jobId, jobId),
        isNull(bookingRequests.deletedAt)
      )
    )
    .limit(1);
  return Boolean(row && row.companyId === companyId);
}
