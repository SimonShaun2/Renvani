import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@fsm/db";

import { setupTestEnv } from "../test-support/env-setup.js";
import { attachConfirmedBookingToRecurringSchedules } from "./booking-recurring-schedule.service.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

type FakeDbModule = typeof import("../test-support/fake-db.js");

let fakeDb: FakeDbModule;

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
});

describe("attachConfirmedBookingToRecurringSchedules", () => {
  it("returns none when booking text and customer tags do not suggest recurring", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Sam",
      lastName: "Lee",
      tags: []
    });
    const booking = fakeDb.seedBookingRequest({
      companyId: company.id,
      customerId: customer.id,
      firstName: "Sam",
      lastName: "Lee",
      phone: "555-0100",
      addressLine1: "1 Main",
      city: "Austin",
      state: "TX",
      zip: "78701",
      serviceType: "repair"
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      scheduledStart: new Date("2026-05-12T13:00:00.000Z"),
      scheduledEnd: new Date("2026-05-12T15:00:00.000Z")
    });

    const result = await attachConfirmedBookingToRecurringSchedules(
      company.id,
      booking,
      customer.id,
      job,
      db,
      { id: null, type: "customer", name: "Sam Lee" }
    );

    expect(result).toMatchObject({
      linked: false,
      scheduleKind: "none",
      maintenancePlanId: null,
      maintenanceVisitId: null
    });
  });

  it("creates a maintenance visit when an active plan exists and booking mentions maintenance", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Sam",
      lastName: "Lee",
      tags: []
    });
    const plan = fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      status: "active"
    });
    const booking = fakeDb.seedBookingRequest({
      companyId: company.id,
      customerId: customer.id,
      firstName: "Sam",
      lastName: "Lee",
      phone: "555-0100",
      addressLine1: "1 Main",
      city: "Austin",
      state: "TX",
      zip: "78701",
      serviceType: "monthly maintenance"
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      scheduledStart: new Date("2026-05-12T13:00:00.000Z"),
      scheduledEnd: new Date("2026-05-12T15:00:00.000Z")
    });

    const result = await attachConfirmedBookingToRecurringSchedules(
      company.id,
      booking,
      customer.id,
      job,
      db,
      { id: null, type: "customer", name: "Sam Lee" }
    );

    expect(result.linked).toBe(true);
    expect(result.maintenancePlanId).toBe(plan.id);
    expect(result.maintenanceVisitId).not.toBeNull();

    const visits = fakeDb.getTestState().maintenanceVisits;
    expect(visits).toHaveLength(1);
    expect(visits[0]?.jobId).toBe(job.id);

    const events = fakeDb.getTestState().activityEvents.filter(
      (event) => event.eventType === "maintenance_plan.updated"
    );
    expect(events).toHaveLength(1);
  });

  it("classifies VIP intent from booking service fields", async () => {
    const company = fakeDb.seedCompany({ name: "Acme", slug: "acme" });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Sam",
      lastName: "Lee",
      tags: ["vip"]
    });
    const booking = fakeDb.seedBookingRequest({
      companyId: company.id,
      customerId: customer.id,
      firstName: "Sam",
      lastName: "Lee",
      phone: "555-0100",
      addressLine1: "1 Main",
      city: "Austin",
      state: "TX",
      zip: "78701",
      serviceDetail: "VIP priority tune-up"
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      scheduledStart: new Date("2026-05-12T13:00:00.000Z"),
      scheduledEnd: new Date("2026-05-12T15:00:00.000Z")
    });

    const result = await attachConfirmedBookingToRecurringSchedules(
      company.id,
      booking,
      customer.id,
      job,
      db,
      { id: null, type: "customer", name: "Sam Lee" }
    );

    expect(result.scheduleKind).toBe("vip");
    expect(result.linked).toBe(false);
  });
});
