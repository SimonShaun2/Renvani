import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetBookingHoldTokenJtiStateForTests } from "../lib/booking-hold-token-store.js";
import { generateBookingHoldToken } from "../lib/booking-hold-token.js";
import { resetBookingManageTokenStoreForTests } from "../lib/booking-manage-token-store.js";
import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  notificationsQueue: {
    add: vi.fn(async () => undefined)
  },
  redisConnection: {
    del: vi.fn(async () => 0),
    set: vi.fn(async () => "OK"),
    get: vi.fn(async () => null)
  }
}));

type BookingServiceModule = typeof import("./booking.service.js");
type SelfServiceModule = typeof import("./booking-self-service.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let bookingService: BookingServiceModule;
let selfService: SelfServiceModule;
let fakeDb: FakeDbModule;

const BOOKING_DATE = "2027-02-10";

beforeAll(async () => {
  bookingService = await import("./booking.service.js");
  selfService = await import("./booking-self-service.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  resetBookingHoldTokenJtiStateForTests();
  resetBookingManageTokenStoreForTests();
});

async function confirmOneOffBooking(referenceNumber = "BK-SELF-001") {
  const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac" });
  fakeDb.seedBookingSettings({
    companyId: company.id,
    bookingSlug: "acme-hvac",
    isEnabled: true
  });
  const technician = fakeDb.seedTechnician({
    companyId: company.id,
    firstName: "Ava",
    lastName: "Stone",
    phone: "555-0200",
    serviceZipCodes: ["78701"]
  });
  const booking = fakeDb.seedBookingRequest({
    companyId: company.id,
    firstName: "Jamie",
    lastName: "Rivera",
    phone: "555-0101",
    addressLine1: "1 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    status: "pending",
    referenceNumber
  });
  const holdToken = generateBookingHoldToken({
    companyId: company.id,
    bookingRequestId: booking.id,
    referenceNumber: booking.referenceNumber ?? booking.id
  });
  const availability = await bookingService.getBookingAvailability("acme-hvac", "78701", BOOKING_DATE);
  const afternoon = availability.find((window) => window.window === "afternoon");

  expect(afternoon).toBeDefined();

  await bookingService.holdPublicBookingSlot("acme-hvac", booking.referenceNumber ?? "", {
    holdToken,
    technicianId: technician.id,
    scheduledStart: afternoon!.start,
    scheduledEnd: afternoon!.end
  });

  const confirmed = await bookingService.confirmPublicBookingSlot("acme-hvac", booking.referenceNumber ?? "", {
    technicianId: technician.id,
    scheduledStart: afternoon!.start,
    scheduledEnd: afternoon!.end
  });

  expect(confirmed.manageToken).toBeTruthy();

  return { technician, manageToken: confirmed.manageToken!, afternoon: afternoon! };
}

describe("booking-self-service.service (FS-153)", () => {
  it("returns self-service view for manage token", async () => {
    const { manageToken } = await confirmOneOffBooking();
    const view = await selfService.getBookingSelfServiceView(manageToken);

    expect(view.referenceNumber).toBe("BK-SELF-001");
    expect(view.canCancel).toBe(true);
  });

  it("cancel consumes manage token", async () => {
    const { manageToken } = await confirmOneOffBooking("BK-SELF-002");
    const result = await selfService.cancelBookingSelfService(manageToken);

    expect(result.status).toBe("cancelled");
    await expect(selfService.getBookingSelfServiceView(manageToken)).rejects.toMatchObject({
      code: "CONFLICT"
    });
  });

  it("reschedule after hold updates appointment", async () => {
    const { manageToken, technician } = await confirmOneOffBooking("BK-SELF-003");
    const availability = await bookingService.getBookingAvailability("acme-hvac", "78701", "2027-02-11");
    const nextSlot = availability.find((window) => window.window === "afternoon");

    expect(nextSlot).toBeDefined();

    await selfService.holdBookingSelfServiceSlot(manageToken, {
      technicianId: technician.id,
      scheduledStart: nextSlot!.start,
      scheduledEnd: nextSlot!.end
    });

    const result = await selfService.rescheduleBookingSelfService(manageToken, {
      technicianId: technician.id,
      scheduledStart: nextSlot!.start,
      scheduledEnd: nextSlot!.end
    });

    expect(result.status).toBe("confirmed");
    expect(result.scheduledStart).toBe(nextSlot!.start);
  });

  it("view expiresAt is the token's real exp, cutoff fixed at 24h", async () => {
    const { manageToken } = await confirmOneOffBooking("BK-SELF-004");
    const view = await selfService.getBookingSelfServiceView(manageToken);
    const payload = JSON.parse(Buffer.from(manageToken.split(".")[1]!, "base64url").toString()) as { exp: number };

    expect(view.expiresAt).toBe(new Date(payload.exp * 1000).toISOString());
    expect(view.cutoffHours).toBe(selfService.BOOKING_SELF_SERVICE_CUTOFF_HOURS);
    expect(selfService.BOOKING_SELF_SERVICE_CUTOFF_HOURS).toBe(24);
  });

  it("concurrent use of one manage link succeeds only once", async () => {
    const { manageToken } = await confirmOneOffBooking("BK-SELF-005");
    const results = await Promise.allSettled([
      selfService.cancelBookingSelfService(manageToken),
      selfService.cancelBookingSelfService(manageToken)
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "CONFLICT" });
  });
});
