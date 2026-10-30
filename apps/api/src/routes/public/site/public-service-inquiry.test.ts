import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_INQUIRY_IP_LIMIT, PUBLIC_INQUIRY_SHOP_LIMIT } from "../../../lib/public-inquiry-rate-limit.js";
import { resetPublicBookingRateLimitStateForTests } from "../../../lib/public-booking-rate-limit.js";
import { setupTestEnv } from "../../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  notificationsQueue: { add: vi.fn(async () => undefined) },
  redisConnection: { del: vi.fn(async () => 0) }
}));

type BuildAppModule = typeof import("../../../app.js");
type FakeDbModule = typeof import("../../../test-support/fake-db.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let app: AppInstance;
let companyId: string;
let otherCompanyId: string;

const valid = {
  name: "  Dana   Smith ",
  phone: "(918) 555-0142",
  email: "Dana@Example.com",
  message: "AC blowing warm air",
  service: "AC repair",
  zip: "74103-1234"
};

function post(slug: string, payload: unknown, ip = "203.0.113.10") {
  return app.inject({
    method: "POST",
    url: `/api/v1/public/site/${slug}/inquiry`,
    remoteAddress: ip,
    headers: { "content-type": "application/json" },
    payload: JSON.stringify(payload)
  });
}

describe("POST /api/v1/public/site/:slug/inquiry", () => {
  beforeAll(async () => {
    buildAppModule = await import("../../../app.js");
    fakeDb = await import("../../../test-support/fake-db.js");
  });

  beforeEach(async () => {
    fakeDb.resetTestState();
    resetPublicBookingRateLimitStateForTests();
    const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac", timezone: "America/Chicago" });
    companyId = company.id;
    fakeDb.seedBookingSettings({ companyId, bookingSlug: "acme-hvac", isEnabled: true });
    fakeDb.seedServiceArea({ companyId, name: "Tulsa", zips: ["74103", "74104"] });
    fakeDb.seedServiceArea({ companyId, name: "Broken Arrow", zips: ["74012"] });
    fakeDb.seedServiceArea({ companyId, name: "Retired", zips: ["74999"], isActive: false });
    const other = fakeDb.seedCompany({ name: "Other Co", slug: "other-co", timezone: "America/New_York" });
    otherCompanyId = other.id;
    fakeDb.seedBookingSettings({ companyId: otherCompanyId, bookingSlug: "other-co", isEnabled: true });
    fakeDb.seedServiceArea({ companyId: otherCompanyId, name: "Elsewhere", zips: ["10001"] });
    app = await buildAppModule.buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("creates a tenant-scoped inquiry with lead source service_page and an allowlisted response", async () => {
    const response = await post("acme-hvac", valid);
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(Object.keys(body)).toEqual(["inquiry"]);
    expect(Object.keys(body.inquiry).sort()).toEqual(["referenceNumber", "status"]);
    expect(body.inquiry.status).toBe("received");

    const state = fakeDb.getTestState();
    expect(state.bookingRequests).toHaveLength(1);
    const row = state.bookingRequests[0]!;
    expect(row).toMatchObject({
      companyId,
      firstName: "Dana",
      lastName: "Smith",
      email: "dana@example.com",
      zip: "74103",
      source: "website",
      referenceNumber: body.inquiry.referenceNumber
    });
    expect(row.customerNotes).toBe("Service: AC repair\n\nAC blowing warm air");
    const customer = state.customers.find((c) => c.id === row.customerId)!;
    expect(customer).toMatchObject({ companyId, leadSource: "service_page" });
    const received = state.activityEvents.find((e) => e.eventType === "revenue.inquiry_received")!;
    expect(received.companyId).toBe(companyId);
    expect(received.payload).toMatchObject({ sourceAttribution: "service_page", channel: "web_form" });
    expect(state.bookingRequests.some((r) => r.companyId === otherCompanyId)).toBe(false);
  });

  it("does not overwrite an existing customer's lead source", async () => {
    fakeDb.seedCustomer({ companyId, firstName: "Dana", lastName: "Smith", phone: "9185550142", leadSource: "google" });
    expect((await post("acme-hvac", valid)).statusCode).toBe(201);
    const customers = fakeDb.getTestState().customers.filter((c) => c.companyId === companyId);
    expect(customers).toHaveLength(1);
    expect(customers[0]!.leadSource).toBe("google");
  });

  it.each([
    [{ name: "" }, "name", "Name is required"],
    [{ name: "x".repeat(201) }, "name", "Name must be at most 200 characters"],
    [{ phone: undefined }, "phone", "Phone is required"],
    [{ phone: "555-0142" }, "phone", "Enter a valid 10-digit US phone number"],
    [{ phone: "(118) 555-0142" }, "phone", "Enter a valid 10-digit US phone number"],
    [{ email: "not-an-email" }, "email", "Enter a valid email address"],
    [{ message: "m".repeat(2001) }, "message", "Message must be at most 2000 characters"],
    [{ service: "s".repeat(101) }, "service", "Service must be at most 100 characters"],
    [{ zip: undefined }, "zip", "ZIP code is required"],
    [{ zip: "7410" }, "zip", "Enter a 5-digit ZIP code"],
    [{ zip: "60601" }, "zip", "We don't currently serve this ZIP code"],
    [{ zip: "74999" }, "zip", "We don't currently serve this ZIP code"],
    [{ address: "1 Main St" }, "address", "Unknown field"],
    [{ name: 42 }, "name", "name must be a string"]
  ])("returns 400 with a per-field error for %j", async (patch, field, message) => {
    const response = await post("acme-hvac", { ...valid, ...patch });
    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.errors).toContainEqual({ field, message });
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(0);
  });

  it("lists every invalid field at once", async () => {
    const response = await post("acme-hvac", { name: "", phone: "1", zip: "abc" });
    expect(response.statusCode).toBe(400);
    expect(response.json().errors.map((e: { field: string }) => e.field)).toEqual(["name", "phone", "zip"]);
  });

  it("honeypot: returns a normal-looking success and creates nothing", async () => {
    const response = await post("acme-hvac", { ...valid, website: "http://spam.example" });
    expect(response.statusCode).toBe(201);
    expect(response.json().inquiry.status).toBe("received");
    expect(response.json().inquiry.referenceNumber).toMatch(/^BK-\d{8}-/u);
    const state = fakeDb.getTestState();
    expect(state.bookingRequests).toHaveLength(0);
    expect(state.customers).toHaveLength(0);
    expect(state.activityEvents.filter((e) => e.eventType === "revenue.inquiry_received")).toHaveLength(0);
  });

  it("returns 404 for an unknown or disabled shop", async () => {
    expect((await post("no-such-shop", valid)).statusCode).toBe(404);
    expect(fakeDb.getTestState().bookingRequests).toHaveLength(0);
  });

  it("zod: malformed slug -> 400 VALIDATION_ERROR with the standard shape", async () => {
    const res = await post("Bad%20Slug!", valid);
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(Object.keys(body).sort()).toEqual(["error", "errors", "message", "requestId"]);
    expect(body.error).toBe("VALIDATION_ERROR");
    expect(body.errors).toEqual([expect.objectContaining({ field: "slug" })]);
    expect((await post("-acme", valid)).statusCode).toBe(400);
  });

  it("zod: unknown keys and wrong types are rejected with 400 and nothing is created", async () => {
    const before = fakeDb.getTestState().customers.length;
    const res = await post("acme-hvac", { ...valid, companyId: "x", isAdmin: true });
    expect(res.statusCode).toBe(400);
    expect(res.json().errors).toEqual(
      expect.arrayContaining([
        { field: "companyId", message: "Unknown field" },
        { field: "isAdmin", message: "Unknown field" }
      ])
    );
    const typed = await post("acme-hvac", { ...valid, phone: 5125550100 });
    expect(typed.statusCode).toBe(400);
    expect(typed.json().errors).toEqual(expect.arrayContaining([{ field: "phone", message: "phone must be a string" }]));
    expect((await post("acme-hvac", ["not", "an", "object"])).statusCode).toBe(400);
    expect(fakeDb.getTestState().customers.length).toBe(before);
  });

  it("honeypot unchanged: decoy 201 even when the bot also sends unknown keys", async () => {
    const before = fakeDb.getTestState().customers.length;
    const res = await post("acme-hvac", { ...valid, website: "http://spam.example", extra: "x" });
    expect(res.statusCode).toBe(201);
    expect(res.json().inquiry.status).toBe("received");
    expect(fakeDb.getTestState().customers.length).toBe(before);
  });

  it("scopes the service-area check to the resolved shop", async () => {
    // 10001 is the other shop's area, not acme's.
    expect((await post("acme-hvac", { ...valid, zip: "10001" })).statusCode).toBe(400);
    const ok = await post("other-co", { ...valid, zip: "10001" });
    expect(ok.statusCode).toBe(201);
    expect(fakeDb.getTestState().bookingRequests[0]!.companyId).toBe(otherCompanyId);
  });

  it(`rate limits per IP (${PUBLIC_INQUIRY_IP_LIMIT}/10 min) with 429 + Retry-After`, async () => {
    for (let i = 0; i < PUBLIC_INQUIRY_IP_LIMIT; i += 1) {
      expect((await post("acme-hvac", { ...valid, zip: "bad" }, "198.51.100.7")).statusCode).toBe(400);
    }
    const limited = await post("acme-hvac", valid, "198.51.100.7");
    expect(limited.statusCode).toBe(429);
    expect(limited.json()).toMatchObject({ error: "RATE_LIMITED" });
    expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0);
    expect((await post("acme-hvac", valid, "198.51.100.8")).statusCode).toBe(201);
  });

  it(`rate limits per shop (${PUBLIC_INQUIRY_SHOP_LIMIT}/10 min) across IPs`, async () => {
    for (let i = 0; i < PUBLIC_INQUIRY_SHOP_LIMIT; i += 1) {
      await post("acme-hvac", { ...valid, zip: "bad" }, `192.0.2.${i + 1}`);
    }
    const limited = await post("acme-hvac", valid, "192.0.2.250");
    expect(limited.statusCode).toBe(429);
    expect(limited.headers["retry-after"]).toBeDefined();
    expect((await post("other-co", { ...valid, zip: "10001" }, "192.0.2.251")).statusCode).toBe(201);
  });

  it("exposes active service-area names and timezone on the public shop endpoint", async () => {
    const response = await app.inject({ method: "GET", url: "/api/v1/public/booking/acme-hvac" });
    expect(response.statusCode).toBe(200);
    const booking = response.json().booking;
    expect(booking.serviceAreaNames).toEqual(["Broken Arrow", "Tulsa"]);
    expect(booking.timezone).toBe("America/Chicago");
    expect(booking).toHaveProperty("availableHoursStart");
  });
});
