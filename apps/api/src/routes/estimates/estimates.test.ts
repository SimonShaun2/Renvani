import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";
import { restoreTestSystemTime, pinTestSystemTime } from "../../test-support/pinned-test-time.js";

setupTestEnv();

const { addAiQueueJob, addNotificationQueueJob } = vi.hoisted(() => ({
  addAiQueueJob: vi.fn(),
  addNotificationQueueJob: vi.fn()
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
    add: addAiQueueJob
  },
  notificationsQueue: {
    add: addNotificationQueueJob
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
});

beforeEach(async () => {
  pinTestSystemTime();
  fakeDb.resetTestState();
  addAiQueueJob.mockReset();
  addNotificationQueueJob.mockReset();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
  restoreTestSystemTime();
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

function authorizationForRole(companyId: string, role: "technician" | "office" | "dispatcher") {
  const user = fakeDb.seedUser({
    companyId, email: `${role}-${randomUUID()}@example.com`,
    firstName: "Route", lastName: "Tester", role
  });
  return {
    user,
    authorization: `Bearer ${tokens.generateAccessToken({ userId: user.id, companyId, role })}`
  };
}

function seedEstimateGraph(companyId: string) {
  const customer = fakeDb.seedCustomer({
    companyId,
    firstName: "Chris",
    lastName: "Pine",
    email: "chris@example.com",
    phone: "555-0100"
  });
  const property = fakeDb.seedProperty({
    companyId,
    customerId: customer.id,
    addressLine1: "101 Main St",
    city: "Tulsa",
    state: "OK",
    zip: "74103"
  });
  const job = fakeDb.seedJob({
    companyId,
    customerId: customer.id,
    propertyId: property.id,
    title: "Spring Tune-Up",
    status: "lead"
  });

  return { customer, property, job };
}

describe("estimate routes", () => {
  it("limits technician reads to a current assigned job and hides customer approval tokens", async () => {
    const owner = createAuthContext();
    const technicianActor = authorizationForRole(owner.company.id, "technician");
    const otherTechnicianActor = authorizationForRole(owner.company.id, "technician");
    const officeActor = authorizationForRole(owner.company.id, "office");
    const technician = fakeDb.seedTechnician({ companyId: owner.company.id, userId: technicianActor.user.id,
      firstName: "Tess", lastName: "Tech", phone: "555-0101" });
    const { customer, job } = seedEstimateGraph(owner.company.id);
    job.technicianId = technician.id;
    const estimate = fakeDb.seedEstimate({ companyId: owner.company.id, customerId: customer.id,
      jobId: job.id, approvalToken: "q".repeat(32) });
    fakeDb.seedEstimateItem({ companyId: owner.company.id, estimateId: estimate.id,
      name: "Diagnostic", quantity: "1.000", unitPrice: "25.00", total: "25.00" });
    const unlinked = fakeDb.seedEstimate({ companyId: owner.company.id, customerId: customer.id });
    const foreign = fakeDb.seedCompany({ name: "Other", slug: `other-${randomUUID()}`, timezone: "America/Chicago" });
    const foreignCustomer = fakeDb.seedCustomer({ companyId: foreign.id, firstName: "Other", lastName: "Customer" });
    const foreignEstimate = fakeDb.seedEstimate({ companyId: foreign.id, customerId: foreignCustomer.id });

    const assigned = await request(app.server).get(`/api/v1/estimates/${estimate.id}`)
      .set("Authorization", technicianActor.authorization);
    const items = await request(app.server).get(`/api/v1/estimates/${estimate.id}/items`)
      .set("Authorization", technicianActor.authorization);
    const ownerDetail = await request(app.server).get(`/api/v1/estimates/${estimate.id}`)
      .set("Authorization", owner.authorization);
    expect(assigned.status).toBe(200);
    expect(assigned.body.estimate.approvalToken).toBeNull();
    expect(items.status).toBe(200);
    expect(items.body.items).toHaveLength(1);
    expect(ownerDetail.body.estimate.approvalToken).toBe("q".repeat(32));
    expect((await request(app.server).get(`/api/v1/estimates/${estimate.id}`)).status).toBe(401);
    expect((await request(app.server).get(`/api/v1/estimates/${estimate.id}`)
      .set("Authorization", officeActor.authorization)).status).toBe(403);
    expect((await request(app.server).get("/api/v1/estimates")
      .set("Authorization", technicianActor.authorization)).status).toBe(403);
    for (const id of [unlinked.id, foreignEstimate.id]) {
      expect((await request(app.server).get(`/api/v1/estimates/${id}`)
        .set("Authorization", technicianActor.authorization)).status).toBe(404);
    }
    expect((await request(app.server).get(`/api/v1/estimates/${estimate.id}/items`)
      .set("Authorization", otherTechnicianActor.authorization)).status).toBe(404);
    job.technicianId = null;
    expect((await request(app.server).get(`/api/v1/estimates/${estimate.id}`)
      .set("Authorization", technicianActor.authorization)).status).toBe(404);
    job.technicianId = technician.id;
    technician.status = "inactive";
    expect((await request(app.server).get(`/api/v1/estimates/${estimate.id}`)
      .set("Authorization", technicianActor.authorization)).status).toBe(404);
  });

  it("denies technician generic estimate mutations before any state change", async () => {
    const owner = createAuthContext();
    const actor = authorizationForRole(owner.company.id, "technician");
    const { customer } = seedEstimateGraph(owner.company.id);
    const estimate = fakeDb.seedEstimate({ companyId: owner.company.id, customerId: customer.id,
      status: "draft", title: "Unchanged" });
    const eventsBefore = fakeDb.getTestState().activityEvents.length;
    const patch = await request(app.server).patch(`/api/v1/estimates/${estimate.id}`)
      .set("Authorization", actor.authorization).send({ title: "Forbidden" });
    const send = await request(app.server).post(`/api/v1/estimates/${estimate.id}/send`)
      .set("Authorization", actor.authorization);
    const remove = await request(app.server).delete(`/api/v1/estimates/${estimate.id}`)
      .set("Authorization", actor.authorization);
    const addItem = await request(app.server).post(`/api/v1/estimates/${estimate.id}/items`)
      .set("Authorization", actor.authorization)
      .send({ name: "Forbidden", itemType: "service", quantity: "1.000", unitPrice: "1.00" });
    expect([patch.status, send.status, remove.status, addItem.status]).toEqual([403, 403, 403, 403]);
    expect(estimate.title).toBe("Unchanged");
    expect(estimate.status).toBe("draft");
    expect(fakeDb.getTestState().activityEvents).toHaveLength(eventsBefore);
  });
  it("GET /estimates returns paginated results and rejects missing auth", async () => {
    const auth = createAuthContext();
    const { customer } = seedEstimateGraph(auth.company.id);
    fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      title: "Alpha Estimate",
      status: "sent",
      total: "175.00",
      subtotal: "175.00"
    });

    const successResponse = await request(app.server)
      .get("/api/v1/estimates?status=sent")
      .set("Authorization", auth.authorization);
    const unauthorizedResponse = await request(app.server).get("/api/v1/estimates");

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.data).toHaveLength(1);
    expect(successResponse.body.data[0].title).toBe("Alpha Estimate");
    expect(unauthorizedResponse.status).toBe(401);
  });

  it("POST /estimates supports success, validation failure, and unknown customers", async () => {
    const auth = createAuthContext();
    const { customer, property, job } = seedEstimateGraph(auth.company.id);

    const successResponse = await request(app.server)
      .post("/api/v1/estimates")
      .set("Authorization", auth.authorization)
      .send({
        customerId: customer.id,
        propertyId: property.id,
        jobId: job.id,
        title: "New Estimate",
        taxRate: "0.1",
        items: [
          {
            name: "Labor",
            quantity: "2",
            unitPrice: "50"
          }
        ]
      });
    const validationResponse = await request(app.server)
      .post("/api/v1/estimates")
      .set("Authorization", auth.authorization)
      .send({
        customerId: customer.id,
        items: [
          {
            name: "",
            quantity: "1",
            unitPrice: "50"
          }
        ]
      });
    const unknownCustomerResponse = await request(app.server)
      .post("/api/v1/estimates")
      .set("Authorization", auth.authorization)
      .send({
        customerId: randomUUID(),
        title: "Missing Customer"
      });
    const numericMoneyResponse = await request(app.server)
      .post("/api/v1/estimates")
      .set("Authorization", auth.authorization)
      .send({
        customerId: customer.id,
        taxRate: 0.1,
        items: [{ name: "Legacy numeric payload", quantity: 1, unitPrice: 50 }]
      });
    const overflowResponse = await request(app.server)
      .post("/api/v1/estimates")
      .set("Authorization", auth.authorization)
      .send({
        customerId: customer.id,
        items: [{ name: "Overflow", quantity: "9999999.999", unitPrice: "99999999.99" }]
      });

    expect(successResponse.status).toBe(201);
    expect(successResponse.body.estimate.estimateNumber).toBe("EST-0001");
    expect(successResponse.body.estimate.total).toBe("110.00");
    expect(validationResponse.status).toBe(400);
    expect(numericMoneyResponse.status).toBe(400);
    expect(overflowResponse.status).toBe(400);
    expect(unknownCustomerResponse.status).toBe(404);
  });

  it("GET /estimates/:id returns detail with items and 404 for unknown estimates", async () => {
    const auth = createAuthContext();
    const { customer, property, job } = seedEstimateGraph(auth.company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      title: "Detail Estimate"
    });
    fakeDb.seedEstimateItem({
      companyId: auth.company.id,
      estimateId: estimate.id,
      name: "Diagnostics",
      quantity: "1.000",
      unitPrice: "100.00",
      total: "100.00"
    });

    const successResponse = await request(app.server)
      .get(`/api/v1/estimates/${estimate.id}`)
      .set("Authorization", auth.authorization);
    const missingResponse = await request(app.server)
      .get(`/api/v1/estimates/${randomUUID()}`)
      .set("Authorization", auth.authorization);

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.estimate.items).toHaveLength(1);
    expect(successResponse.body.estimate.job.jobNumber).toBe(job.jobNumber);
    expect(missingResponse.status).toBe(404);
  });

  it("PATCH and DELETE /estimates/:id work for drafts and reject sent estimates", async () => {
    const auth = createAuthContext();
    const { customer } = seedEstimateGraph(auth.company.id);
    const draftEstimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "draft",
      title: "Draft Estimate"
    });
    const sentEstimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "sent",
      title: "Sent Estimate"
    });

    const patchSuccess = await request(app.server)
      .patch(`/api/v1/estimates/${draftEstimate.id}`)
      .set("Authorization", auth.authorization)
      .send({
        title: "Updated Draft"
      });
    const patchConflict = await request(app.server)
      .patch(`/api/v1/estimates/${sentEstimate.id}`)
      .set("Authorization", auth.authorization)
      .send({
        title: "Nope"
      });
    const deleteSuccess = await request(app.server)
      .delete(`/api/v1/estimates/${draftEstimate.id}`)
      .set("Authorization", auth.authorization);
    const deleteConflict = await request(app.server)
      .delete(`/api/v1/estimates/${sentEstimate.id}`)
      .set("Authorization", auth.authorization);

    expect(patchSuccess.status).toBe(200);
    expect(patchSuccess.body.estimate.title).toBe("Updated Draft");
    expect(patchConflict.status).toBe(409);
    expect(deleteSuccess.status).toBe(204);
    expect(deleteConflict.status).toBe(409);
  });

  it("POST /estimates/:id/send enqueues notification delivery and follow-up using the rule delay", async () => {
    const auth = createAuthContext();
    const { customer } = seedEstimateGraph(auth.company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "draft",
      title: "Send Estimate",
      total: "175.00",
      subtotal: "175.00"
    });
    fakeDb.seedEstimateItem({
      companyId: auth.company.id,
      estimateId: estimate.id,
      name: "Diagnostics",
      quantity: "1.000",
      unitPrice: "175.00",
      total: "175.00"
    });
    fakeDb.seedAutomationRule({
      companyId: auth.company.id,
      ruleType: "estimate_follow_up",
      isEnabled: true,
      delayHours: 24
    });

    const response = await request(app.server)
      .post(`/api/v1/estimates/${estimate.id}/send`)
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.estimate.status).toBe("sent");
    expect(addNotificationQueueJob).toHaveBeenCalledWith(
      "send-estimate-email",
      {
        companyId: auth.company.id,
        estimateId: estimate.id,
        customerId: customer.id
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
    expect(addAiQueueJob).toHaveBeenCalledWith(
      "estimate-follow-up-check",
      {
        companyId: auth.company.id,
        estimateId: estimate.id,
        customerId: customer.id
      },
      {
        attempts: 3,
        delay: 24 * 60 * 60 * 1000,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
  });

  it("approve, decline, and revise estimate routes execute their lifecycle actions", async () => {
    const auth = createAuthContext();
    const { customer, property, job } = seedEstimateGraph(auth.company.id);
    const approveEstimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      status: "sent",
      title: "Approve Estimate"
    });
    const declineEstimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "sent",
      title: "Decline Estimate"
    });
    const reviseEstimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      status: "sent",
      title: "Revise Estimate",
      subtotal: "100.00",
      total: "100.00"
    });
    fakeDb.seedEstimateItem({
      companyId: auth.company.id,
      estimateId: reviseEstimate.id,
      name: "Existing Item",
      quantity: "1.000",
      unitPrice: "100.00",
      total: "100.00"
    });
    fakeDb.seedAutomationRule({
      companyId: auth.company.id,
      ruleType: "estimate_declined",
      isEnabled: true
    });

    const approveResponse = await request(app.server)
      .post(`/api/v1/estimates/${approveEstimate.id}/approve`)
      .set("Authorization", auth.authorization);
    const declineResponse = await request(app.server)
      .post(`/api/v1/estimates/${declineEstimate.id}/decline`)
      .set("Authorization", auth.authorization)
      .send({
        reason: "Budget"
      });
    const reviseResponse = await request(app.server)
      .post(`/api/v1/estimates/${reviseEstimate.id}/revise`)
      .set("Authorization", auth.authorization);

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.estimate.status).toBe("approved");
    expect(declineResponse.status).toBe(200);
    expect(declineResponse.body.estimate.status).toBe("declined");
    expect(addAiQueueJob).toHaveBeenCalledWith(
      "evaluate-revenue-opportunities",
      {
        companyId: auth.company.id,
        estimateId: declineEstimate.id,
        customerId: customer.id,
        trigger: "estimate.declined"
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
    expect(reviseResponse.status).toBe(200);
    expect(reviseResponse.body.estimate.status).toBe("draft");
    expect(reviseResponse.body.estimate.id).not.toBe(reviseEstimate.id);
  });

  it("estimate item routes list, add, update, and remove line items", async () => {
    const auth = createAuthContext();
    const { customer } = seedEstimateGraph(auth.company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "draft",
      title: "Items Estimate"
    });

    const addResponse = await request(app.server)
      .post(`/api/v1/estimates/${estimate.id}/items`)
      .set("Authorization", auth.authorization)
      .send({
        name: "Labor",
        quantity: "2",
        unitPrice: "75"
      });
    const itemId = addResponse.body.item.id as string;
    const listResponse = await request(app.server)
      .get(`/api/v1/estimates/${estimate.id}/items`)
      .set("Authorization", auth.authorization);
    const updateResponse = await request(app.server)
      .patch(`/api/v1/estimates/${estimate.id}/items/${itemId}`)
      .set("Authorization", auth.authorization)
      .send({
        quantity: "3"
      });
    const deleteResponse = await request(app.server)
      .delete(`/api/v1/estimates/${estimate.id}/items/${itemId}`)
      .set("Authorization", auth.authorization);

    expect(addResponse.status).toBe(201);
    expect(listResponse.status).toBe(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.item.total).toBe("225.00");
    expect(deleteResponse.status).toBe(204);
  });

  it("POST /estimates/:id/convert creates a job and rejects non-approved estimates", async () => {
    const auth = createAuthContext();
    const { customer, property, job } = seedEstimateGraph(auth.company.id);
    const approvedEstimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      status: "approved",
      total: "275.00"
    });
    const draftEstimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "draft"
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/estimates/${approvedEstimate.id}/convert`)
      .set("Authorization", auth.authorization);
    const conflictResponse = await request(app.server)
      .post(`/api/v1/estimates/${draftEstimate.id}/convert`)
      .set("Authorization", auth.authorization);

    expect(successResponse.status).toBe(201);
    expect(successResponse.body.job.estimateTotal).toBe("275.00");
    expect(conflictResponse.status).toBe(409);
  });

  it("GET /public/estimates/:token works without auth and rejects missing or expired tokens", async () => {
    const auth = createAuthContext();
    const { customer, property, job } = seedEstimateGraph(auth.company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      status: "sent",
      approvalToken: "x".repeat(32),
      expiresAt: new Date("2026-05-28T00:00:00.000Z")
    });
    fakeDb.seedEstimateItem({
      companyId: auth.company.id,
      estimateId: estimate.id,
      name: "Public Item",
      quantity: "1.000",
      unitPrice: "50.00",
      total: "50.00"
    });
    const expiredEstimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "sent",
      approvalToken: "y".repeat(32),
      expiresAt: new Date("2026-04-01T00:00:00.000Z")
    });

    const successResponse = await request(app.server).get(`/api/v1/public/estimates/${estimate.approvalToken}`);
    const missingResponse = await request(app.server).get(`/api/v1/public/estimates/${"z".repeat(32)}`);
    const expiredResponse = await request(app.server).get(`/api/v1/public/estimates/${expiredEstimate.approvalToken}`);

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.scheduling).toBeNull();
    expect(successResponse.body.estimate.status).toBe("viewed");
    expect(successResponse.body.estimate.customer).toBeUndefined();
    expect(successResponse.body.estimate.property).toBeUndefined();
    expect(successResponse.body.estimate.job).toBeUndefined();
    expect(successResponse.body.estimate.id).toBeUndefined();
    expect(successResponse.body.estimate.items).toEqual([
      {
        name: "Public Item",
        description: null,
        quantity: "1.000",
        unitPrice: "50.00",
        total: "50.00"
      }
    ]);
    expect(missingResponse.status).toBe(404);
    expect(expiredResponse.status).toBe(409);
  });

  it("GET /public/estimates/:token returns scheduling only when estimate is approved", async () => {
    const auth = createAuthContext();
    const { customer, property, job } = seedEstimateGraph(auth.company.id);
    fakeDb.seedBookingSettings({
      companyId: auth.company.id,
      isEnabled: true,
      bookingSlug: "sparkle-co"
    });
    const estimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      status: "sent",
      approvalToken: "p".repeat(32),
      expiresAt: new Date("2026-05-28T00:00:00.000Z")
    });

    const beforeApprove = await request(app.server).get(`/api/v1/public/estimates/${estimate.approvalToken}`);
    expect(beforeApprove.status).toBe(200);
    expect(beforeApprove.body.scheduling).toBeNull();

    const approveResponse = await request(app.server)
      .post(`/api/v1/public/estimates/${estimate.approvalToken}/approve`)
      .send({ approvedByName: "Jane Doe" });
    expect(approveResponse.status).toBe(200);

    const afterApprove = await request(app.server).get(`/api/v1/public/estimates/${estimate.approvalToken}`);
    expect(afterApprove.status).toBe(200);
    expect(afterApprove.body.scheduling).toMatchObject({
      bookingSlug: "sparkle-co",
      zip: property.zip
    });
    expect(afterApprove.body.scheduling.customer.firstName).toBe(customer.firstName);
  });

  it("POST /public/estimates/:token/approve works without auth and rejects repeat approvals", async () => {
    const auth = createAuthContext();
    const { customer } = seedEstimateGraph(auth.company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "sent",
      approvalToken: "a".repeat(32),
      expiresAt: new Date("2026-05-28T00:00:00.000Z")
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/public/estimates/${estimate.approvalToken}/approve`)
      .send({
        approvedByName: "Chris Pine"
      });
    const conflictResponse = await request(app.server)
      .post(`/api/v1/public/estimates/${estimate.approvalToken}/approve`)
      .send({
        approvedByName: "Chris Pine"
      });

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.success).toBe(true);
    expect(conflictResponse.status).toBe(409);
  });

  it("POST /public/estimates/:token/decline works without auth and enqueues AI evaluation", async () => {
    const auth = createAuthContext();
    const { customer } = seedEstimateGraph(auth.company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: auth.company.id,
      customerId: customer.id,
      status: "sent",
      approvalToken: "b".repeat(32),
      expiresAt: new Date("2026-05-28T00:00:00.000Z")
    });
    fakeDb.seedAutomationRule({
      companyId: auth.company.id,
      ruleType: "estimate_declined",
      isEnabled: true
    });

    const response = await request(app.server)
      .post(`/api/v1/public/estimates/${estimate.approvalToken}/decline`)
      .send({
        reason: "Need more time"
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(addAiQueueJob).toHaveBeenCalledWith(
      "evaluate-revenue-opportunities",
      {
        companyId: auth.company.id,
        estimateId: estimate.id,
        customerId: customer.id,
        trigger: "estimate.declined"
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
  });
});
