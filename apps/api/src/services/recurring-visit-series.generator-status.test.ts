/** The FS-59 generator skips paused and ended (cancelled) series; active series still generate; tenants stay isolated. */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";
import { generateRecurringVisitOccurrences } from "./recurring-visit-series.service.js";

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

function seedSeries(companyId: string, customerId: string, status: string) {
  const row = {
    id: crypto.randomUUID(),
    companyId,
    customerId,
    propertyId: null,
    maintenancePlanId: null,
    anchorMaintenanceVisitId: null,
    timeZone: "America/Chicago",
    frequency: "quarterly",
    anchorLocalDate: "2030-01-15",
    localTime: "09:00",
    status,
    externalSchedulerAuthoritative: false,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null
  };
  fakeDb.getTestState().recurringVisitSeries.push(row as never);
  return row;
}

const occurrencesOf = (seriesId: string) => fakeDb.getTestState().recurringVisitOccurrences.filter((o) => o.seriesId === seriesId);

function world() {
  const a = fakeDb.seedCompany({ name: "Sparkle Home Cleaning", slug: "sparkle" });
  const b = fakeDb.seedCompany({ name: "Other Co", slug: "other" });
  const ca = fakeDb.seedCustomer({ companyId: a.id, firstName: "Ana", lastName: "Ruiz" });
  const cb = fakeDb.seedCustomer({ companyId: b.id, firstName: "Bo", lastName: "Li" });
  return { a, b, ca, cb };
}

describe("FS-59 generator respects series status", () => {
  it("skips a paused series", async () => {
    const w = world();
    const s = seedSeries(w.a.id, w.ca.id, "paused");
    await expect(generateRecurringVisitOccurrences(w.a.id, s.id, 4)).resolves.toEqual({ requested: 4, inserted: 0, totalActive: 0, skippedReason: "paused" });
    expect(occurrencesOf(s.id)).toHaveLength(0);
  });

  it("skips an ended (cancelled) series", async () => {
    const w = world();
    const s = seedSeries(w.a.id, w.ca.id, "cancelled");
    await expect(generateRecurringVisitOccurrences(w.a.id, s.id, 4)).resolves.toMatchObject({ inserted: 0, skippedReason: "cancelled" });
    expect(occurrencesOf(s.id)).toHaveLength(0);
  });

  it("fails safe: an unknown/future status is skipped as inactive", async () => {
    const w = world();
    const s = seedSeries(w.a.id, w.ca.id, "archived");
    await expect(generateRecurringVisitOccurrences(w.a.id, s.id, 3)).resolves.toEqual({ requested: 3, inserted: 0, totalActive: 0, skippedReason: "inactive" });
    expect(occurrencesOf(s.id)).toHaveLength(0);
  });

  it("still generates for an active series, and resumes after status returns to active", async () => {
    const w = world();
    const s = seedSeries(w.a.id, w.ca.id, "active");
    const res = await generateRecurringVisitOccurrences(w.a.id, s.id, 3);
    expect(res).toEqual({ requested: 3, inserted: 3, totalActive: 3 });
    expect(occurrencesOf(s.id).map((o) => o.scheduledLocalDate)).toEqual(["2030-01-15", "2030-04-15", "2030-07-15"]);

    const paused = seedSeries(w.a.id, w.ca.id, "paused");
    expect((await generateRecurringVisitOccurrences(w.a.id, paused.id, 2)).inserted).toBe(0);
    paused.status = "active";
    expect((await generateRecurringVisitOccurrences(w.a.id, paused.id, 2)).inserted).toBe(2);
  });

  it("a paused series in one tenant doesn't affect another tenant, and can't be generated cross-tenant", async () => {
    const w = world();
    const pausedA = seedSeries(w.a.id, w.ca.id, "paused");
    const activeB = seedSeries(w.b.id, w.cb.id, "active");
    expect((await generateRecurringVisitOccurrences(w.a.id, pausedA.id, 2)).inserted).toBe(0);
    expect((await generateRecurringVisitOccurrences(w.b.id, activeB.id, 2)).inserted).toBe(2);
    await expect(generateRecurringVisitOccurrences(w.a.id, activeB.id, 2)).rejects.toThrow(/not found/i);
    expect(occurrencesOf(activeB.id)).toHaveLength(2);
    expect(occurrencesOf(pausedA.id)).toHaveLength(0);
  });
});
