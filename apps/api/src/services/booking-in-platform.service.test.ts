import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { resetBookingHoldTokenJtiStateForTests } from "../lib/booking-hold-token-store.js";
import { generateBookingHoldToken } from "../lib/booking-hold-token.js";
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

const redisDelMock = vi.hoisted(() => vi.fn(async () => 0));

vi.mock("@fsm/jobs", () => ({
  notificationsQueue: {
    add: vi.fn(async () => undefined)
  },
  redisConnection: {
    del: redisDelMock
  }
}));

type BookingServiceModule = typeof import("./booking.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let bookingService: BookingServiceModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  bookingService = await import("./booking.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  resetBookingHoldTokenJtiStateForTests();
});

const SLOT_START = "2026-05-12T13:00:00.000Z";
const SLOT_END = "2026-05-12T15:00:00.000Z";

function seedPendingBooking(companyId: string) {
  return fakeDb.seedBookingRequest({
    companyId,
    firstName: "Jamie",
    lastName: "Rivera",
    phone: "555-0101",
    addressLine1: "1 Main St",
    city: "Austin",
    state: "TX",
    zip: "78701",
    status: "pending",
    referenceNumber: "BK-TEST-001"
  });
}

describe("booking in-platform slot hold and confirm (FS-21)", () => {
  it("holdBookingSlotForOperator keeps booking pending and reserves an unconfirmed schedule slot", async () => {
    const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac" });
    fakeDb.seedBookingSettings({ companyId: company.id, bookingSlug: "acme-hvac", isEnabled: true });
    const actor = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      firstName: "Ava",
      lastName: "Stone",
      role: "owner"
    });
    const technician = fakeDb.seedTechnician({
      companyId: company.id,
      userId: actor.id,
      firstName: "Ava",
      lastName: "Stone",
      phone: "555-0102"
    });
    const booking = seedPendingBooking(company.id);

    const result = await bookingService.holdBookingSlotForOperator(company.id, actor.id, booking.id, {
      technicianId: technician.id,
      scheduledStart: SLOT_START,
      scheduledEnd: SLOT_END
    });

    expect(result.bookingRequest.status).toBe("pending");
    expect(result.bookingRequest.assignedTechnicianId).toBe(technician.id);
    expect(result.hold.scheduledStart).toBe(SLOT_START);

    const holds = fakeDb.getTestState().scheduleSlots.filter((slot) => slot.notes?.startsWith("booking_hold:"));
    expect(holds).toHaveLength(1);
    expect(holds[0]?.isConfirmed).toBe(false);
    expect(holds[0]?.jobId).toBeNull();
  });

  it("confirmBookingRequest emits booking.confirmed without skipping non-terminal guard", async () => {
    const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac" });
    const actor = fakeDb.seedUser({
      companyId: company.id,
      email: "dispatcher@example.com",
      firstName: "Dee",
      lastName: "Patch",
      role: "dispatcher"
    });
    const technician = fakeDb.seedTechnician({
      companyId: company.id,
      userId: actor.id,
      firstName: "Dee",
      lastName: "Patch",
      phone: "555-0103"
    });
    const booking = seedPendingBooking(company.id);

    const confirmed = await bookingService.confirmBookingRequest(company.id, actor.id, booking.id, {
      technicianId: technician.id,
      scheduledStart: SLOT_START,
      scheduledEnd: SLOT_END
    });

    expect(confirmed.status).toBe("confirmed");

    const events = fakeDb.getTestState().activityEvents.filter((event) => event.eventType === "booking.confirmed");
    expect(events).toHaveLength(1);
  });

  it("rejects slot hold when booking request is already confirmed", async () => {
    const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac" });
    const actor = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      firstName: "Own",
      lastName: "Er",
      role: "owner"
    });
    const technician = fakeDb.seedTechnician({
      companyId: company.id,
      userId: actor.id,
      firstName: "Own",
      lastName: "Er",
      phone: "555-0104"
    });
    const booking = fakeDb.seedBookingRequest({
      companyId: company.id,
      firstName: "Pat",
      lastName: "Lee",
      phone: "555-0199",
      addressLine1: "9 Oak St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      status: "confirmed"
    });

    await expect(
      bookingService.holdBookingSlotForOperator(company.id, actor.id, booking.id, {
        technicianId: technician.id,
        scheduledStart: SLOT_START,
        scheduledEnd: SLOT_END
      })
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it("rejects slot hold when technician schedule conflicts", async () => {
    const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac" });
    const actor = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@example.com",
      firstName: "Own",
      lastName: "Er",
      role: "owner"
    });
    const technician = fakeDb.seedTechnician({
      companyId: company.id,
      userId: actor.id,
      firstName: "Own",
      lastName: "Er",
      phone: "555-0105"
    });
    const booking = seedPendingBooking(company.id);

    fakeDb.seedScheduleSlot({
      companyId: company.id,
      technicianId: technician.id,
      startTime: new Date(SLOT_START),
      endTime: new Date(SLOT_END),
      isConfirmed: true
    });

    await expect(
      bookingService.holdBookingSlotForOperator(company.id, actor.id, booking.id, {
        technicianId: technician.id,
        scheduledStart: SLOT_START,
        scheduledEnd: SLOT_END
      })
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });
});

