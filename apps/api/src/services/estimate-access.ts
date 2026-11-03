import { and, eq, isNull } from "drizzle-orm";

import { db, users } from "@fsm/db";
import { AppError, ErrorCode, type UserRole } from "@fsm/types";

export interface EstimateStaffActor {
  companyId: string;
  userId: string;
  role: UserRole;
}

/** Reject a forbidden role before even opening a tenant query or transaction. */
export function assertEstimateOfficeRole(actor: EstimateStaffActor): void {
  if (actor.role !== "owner" && actor.role !== "admin" && actor.role !== "dispatcher") {
    throw new AppError(ErrorCode.FORBIDDEN, "You do not have access to this resource");
  }
}

/** Recheck the active DB role at the service boundary; a stale actor cannot authorize a write. */
export async function requireCurrentEstimateOfficeActor(
  actor: EstimateStaffActor,
  executor: Pick<typeof db, "select">
): Promise<void> {
  assertEstimateOfficeRole(actor);
  const [user] = await executor.select({ role: users.role, isActive: users.isActive }).from(users).where(and(
    eq(users.companyId, actor.companyId), eq(users.id, actor.userId), isNull(users.deletedAt)
  )).limit(1);
  if (!user?.isActive || user.role !== actor.role) {
    throw new AppError(ErrorCode.FORBIDDEN, "You do not have access to this resource");
  }
}
