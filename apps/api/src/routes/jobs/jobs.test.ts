import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const { addQueueJob, redisDelMock, redisGetMock, redisSetMock } = vi.hoisted(() => ({
  addQueueJob: vi.fn(),
  redisDelMock: vi.fn(async () => 1),
  redisGetMock: vi.fn(async () => null),
  redisSetMock: vi.fn(async () => "OK")
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: {
    add: addQueueJob
  },
  redisConnection: {
    get: redisGetMock,
    set: redisSetMock,
    del: redisDelMock
  }
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
}, 20000);

beforeEach(async () => {
  fakeDb.resetTestState();
  addQueueJob.mockReset();
  redisDelMock.mockClear();
  redisGetMock.mockClear();
  redisSetMock.mockClear();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function createAuthContext() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@example.com",
    firstName: "Ava",
    lastName: "Stone",
    role: "owner"
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

function seedJobGraph(companyId: string) {
  const customer = fakeDb.seedCustomer({
    companyId,
    firstName: "Chris",
    lastName: "Pine",
    lifetimeValue: "50.00",
    totalJobs: 1
  });
  const property = fakeDb.seedProperty({
    companyId,
    customerId: customer.id,
    addressLine1: "101 Main St",
    city: "Tulsa",
    state: "OK",
    zip: "74103",
    accessNotes: "Use side gate"
  });
  const asset = fakeDb.seedAsset({
    companyId,
    customerId: customer.id,
    propertyId: property.id,
    name: "Main HVAC Unit",
    assetType: "hvac"
  });
  const technician = fakeDb.seedTechnician({
    companyId,
    firstName: "Taylor",
    lastName: "Tech",
    phone: "555-0100",
    totalJobsCompleted: 2
  });

  return { customer, property, asset, technician };
}

describe("job routes", () => {
  it("GET /jobs returns paginated results and supports status and technician filters", async () => {
    const auth = createAuthContext();
    const { customer, technician } = seedJobGraph(auth.company.id);
    const otherTechnician = fakeDb.seedTechnician({
      companyId: auth.company.id,
      firstName: "Robin",
      lastName: "Route",
      phone: "555-0101"
    });

    fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      technicianId: technician.id,
      title: "Scheduled Job",
      status: "scheduled"
    });
    fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      technicianId: otherTechnician.id,
      title: "Lead Job",
      status: "lead"
    });

    const response = await request(app.server)
      .get(`/api/v1/jobs?status=scheduled&technicianId=${technician.id}`)
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].title).toBe("Scheduled Job");
  });

  it("POST /jobs supports success, validation failure, unknown customer, and missing auth", async () => {
    const auth = createAuthContext();
    const { customer, property, asset, technician } = seedJobGraph(auth.company.id);

    const successResponse = await request(app.server)
      .post("/api/v1/jobs")
      .set("Authorization", auth.authorization)
      .send({
        customerId: customer.id,
        propertyId: property.id,
        assetId: asset.id,
        technicianId: technician.id,
        title: "Spring Maintenance"
      });
    const validationResponse = await request(app.server)
      .post("/api/v1/jobs")
      .set("Authorization", auth.authorization)
      .send({
        customerId: customer.id,
        title: ""
      });
    const unknownCustomerResponse = await request(app.server)
      .post("/api/v1/jobs")
      .set("Authorization", auth.authorization)
      .send({
        customerId: randomUUID(),
        title: "Unknown Customer"
      });
    const unauthorizedResponse = await request(app.server)
      .post("/api/v1/jobs")
      .send({
        customerId: customer.id,
        title: "No Auth"
      });

    expect(successResponse.status).toBe(201);
    expect(successResponse.body.job.jobNumber).toBe("JOB-0001");
    expect(validationResponse.status).toBe(400);
    expect(unknownCustomerResponse.status).toBe(404);
    expect(unauthorizedResponse.status).toBe(401);
  });

  it("GET /jobs/:id returns detail with availableTransitions and 404 for unknown jobs", async () => {
    const auth = createAuthContext();
    const { customer } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Detail Job",
      status: "lead"
    });

    const successResponse = await request(app.server)
      .get(`/api/v1/jobs/${job.id}`)
      .set("Authorization", auth.authorization);
    const missingResponse = await request(app.server)
      .get(`/api/v1/jobs/${randomUUID()}`)
      .set("Authorization", auth.authorization);

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.job.availableTransitions).toEqual([
      "estimate_requested",
      "scheduled",
      "cancelled"
    ]);
    expect(missingResponse.status).toBe(404);
  });

  it("PATCH /jobs/:id supports success, bad input, unknown jobs, and missing auth", async () => {
    const auth = createAuthContext();
    const { customer } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Patch Me",
      status: "lead"
    });

    const successResponse = await request(app.server)
      .patch(`/api/v1/jobs/${job.id}`)
      .set("Authorization", auth.authorization)
      .send({
        title: "Patched Job",
        techNotes: "Bring ladder"
      });
    const validationResponse = await request(app.server)
      .patch(`/api/v1/jobs/${job.id}`)
      .set("Authorization", auth.authorization)
      .send({
        title: ""
      });
    const missingResponse = await request(app.server)
      .patch(`/api/v1/jobs/${randomUUID()}`)
      .set("Authorization", auth.authorization)
      .send({
        title: "Unknown Job"
      });
    const unauthorizedResponse = await request(app.server)
      .patch(`/api/v1/jobs/${job.id}`)
      .send({
        title: "No Auth"
      });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.job.title).toBe("Patched Job");
    expect(successResponse.body.job.techNotes).toBe("Bring ladder");
    expect(validationResponse.status).toBe(400);
    expect(missingResponse.status).toBe(404);
    expect(unauthorizedResponse.status).toBe(401);
  });

  it("POST /jobs/:id/status supports valid transitions and rejects invalid ones", async () => {
    const auth = createAuthContext();
    const { customer } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Status Job",
      status: "lead"
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/status`)
      .set("Authorization", auth.authorization)
      .send({
        status: "scheduled"
      });
    const invalidResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/status`)
      .set("Authorization", auth.authorization)
      .send({
        status: "paid"
      });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.job.status).toBe("scheduled");
    expect(invalidResponse.status).toBe(409);
    expect(invalidResponse.body.error).toBe("CONFLICT");
  });

  it("POST /jobs/:id/assign succeeds and returns 404 for an unknown technician", async () => {
    const auth = createAuthContext();
    const { customer, technician } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Assign Job"
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/assign`)
      .set("Authorization", auth.authorization)
      .send({
        technicianId: technician.id
      });
    const missingResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/assign`)
      .set("Authorization", auth.authorization)
      .send({
        technicianId: randomUUID()
      });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.job.technicianId).toBe(technician.id);
    expect(missingResponse.status).toBe(404);
  });

  it("POST /jobs/:id/schedule creates a slot and validates end after start", async () => {
    const auth = createAuthContext();
    const { customer, technician } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      technicianId: technician.id,
      title: "Schedule Job",
      status: "lead"
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/schedule`)
      .set("Authorization", auth.authorization)
      .send({
        scheduledStart: "2026-04-29T13:00:00.000Z",
        scheduledEnd: "2026-04-29T14:00:00.000Z"
      });
    const validationResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/schedule`)
      .set("Authorization", auth.authorization)
      .send({
        scheduledStart: "2026-04-29T14:00:00.000Z",
        scheduledEnd: "2026-04-29T13:00:00.000Z"
      });

    expect(successResponse.status).toBe(200);
    expect(fakeDb.getTestState().scheduleSlots).toHaveLength(1);
    expect(validationResponse.status).toBe(400);
  });

  it("POST /jobs/:id/complete updates customer metrics and enqueues AI work", async () => {
    const auth = createAuthContext();
    const { customer, asset, technician } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      assetId: asset.id,
      technicianId: technician.id,
      title: "Complete Route Job",
      status: "in_progress",
      invoiceTotal: "200.00"
    });

    const response = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/complete`)
      .set("Authorization", auth.authorization)
      .send({
        completionNotes: "Wrapped up"
      });

    expect(response.status).toBe(200);
    expect(response.body.job.status).toBe("completed");
    expect(fakeDb.getTestState().customers.find((row) => row.id === customer.id)?.totalJobs).toBe(2);
    expect(addQueueJob).toHaveBeenCalledTimes(1);
  });

  it("POST /jobs/:id/complete rejects a stale client while a required task remains open", async () => {
    const auth = createAuthContext();
    const { customer } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({ companyId: auth.company.id, customerId: customer.id, title: "Required Check", status: "in_progress" });
    const task = fakeDb.seedJobTask({ companyId: auth.company.id, jobId: job.id, title: "Confirm safe shutdown", isRequired: true });

    const blocked = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/complete`)
      .set("Authorization", auth.authorization)
      .send({});
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toBe("CONFLICT");
    expect(blocked.body.message).toMatch(/required checklist/i);
    expect(fakeDb.getTestState().jobs.find((row) => row.id === job.id)?.status).toBe("in_progress");
    expect(addQueueJob).not.toHaveBeenCalled();

    const taskDone = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/tasks/${task.id}/complete`)
      .set("Authorization", auth.authorization);
    expect(taskDone.status).toBe(200);
    const retried = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/complete`)
      .set("Authorization", auth.authorization)
      .send({});
    expect(retried.status).toBe(200);
  });

  it("notes and photos endpoints create and list job artifacts", async () => {
    const auth = createAuthContext();
    const { customer } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Artifacts Job"
    });

    const noteResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/notes`)
      .set("Authorization", auth.authorization)
      .send({
        content: "Customer called ahead"
      });
    const notesListResponse = await request(app.server)
      .get(`/api/v1/jobs/${job.id}/notes`)
      .set("Authorization", auth.authorization);
    const photoResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/photos`)
      .set("Authorization", auth.authorization)
      .send({
        url: "https://cdn.example.com/job-before.jpg",
        photoType: "before"
      });
    const photosListResponse = await request(app.server)
      .get(`/api/v1/jobs/${job.id}/photos`)
      .set("Authorization", auth.authorization);

    expect(noteResponse.status).toBe(201);
    expect(notesListResponse.status).toBe(200);
    expect(notesListResponse.body.notes).toHaveLength(1);
    expect(photoResponse.status).toBe(201);
    expect(photosListResponse.status).toBe(200);
    expect(photosListResponse.body.photos[0].url).toBe("https://cdn.example.com/job-before.jpg");
  });

  it("task endpoints support list, create, update, complete, reorder, delete, and unknown-task 404s", async () => {
    const auth = createAuthContext();
    const { customer, technician } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Tasks Job"
    });
    const existingTask = fakeDb.seedJobTask({
      companyId: auth.company.id,
      jobId: job.id,
      title: "Existing Task",
      sortOrder: 0
    });

    const listResponse = await request(app.server)
      .get(`/api/v1/jobs/${job.id}/tasks`)
      .set("Authorization", auth.authorization);
    const createResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/tasks`)
      .set("Authorization", auth.authorization)
      .send({
        assignedToId: technician.id,
        title: "New Task"
      });

    const createdTaskId = createResponse.body.task.id as string;

    const updateResponse = await request(app.server)
      .patch(`/api/v1/jobs/${job.id}/tasks/${createdTaskId}`)
      .set("Authorization", auth.authorization)
      .send({
        title: "Updated Task",
        status: "in_progress"
      });
    const completeResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/tasks/${createdTaskId}/complete`)
      .set("Authorization", auth.authorization);
    const reorderResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/tasks/reorder`)
      .set("Authorization", auth.authorization)
      .send({
        orderedIds: [createdTaskId, existingTask.id]
      });
    const deleteResponse = await request(app.server)
      .delete(`/api/v1/jobs/${job.id}/tasks/${existingTask.id}`)
      .set("Authorization", auth.authorization);
    const missingResponse = await request(app.server)
      .patch(`/api/v1/jobs/${job.id}/tasks/${randomUUID()}`)
      .set("Authorization", auth.authorization)
      .send({
        title: "Missing Task"
      });

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.tasks).toHaveLength(1);
    expect(createResponse.status).toBe(201);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.task.title).toBe("Updated Task");
    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.task.status).toBe("completed");
    expect(reorderResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
    expect(missingResponse.status).toBe(404);
  });

  it("job product endpoints support list, add, update, approve upsell, and delete", async () => {
    const auth = createAuthContext();
    const { customer } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Products Job"
    });
    const catalogProduct = fakeDb.seedProductCatalog({
      companyId: auth.company.id,
      name: "Capacitor",
      unitPrice: "89.00"
    });

    const listResponse = await request(app.server)
      .get(`/api/v1/jobs/${job.id}/products`)
      .set("Authorization", auth.authorization);
    const addResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/products`)
      .set("Authorization", auth.authorization)
      .send({
        productCatalogId: catalogProduct.id,
        quantity: 2,
        isUpsell: true
      });

    const createdProductId = addResponse.body.product.id as string;

    const updateResponse = await request(app.server)
      .patch(`/api/v1/jobs/${job.id}/products/${createdProductId}`)
      .set("Authorization", auth.authorization)
      .send({
        quantity: 3
      });
    const approveResponse = await request(app.server)
      .post(`/api/v1/jobs/${job.id}/products/${createdProductId}/approve-upsell`)
      .set("Authorization", auth.authorization);
    const deleteResponse = await request(app.server)
      .delete(`/api/v1/jobs/${job.id}/products/${createdProductId}`)
      .set("Authorization", auth.authorization);

    expect(listResponse.status).toBe(200);
    expect(listResponse.body.products).toHaveLength(0);
    expect(addResponse.status).toBe(201);
    expect(addResponse.body.product.unitPrice).toBe("89.00");
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.product.total).toBe("267.00");
    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.product.upsellApproved).toBe(true);
    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);
  });

  it("GET /jobs/:id/activity returns newest-first timeline events", async () => {
    const auth = createAuthContext();
    const { customer } = seedJobGraph(auth.company.id);
    const job = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Timeline Job"
    });

    fakeDb.seedActivityEvent({
      companyId: auth.company.id,
      eventType: "job.created",
      entityType: "job",
      entityId: job.id,
      jobId: job.id,
      customerId: customer.id,
      summary: "Job created",
      occurredAt: new Date("2026-04-28T10:00:00.000Z")
    });
    fakeDb.seedActivityEvent({
      companyId: auth.company.id,
      eventType: "job.updated",
      entityType: "job",
      entityId: job.id,
      jobId: job.id,
      customerId: customer.id,
      summary: "Job updated",
      occurredAt: new Date("2026-04-28T11:00:00.000Z")
    });

    const response = await request(app.server)
      .get(`/api/v1/jobs/${job.id}/activity`)
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.activity[0].summary).toBe("Job updated");
    expect(response.body.activity[1].summary).toBe("Job created");
  });

  it("POST /jobs/:id/status reopens cancelled jobs back to lead and rejects cancelled to scheduled", async () => {
    const auth = createAuthContext();
    const { customer } = seedJobGraph(auth.company.id);
    const cancelledJob = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Cancelled Job",
      status: "cancelled"
    });
    const otherCancelledJob = fakeDb.seedJob({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Still Cancelled",
      status: "cancelled"
    });

    const reopenResponse = await request(app.server)
      .post(`/api/v1/jobs/${cancelledJob.id}/status`)
      .set("Authorization", auth.authorization)
      .send({
        status: "lead"
      });
    const invalidResponse = await request(app.server)
      .post(`/api/v1/jobs/${otherCancelledJob.id}/status`)
      .set("Authorization", auth.authorization)
      .send({
        status: "scheduled"
      });

    expect(reopenResponse.status).toBe(200);
    expect(reopenResponse.body.job.status).toBe("lead");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("job.reopened");
    expect(invalidResponse.status).toBe(409);
    expect(invalidResponse.body.error).toBe("CONFLICT");
  });
});
