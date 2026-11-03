import request from "supertest";
import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const {
  addAiQueueJob,
  addNotificationJob,
  redisDelMock,
  redisGetMock,
  redisSetMock,
  resetRedisStore,
  uploadFileMock
} = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    addAiQueueJob: vi.fn(),
    addNotificationJob: vi.fn(),
    redisDelMock: vi.fn(async (key: string) => {
      const deleted = store.delete(key);
      return deleted ? 1 : 0;
    }),
    redisGetMock: vi.fn(async (key: string) => store.get(key) ?? null),
    redisSetMock: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    resetRedisStore: () => {
      store.clear();
    },
    uploadFileMock: vi.fn()
  };
});

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: {
    add: addAiQueueJob
  },
  agreementsQueue: {
    add: vi.fn()
  },
  importsQueue: {
    add: vi.fn()
  },
  invoicesQueue: {
    add: vi.fn()
  },
  notificationsQueue: {
    add: addNotificationJob
  },
  redisConnection: {
    get: redisGetMock,
    set: redisSetMock,
    del: redisDelMock
  },
  webhooksQueue: {
    add: vi.fn()
  }
}));

vi.mock("../lib/storage.js", () => ({
  uploadFile: uploadFileMock,
  getFileKeyFromUrl: (reference: string) => reference.replace(/^https:\/\/files\.example\//, ""),
  createSignedDownloadUrl: async (objectKey: string) => ({
    url: `https://signed.example/${objectKey}?expires=1`
  }),
  getMediaSignedUrlTtlSeconds: () => 900
}));

type BuildAppModule = typeof import("../app.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");
type TokensModule = typeof import("../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

beforeAll(async () => {
  buildAppModule = await import("../app.js");
  fakeDb = await import("../test-support/fake-db.js");
  tokens = await import("../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  addAiQueueJob.mockReset();
  addNotificationJob.mockReset();
  redisDelMock.mockClear();
  redisGetMock.mockClear();
  redisSetMock.mockClear();
  resetRedisStore();
  uploadFileMock.mockReset();
  uploadFileMock.mockImplementation(async (key: string) => ({ url: `https://files.example/${key}` }));
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-28T14:00:00.000Z"));
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  vi.useRealTimers();
});

function createAuthContext(role: "owner" | "admin" | "dispatcher" = "owner") {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: `acme-${role}`,
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}@example.com`,
    firstName: "Ava",
    lastName: "Stone",
    role,
    phone: "555-9999"
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return {
    company,
    user,
    authorization: `Bearer ${accessToken}`
  };
}

function seedFieldGraph(companyId: string) {
  const customer = fakeDb.seedCustomer({
    companyId,
    firstName: "Chris",
    lastName: "Pine",
    phone: "555-0100",
    email: "chris@example.com"
  });
  const property = fakeDb.seedProperty({
    companyId,
    customerId: customer.id,
    addressLine1: "101 Main St",
    city: "Tulsa",
    state: "OK",
    zip: "74103"
  });
  const technician = fakeDb.seedTechnician({
    companyId,
    firstName: "Taylor",
    lastName: "Tech",
    phone: "555-0101",
    serviceZipCodes: ["74103"],
    hoursPerDay: "8"
  });
  const job = fakeDb.seedJob({
    companyId,
    customerId: customer.id,
    propertyId: property.id,
    technicianId: technician.id,
    title: "Spring Tune-Up",
    status: "scheduled",
    scheduledStart: new Date("2026-04-28T14:00:00.000Z"),
    scheduledEnd: new Date("2026-04-28T16:00:00.000Z")
  });

  return { customer, property, technician, job };
}

describe("phase2 operations routes", () => {
  it("handles the time entry lifecycle routes including edit and technician history", async () => {
    const auth = createAuthContext("owner");
    const { technician, job } = seedFieldGraph(auth.company.id);

    const startedResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/time/start`)
      .set("Authorization", auth.authorization)
      .send({
        technicianId: technician.id,
        entryType: "travel"
      });

    expect(startedResponse.status).toBe(201);

    const startedEntryId = startedResponse.body.timeEntry.id as string;

    const listResponse = await request(app.server)
      .get(`/api/v1/jobs/${job.id}/time`)
      .set("Authorization", auth.authorization);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.timeEntries).toHaveLength(1);

    const patchedResponse = await request(app.server)
      .patch(`/api/v1/time/${startedEntryId}`)
      .set("Authorization", auth.authorization)
      .send({
        notes: "Traveling from warehouse"
      });

    expect(patchedResponse.status).toBe(200);
    expect(patchedResponse.body.timeEntry.notes).toBe("Traveling from warehouse");

    vi.setSystemTime(new Date("2026-04-28T14:30:00.000Z"));
    const refreshedAuthorization = `Bearer ${tokens.generateAccessToken({
      userId: auth.user.id,
      companyId: auth.company.id,
      role: auth.user.role
    })}`;

    const stoppedResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/time/stop`)
      .set("Authorization", refreshedAuthorization)
      .send({
        technicianId: technician.id
      });

    expect(stoppedResponse.status).toBe(200);
    expect(stoppedResponse.body.timeEntry.durationMinutes).toBe(30);

    const technicianTimeResponse = await request(app.server)
      .get(`/api/v1/technicians/${technician.id}/time?startDate=2026-04-28&endDate=2026-04-28`)
      .set("Authorization", refreshedAuthorization);

    expect(technicianTimeResponse.status).toBe(200);
    expect(technicianTimeResponse.body.data).toHaveLength(1);
  });

  it("handles OTW plus authenticated and public review request flows", async () => {
    const auth = createAuthContext("owner");
    const { technician, job } = seedFieldGraph(auth.company.id);
    fakeDb.seedBookingSettings({
      companyId: auth.company.id,
      bookingSlug: auth.company.slug,
      isEnabled: true,
      googleReviewUrl: "https://google.example/review"
    });

    const otwResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/on-the-way`)
      .set("Authorization", auth.authorization)
      .send({
        technicianId: technician.id,
        estimatedArrivalMinutes: 20
      });

    expect(otwResponse.status).toBe(201);

    const otwStatusResponse = await request(app.server)
      .get(`/api/v1/jobs/${job.id}/on-the-way`)
      .set("Authorization", auth.authorization);

    expect(otwStatusResponse.status).toBe(200);
    expect(otwStatusResponse.body.notification.estimatedArrivalMinutes).toBe(20);

    const createReviewResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/review-request`)
      .set("Authorization", auth.authorization)
      .send({
        channel: "sms"
      });

    expect(createReviewResponse.status).toBe(201);

    const reviewRequestId = createReviewResponse.body.reviewRequest.id as string;
    const reviewToken = createReviewResponse.body.reviewRequest.referenceId as string;

    const listReviewResponse = await request(app.server)
      .get("/api/v1/review-requests")
      .set("Authorization", auth.authorization);

    expect(listReviewResponse.status).toBe(200);
    expect(listReviewResponse.body.total).toBe(1);

    const patchReviewResponse = await request(app.server)
      .patch(`/api/v1/review-requests/${reviewRequestId}`)
      .set("Authorization", auth.authorization)
      .send({
        status: "completed",
        rating: 4,
        reviewText: "Great service"
      });

    expect(patchReviewResponse.status).toBe(200);
    expect(patchReviewResponse.body.reviewRequest.status).toBe("completed");

    const thirdReview = fakeDb.seedReviewRequest({
      companyId: auth.company.id,
      customerId: job.customerId,
      jobId: job.id,
      technicianId: technician.id,
      referenceId: randomUUID(),
      status: "clicked",
      channel: "email",
      sentAt: new Date("2026-04-28T14:00:00.000Z"),
      clickedAt: new Date("2026-04-28T14:10:00.000Z")
    });

    const resendReviewResponse = await request(app.server)
      .post(`/api/v1/review-requests/${thirdReview.id}/resend`)
      .set("Authorization", auth.authorization);

    expect(resendReviewResponse.status).toBe(200);
    expect(resendReviewResponse.body.reviewRequest.status).toBe("sent");

    const secondReview = fakeDb.seedReviewRequest({
      companyId: auth.company.id,
      customerId: job.customerId,
      jobId: job.id,
      technicianId: technician.id,
      referenceId: randomUUID(),
      status: "sent",
      channel: "sms",
      sentAt: new Date("2026-04-28T14:00:00.000Z")
    });

    const publicLandingResponse = await request(app.server)
      .get(`/api/v1/public/reviews/${secondReview.referenceId}`);

    expect(publicLandingResponse.status).toBe(200);
    expect(publicLandingResponse.body.review.companyName).toBe("Acme HVAC");
    expect(publicLandingResponse.body.review.status).toBe("clicked");

    const publicCompleteResponse = await request(app.server)
      .post(`/api/v1/public/reviews/${secondReview.referenceId}/complete`)
      .send({
        rating: 5,
        reviewText: "Excellent visit"
      });

    expect(publicCompleteResponse.status).toBe(200);
    expect(publicCompleteResponse.body.reviewRequest.status).toBe("completed");
  });

  it("uploads, lists, and soft deletes attachments", async () => {
    const auth = createAuthContext("owner");
    const { job } = seedFieldGraph(auth.company.id);

    const uploadResponse = await request(app.server)
      .post("/api/v1/attachments")
      .set("Authorization", auth.authorization)
      .field("entityType", "job")
      .field("entityId", job.id)
      .field("caption", "Before photo")
      .field("photoType", "before")
      .attach("file", Buffer.from("attachment text"), {
        filename: "note.txt",
        contentType: "text/plain"
      });

    expect(uploadResponse.status).toBe(201);

    const attachmentId = uploadResponse.body.attachment.id as string;

    const listResponse = await request(app.server)
      .get(`/api/v1/attachments?entityType=job&entityId=${job.id}`)
      .set("Authorization", auth.authorization);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.data).toHaveLength(1);

    const deleteResponse = await request(app.server)
      .delete(`/api/v1/attachments/${attachmentId}`)
      .set("Authorization", auth.authorization);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
  });

  it("serves dispatch view, workload, queues, and real auto-fit suggestions", async () => {
    const auth = createAuthContext("owner");
    const { customer, property, technician, job } = seedFieldGraph(auth.company.id);
    technician.skills = ["HVAC", "Maintenance"];
    technician.serviceZipCodes = ["74103"];
    job.status = "lead";
    job.technicianId = null;
    job.scheduledStart = null;
    job.scheduledEnd = null;
    job.scheduledDurationMinutes = null;

    fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      propertyId: property.id,
      technicianId: technician.id,
      title: "Morning Repair",
      status: "scheduled",
      scheduledStart: new Date("2026-04-28T13:00:00.000Z"),
      scheduledEnd: new Date("2026-04-28T15:00:00.000Z")
    });
    fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      propertyId: property.id,
      technicianId: technician.id,
      title: "Afternoon Repair",
      status: "scheduled",
      scheduledStart: new Date("2026-04-28T17:00:00.000Z"),
      scheduledEnd: new Date("2026-04-28T21:00:00.000Z")
    });
    fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      estimateNumber: "EST-2001",
      title: "Approved Estimate",
      subtotal: "500.00",
      total: "500.00",
      status: "approved",
      approvedAt: new Date("2026-04-28T13:00:00.000Z")
    });

    const dispatchResponse = await request(app.server)
      .get("/api/v1/dispatch?date=2026-04-28")
      .set("Authorization", auth.authorization);

    expect(dispatchResponse.status).toBe(200);
    expect(dispatchResponse.body.date).toBe("2026-04-28");

    const workloadResponse = await request(app.server)
      .get("/api/v1/dispatch/workload?date=2026-04-28")
      .set("Authorization", auth.authorization);

    expect(workloadResponse.status).toBe(200);
    expect(workloadResponse.body.workload[0].technicianId).toBe(technician.id);

    const unscheduledResponse = await request(app.server)
      .get("/api/v1/jobs/unscheduled")
      .set("Authorization", auth.authorization);

    expect(unscheduledResponse.status).toBe(200);
    expect(unscheduledResponse.body.jobs).toHaveLength(1);

    const approvedResponse = await request(app.server)
      .get("/api/v1/estimates/approved-unconverted")
      .set("Authorization", auth.authorization);

    expect(approvedResponse.status).toBe(200);
    expect(approvedResponse.body.estimates).toHaveLength(1);

    const autoFitResponse = await request(app.server)
      .post("/api/v1/dispatch/auto-fit")
      .set("Authorization", auth.authorization)
      .send({
        jobId: job.id,
        date: "2026-04-28"
      });

    expect(autoFitResponse.status).toBe(200);
    expect(autoFitResponse.body.suggestions).toHaveLength(1);
    expect(autoFitResponse.body.suggestions[0].technicianId).toBe(technician.id);
    expect(autoFitResponse.body.suggestions[0].score).toBeGreaterThan(0);
    expect(autoFitResponse.body.message).toBeNull();
  });

  it("serves the public booking flow including zip check, availability, submit, and confirmation", async () => {
    const auth = createAuthContext("owner");
    const { job, technician } = seedFieldGraph(auth.company.id);

    fakeDb.seedBookingSettings({
      companyId: auth.company.id,
      bookingSlug: auth.company.slug,
      isEnabled: true,
      autoConfirm: false,
      notifyOnNewBooking: true,
      availableDays: ["tue"],
      availableHoursStart: 8,
      availableHoursEnd: 17
    });
    fakeDb.seedScheduleSlot({
      companyId: auth.company.id,
      technicianId: technician.id,
      startTime: new Date("2026-04-28T08:00:00.000Z"),
      endTime: new Date("2026-04-28T12:00:00.000Z")
    });
    job.scheduledStart = new Date("2026-04-29T14:00:00.000Z");
    job.scheduledEnd = new Date("2026-04-29T16:00:00.000Z");

    const settingsResponse = await request(app.server)
      .get(`/api/v1/public/booking/${auth.company.slug}`);

    expect(settingsResponse.status).toBe(200);
    expect(settingsResponse.body.booking.companyName).toBe("Acme HVAC");

    const coverageResponse = await request(app.server)
      .post(`/api/v1/public/booking/${auth.company.slug}/check-zip`)
      .send({ zip: "74103" });

    expect(coverageResponse.status).toBe(200);
    expect(coverageResponse.body.covered).toBe(true);

    const availabilityResponse = await request(app.server)
      .get(`/api/v1/public/booking/${auth.company.slug}/availability?zip=74103&date=2026-04-28`);

    expect(availabilityResponse.status).toBe(200);
    expect(
      availabilityResponse.body.availability.some(
        (window: { date: string; window: string }) =>
          window.date === "2026-04-28" && window.window === "morning"
      )
    ).toBe(false);
    expect(
      availabilityResponse.body.availability.some(
        (window: { date: string; window: string }) =>
          window.date === "2026-04-28" && window.window === "afternoon"
      )
    ).toBe(true);

    const submitResponse = await request(app.server)
      .post(`/api/v1/public/booking/${auth.company.slug}/submit?src=google`)
      .send({
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
        smsConsentAppointments: true
      });

    expect(submitResponse.status).toBe(201);
    expect(submitResponse.body.bookingRequest.status).toBe("pending");

    const confirmationResponse = await request(app.server)
      .get(
        `/api/v1/public/booking/${auth.company.slug}/confirmation/${submitResponse.body.bookingRequest.referenceNumber as string}`
      );

    expect(confirmationResponse.status).toBe(200);
    expect(confirmationResponse.body.confirmation.referenceNumber).toBe(
      submitResponse.body.bookingRequest.referenceNumber
    );
  });

  it("supports authenticated booking management, settings updates, and technician service areas", async () => {
    const auth = createAuthContext("owner");
    const { technician } = seedFieldGraph(auth.company.id);
    fakeDb.seedBookingSettings({
      companyId: auth.company.id,
      bookingSlug: auth.company.slug,
      isEnabled: true,
      autoConfirm: false
    });
    const pendingRequest = fakeDb.seedBookingRequest({
      companyId: auth.company.id,
      firstName: "Jamie",
      lastName: "Stone",
      phone: "555-0200",
      email: "jamie@example.com",
      addressLine1: "500 Oak Ave",
      city: "Tulsa",
      state: "OK",
      zip: "74103",
      status: "pending",
      referenceNumber: "BK-20260428-0001"
    });
    const secondRequest = fakeDb.seedBookingRequest({
      companyId: auth.company.id,
      firstName: "Alex",
      lastName: "Lane",
      phone: "555-0201",
      email: "alex@example.com",
      addressLine1: "900 Pine St",
      city: "Tulsa",
      state: "OK",
      zip: "74103",
      status: "pending",
      referenceNumber: "BK-20260428-0002"
    });

    const listResponse = await request(app.server)
      .get("/api/v1/booking-requests")
      .set("Authorization", auth.authorization);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.total).toBe(2);

    const getResponse = await request(app.server)
      .get(`/api/v1/booking-requests/${pendingRequest.id}`)
      .set("Authorization", auth.authorization);

    expect(getResponse.status).toBe(200);
    expect(getResponse.body.bookingRequest.id).toBe(pendingRequest.id);

    const confirmResponse = await request(app.server)
      .post(`/api/v1/booking-requests/${pendingRequest.id}/confirm`)
      .set("Authorization", auth.authorization)
      .send({
        technicianId: technician.id,
        scheduledStart: "2026-04-29T18:00:00.000Z",
        scheduledEnd: "2026-04-29T20:00:00.000Z"
      });

    expect(confirmResponse.status).toBe(200);
    expect(confirmResponse.body.bookingRequest.status).toBe("confirmed");
    expect(confirmResponse.body.bookingRequest.jobId).toBeTruthy();

    const declineResponse = await request(app.server)
      .post(`/api/v1/booking-requests/${secondRequest.id}/decline`)
      .set("Authorization", auth.authorization)
      .send({
        reason: "No slots available"
      });

    expect(declineResponse.status).toBe(200);
    expect(declineResponse.body.bookingRequest.status).toBe("cancelled");

    const settingsResponse = await request(app.server)
      .get("/api/v1/booking-settings")
      .set("Authorization", auth.authorization);

    expect(settingsResponse.status).toBe(200);

    const updateSettingsResponse = await request(app.server)
      .patch("/api/v1/booking-settings")
      .set("Authorization", auth.authorization)
      .send({
        autoConfirm: true,
        notifyOnNewBooking: false
      });

    expect(updateSettingsResponse.status).toBe(200);
    expect(updateSettingsResponse.body.settings.autoConfirm).toBe(true);

    const serviceAreasResponse = await request(app.server)
      .patch(`/api/v1/technicians/${technician.id}/service-areas`)
      .set("Authorization", auth.authorization)
      .send({
        serviceZipCodes: ["74103", "74133"]
      });

    expect(serviceAreasResponse.status).toBe(200);
    expect(serviceAreasResponse.body.technician.serviceZipCodes).toEqual(["74103", "74133"]);
  });
  it("FS-171: starting a second job while clocked in returns 409 open_entry_exists, not 500", async () => {
    const auth = createAuthContext("owner");
    const { technician, job, customer, property } = seedFieldGraph(auth.company.id);
    const job2 = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      propertyId: property.id,
      technicianId: technician.id,
      title: "Second call",
      status: "scheduled",
      scheduledStart: new Date("2026-04-28T17:00:00.000Z"),
      scheduledEnd: new Date("2026-04-28T18:00:00.000Z")
    });

    const first = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/time/start`)
      .set("Authorization", auth.authorization)
      .send({ technicianId: technician.id, entryType: "on_site" });
    expect(first.status).toBe(201);

    const second = await request(app.server)
      .post(`/api/v1/jobs/${job2.id}/time/start`)
      .set("Authorization", auth.authorization)
      .send({ technicianId: technician.id, entryType: "on_site" });
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ error: "CONFLICT", reason: "open_entry_exists" });
  });

  it("FS-171: a start racing past the pre-check (23505 on the open-entry index) returns 409", async () => {
    const auth = createAuthContext("owner");
    const { technician, job } = seedFieldGraph(auth.company.id);
    const dbModule = await import("@fsm/db");
    vi.spyOn(dbModule.db, "transaction").mockRejectedValueOnce(
      Object.assign(new Error("dup"), { cause: { code: "23505", constraint: "time_entries_open_technician_idx" } })
    );

    const response = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/time/start`)
      .set("Authorization", auth.authorization)
      .send({ technicianId: technician.id, entryType: "on_site" });
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ error: "CONFLICT", reason: "open_entry_exists" });
  });
});
