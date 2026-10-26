import { and, eq, isNull } from "drizzle-orm";

import {
  bookingRequests,
  customers,
  db,
  emitEventWithExecutor,
  maintenancePlans,
  maintenanceVisits
} from "@fsm/db";

type BookingRequestRow = typeof bookingRequests.$inferSelect;
type RecurringScheduleJobContext = {
  id: string;
  scheduledStart: Date | null;
};
type TransactionExecutor = Pick<typeof db, "select" | "insert" | "update">;

type BookingActor = {
  id: string | null;
  type: "user" | "customer" | "system";
  name?: string;
};

export type RecurringScheduleLinkResult = {
  linked: boolean;
  scheduleKind: "vip" | "maintenance" | "none";
  maintenancePlanId: string | null;
  maintenanceVisitId: string | null;
};

function classifyRecurringBookingIntent(booking: BookingRequestRow): "vip" | "maintenance" | "none" {
  const haystack = [booking.serviceCategory, booking.serviceType, booking.serviceDetail]
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .join(" ")
    .toLowerCase();

  if (haystack.includes("vip")) {
    return "vip";
  }

  if (
    haystack.includes("recurring") ||
    haystack.includes("maintenance") ||
    haystack.includes("weekly") ||
    haystack.includes("biweekly") ||
    haystack.includes("monthly")
  ) {
    return "maintenance";
  }

  return "none";
}

function customerTagsSuggestRecurring(tags: string[] | null | undefined): boolean {
  const normalized = (tags ?? []).map((tag) => tag.trim().toLowerCase());
  return normalized.some((tag) => tag === "vip" || tag === "maintenance" || tag.includes("recurring"));
}

function formatDateOnlyFromJob(scheduledStart: Date | null): string | null {
  if (!scheduledStart) {
    return null;
  }

  return scheduledStart.toISOString().slice(0, 10);
}

export async function attachConfirmedBookingToRecurringSchedules(
  companyId: string,
  bookingRequest: BookingRequestRow,
  customerId: string,
  job: RecurringScheduleJobContext,
  executor: TransactionExecutor,
  actor: BookingActor
): Promise<RecurringScheduleLinkResult> {
  const intent = classifyRecurringBookingIntent(bookingRequest);

  const [customer] = await executor
    .select()
    .from(customers)
    .where(and(eq(customers.companyId, companyId), eq(customers.id, customerId), isNull(customers.deletedAt)))
    .limit(1);

  const tagDriven = customer ? customerTagsSuggestRecurring(customer.tags) : false;

  if (intent === "none" && !tagDriven) {
    return {
      linked: false,
      scheduleKind: "none",
      maintenancePlanId: null,
      maintenanceVisitId: null
    };
  }

  const activePlans = await executor
    .select()
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.companyId, companyId),
        eq(maintenancePlans.customerId, customerId),
        eq(maintenancePlans.status, "active"),
        isNull(maintenancePlans.deletedAt)
      )
    );

  const plan = activePlans[0] ?? null;

  if (!plan) {
    return {
      linked: false,
      scheduleKind: intent === "vip" ? "vip" : "maintenance",
      maintenancePlanId: null,
      maintenanceVisitId: null
    };
  }

  const scheduledDate = formatDateOnlyFromJob(job.scheduledStart);

  const insertedVisits = await executor
    .insert(maintenanceVisits)
    .values({
      companyId,
      maintenancePlanId: plan.id,
      jobId: job.id,
      scheduledDate,
      notes: `Linked from confirmed booking ${bookingRequest.referenceNumber ?? bookingRequest.id}`
    })
    .returning();
  const visit = insertedVisits[0];

  if (!visit) {
    return {
      linked: false,
      scheduleKind: intent === "vip" ? "vip" : "maintenance",
      maintenancePlanId: plan.id,
      maintenanceVisitId: null
    };
  }

  await executor
    .update(maintenancePlans)
    .set({
      lastServiceDate: scheduledDate,
      nextServiceDate: scheduledDate,
      updatedAt: new Date()
    })
    .where(and(eq(maintenancePlans.companyId, companyId), eq(maintenancePlans.id, plan.id)));

  await emitEventWithExecutor(executor, {
    companyId,
    eventType: "maintenance_plan.updated",
    actorId: actor.id ?? undefined,
    actorType: actor.type,
    actorName: actor.name,
    entityType: "maintenance_plan",
    entityId: plan.id,
    customerId,
    jobId: job.id,
    payload: {
      bookingRequestId: bookingRequest.id,
      maintenanceVisitId: visit.id,
      scheduleKind: intent === "vip" ? "vip" : "maintenance"
    },
    summary: `Maintenance visit scheduled from booking ${bookingRequest.referenceNumber ?? bookingRequest.id}`
  });

  return {
    linked: true,
    scheduleKind: intent === "vip" ? "vip" : "maintenance",
    maintenancePlanId: plan.id,
    maintenanceVisitId: visit.id
  };
}
