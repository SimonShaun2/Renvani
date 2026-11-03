import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { resetEnvCacheForTests } from "@fsm/config";

import { setupTestEnv } from "../test-support/env-setup.js";

const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();

describe.runIf(Boolean(neonCiUrl?.startsWith("postgres")))("FS-229 inquiry idempotency (real PostgreSQL)", () => {
  const companyId = randomUUID();
  const slug = `fs229-race-${companyId.slice(0, 8)}`;
  let database: typeof import("@fsm/db");
  let submit: typeof import("./revenue-inquiry-intake.service.js")["submitPublicInquiryIntake"];

  beforeAll(async () => {
    setupTestEnv();
    vi.stubEnv("DATABASE_URL", neonCiUrl!);
    vi.stubEnv("DATABASE_POOL_MAX", "6");
    resetEnvCacheForTests();
    database = await import("@fsm/db");
    ({ submitPublicInquiryIntake: submit } = await import("./revenue-inquiry-intake.service.js"));
    await database.db.insert(database.companies).values({ id: companyId, name: "FS229 race fixture", slug });
    await database.db.insert(database.bookingSettings).values({
      companyId,
      bookingSlug: slug,
      isEnabled: true,
      offeredServices: []
    });
  }, 60_000);

  afterAll(async () => {
    if (!database) return;
    await database.runTransactionWithTenantSession(companyId, async (tx) => {
      await tx.delete(database.inquirySubmitIdempotency).where(eq(database.inquirySubmitIdempotency.companyId, companyId));
      await tx.delete(database.activityEvents).where(eq(database.activityEvents.companyId, companyId));
      await tx.delete(database.bookingRequests).where(eq(database.bookingRequests.companyId, companyId));
      await tx.delete(database.properties).where(eq(database.properties.companyId, companyId));
      await tx.delete(database.customers).where(eq(database.customers.companyId, companyId));
      await tx.delete(database.bookingSettings).where(eq(database.bookingSettings.companyId, companyId));
    });
    await database.db.delete(database.companies).where(eq(database.companies.id, companyId));
  }, 60_000);

  it("serializes concurrent same-key submissions into one committed inquiry and event sequence", async () => {
    const key = randomUUID();
    const body: Parameters<typeof submit>[1] = {
      firstName: "Jamie",
      lastName: "Stone",
      phone: "555-0200",
      email: "jamie@example.com",
      addressLine1: "500 Oak Ave",
      city: "Tulsa",
      state: "OK",
      zip: "74103",
      urgency: "this_week",
      preferredWindow: "afternoon",
      smsConsentAppointments: false,
      smsConsentMarketing: false
    };

    const responses = await Promise.all(Array.from({ length: 6 }, () => submit(slug, body, "direct", key)));
    expect(responses.filter((response) => response.created)).toHaveLength(1);
    expect(new Set(responses.map((response) => response.result.bookingRequest.id)).size).toBe(1);
    const effects = await database.runTransactionWithTenantSession(companyId, async (tx) => ({
      bookings: await tx.select().from(database.bookingRequests).where(eq(database.bookingRequests.companyId, companyId)),
      customers: await tx.select().from(database.customers).where(eq(database.customers.companyId, companyId)),
      properties: await tx.select().from(database.properties).where(eq(database.properties.companyId, companyId)),
      idempotency: await tx.select().from(database.inquirySubmitIdempotency).where(eq(database.inquirySubmitIdempotency.companyId, companyId)),
      events: await tx.select().from(database.activityEvents).where(eq(database.activityEvents.companyId, companyId)),
      jobs: await tx.select().from(database.jobs).where(eq(database.jobs.companyId, companyId))
    }));
    expect(effects.bookings).toHaveLength(1);
    expect(effects.customers).toHaveLength(1);
    expect(effects.properties).toHaveLength(1);
    expect(effects.idempotency).toHaveLength(1);
    expect(effects.events.filter((event) => event.eventType === "booking.requested")).toHaveLength(1);
    expect(effects.events.filter((event) => event.eventType === "revenue.inquiry_received")).toHaveLength(1);
    expect(effects.jobs).toHaveLength(0);
  }, 60_000);
});