function seedPublicBookingFixture(referenceNumber = "BK-TEST-PUBLIC-001") {
  const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: "acme-hvac" });
  fakeDb.seedBookingSettings({ companyId: company.id, bookingSlug: "acme-hvac", isEnabled: true });
  const actor = fakeDb.seedUser({
    companyId: company.id,
    email: "tech@example.com",
    firstName: "Tess",
    lastName: "Tech",
    role: "technician"
  });
  const technician = fakeDb.seedTechnician({
    companyId: company.id,
    userId: actor.id,
    firstName: "Tess",
    lastName: "Tech",
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

  return { company, technician, booking };
}

describe("public booking slot hold security (FS-21)", () => {
  it("holdPublicBookingSlot requires a valid hold token and published availability window", async () => {
    const { company, technician, booking } = seedPublicBookingFixture();
    const holdToken = generateBookingHoldToken({
      companyId: company.id,
      bookingRequestId: booking.id,
      referenceNumber: booking.referenceNumber ?? booking.id
    });
    const availability = await bookingService.getBookingAvailability("acme-hvac", "78701", "2026-05-12");
    const afternoon = availability.find((window) => window.window === "afternoon");

    expect(afternoon).toBeDefined();

    const result = await bookingService.holdPublicBookingSlot("acme-hvac", booking.referenceNumber ?? "", {
      holdToken,
      technicianId: technician.id,
      scheduledStart: afternoon!.start,
      scheduledEnd: afternoon!.end
    });

    expect(result.bookingRequest.status).toBe("pending");
    expect(result.bookingRequest.assignedTechnicianId).toBe(technician.id);
  });

  it("rejects public hold when hold token does not match reference", async () => {
    const { company, technician, booking } = seedPublicBookingFixture();
    const holdToken = generateBookingHoldToken({
      companyId: company.id,
      bookingRequestId: booking.id,
      referenceNumber: "BK-OTHER-REF-0001"
    });

    await expect(
      bookingService.holdPublicBookingSlot("acme-hvac", booking.referenceNumber ?? "", {
        holdToken,
        technicianId: technician.id,
        scheduledStart: SLOT_START,
        scheduledEnd: SLOT_END
      })
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it("rejects public hold when zip is no longer in service area", async () => {
    const { company, technician, booking } = seedPublicBookingFixture();
    const holdToken = generateBookingHoldToken({
      companyId: company.id,
      bookingRequestId: booking.id,
      referenceNumber: booking.referenceNumber ?? booking.id
    });

    technician.serviceZipCodes = ["73301"];

    await expect(
      bookingService.holdPublicBookingSlot("acme-hvac", booking.referenceNumber ?? "", {
        holdToken,
        technicianId: technician.id,
        scheduledStart: SLOT_START,
        scheduledEnd: SLOT_END
      })
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it("rejects public hold when slot is not in published availability", async () => {
    const { company, technician, booking } = seedPublicBookingFixture();
    const holdToken = generateBookingHoldToken({
      companyId: company.id,
      bookingRequestId: booking.id,
      referenceNumber: booking.referenceNumber ?? booking.id
    });

    await expect(
      bookingService.holdPublicBookingSlot("acme-hvac", booking.referenceNumber ?? "", {
        holdToken,
        technicianId: technician.id,
        scheduledStart: SLOT_START,
        scheduledEnd: SLOT_END
      })
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it("confirmPublicBookingSlot requires an active slot hold matching the selection", async () => {
    const { technician, booking } = seedPublicBookingFixture();

    await expect(
      bookingService.confirmPublicBookingSlot("acme-hvac", booking.referenceNumber ?? "", {
        technicianId: technician.id,
        scheduledStart: SLOT_START,
        scheduledEnd: SLOT_END
      })
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
  });

  it("confirmPublicBookingSlot creates a job after a public hold", async () => {
    const { company, technician, booking } = seedPublicBookingFixture();
    const holdToken = generateBookingHoldToken({
      companyId: company.id,
      bookingRequestId: booking.id,
      referenceNumber: booking.referenceNumber ?? booking.id
    });
    const availability = await bookingService.getBookingAvailability("acme-hvac", "78701", "2026-05-12");
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

    expect(confirmed.bookingRequest.status).toBe("confirmed");
    expect(confirmed.jobId).toBeTruthy();
    expect(confirmed.recurringSchedule.linked).toBe(false);

    const events = fakeDb.getTestState().activityEvents.filter((event) => event.eventType === "booking.confirmed");
    expect(events).toHaveLength(1);
  });

  it("confirmPublicBookingSlot links maintenance visits when a plan exists", async () => {
    const { company, technician, booking } = seedPublicBookingFixture();
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: booking.firstName,
      lastName: booking.lastName,
      phone: booking.phone
    });
    booking.customerId = customer.id;
    booking.serviceType = "recurring maintenance";
    fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      status: "active"
    });

    const holdToken = generateBookingHoldToken({
      companyId: company.id,
      bookingRequestId: booking.id,
      referenceNumber: booking.referenceNumber ?? booking.id
    });
    const availability = await bookingService.getBookingAvailability("acme-hvac", "78701", "2026-05-12");
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

    expect(confirmed.recurringSchedule.linked).toBe(true);
    expect(confirmed.recurringSchedule.maintenanceVisitId).not.toBeNull();
  });
});
