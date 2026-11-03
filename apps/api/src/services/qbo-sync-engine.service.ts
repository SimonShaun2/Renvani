import { and, eq, isNull } from "drizzle-orm";

import { customers, db } from "@fsm/db";
import { enqueueQboSyncPullJob, enqueueQboSyncPushJob } from "@fsm/jobs";

export async function enqueueQboFullSync(companyId: string, actorId?: string): Promise<void> {
  const pullKey = `full-${Date.now()}`;
  await enqueueQboSyncPullJob({
    companyId,
    idempotencyKey: pullKey,
    actorId
  });

  const customerRows = await db
    .select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.companyId, companyId), isNull(customers.deletedAt)))
    .limit(25);

  for (const customer of customerRows) {
    await enqueueQboSyncPushJob({
      companyId,
      entityType: "customer",
      entityId: customer.id,
      idempotencyKey: `customer:${customer.id}`,
      actorId
    });
  }
}
