import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";
import { usePinnedTestSystemTime } from "../test-support/pinned-test-time.js";

setupTestEnv();
usePinnedTestSystemTime();

const { addAiQueueJob, addNotificationQueueJob } = vi.hoisted(() => ({
  addAiQueueJob: vi.fn(),
  addNotificationQueueJob: vi.fn()
}));

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
  notificationsQueue: {
    add: addNotificationQueueJob
  }
}));

type EstimateServiceModule = typeof import("./estimate.service.js");
type EstimateItemsServiceModule = typeof import("./estimate-items.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let estimateService: EstimateServiceModule;
let estimateItemsService: EstimateItemsServiceModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  estimateService = await import("./estimate.service.js");
  estimateItemsService = await import("./estimate-items.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  addAiQueueJob.mockReset();
  addNotificationQueueJob.mockReset();
});

function createAdminContext() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago"
  });
  const actor = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@example.com",
    firstName: "Ava",
    lastName: "Stone",
    role: "owner"
  });

  return { company, actor };
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

describe("estimate.service", () => {
  it("denies non-office list and item service calls before any database access", async () => {
    const { company } = createAdminContext();
    const technician = fakeDb.seedUser({ companyId: company.id, email: "tech-direct@example.com",
      firstName: "Tess", lastName: "Tech", role: "technician" });
    const actor = { companyId: company.id, userId: technician.id, role: technician.role };
    const selectSpy = vi.spyOn(fakeDb.db, "select");
    const transactionSpy = vi.spyOn(fakeDb.db, "transaction");
    try {
      await expect(estimateService.listEstimates(actor, {})).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
      await expect(estimateItemsService.addItem(actor, randomUUID(), {
        name: "Blocked", quantity: "1", unitPrice: "1.00"
      })).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
      await expect(estimateItemsService.updateItem(actor, randomUUID(), randomUUID(), {
        name: "Blocked"
      })).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
      await expect(estimateItemsService.removeItem(actor, randomUUID(), randomUUID()))
        .rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
      expect(selectSpy).not.toHaveBeenCalled();
      expect(transactionSpy).not.toHaveBeenCalled();
    } finally {
      selectSpy.mockRestore();
      transactionSpy.mockRestore();
    }
  });

  it("allows active admin and dispatcher through list and item service operations", async () => {
    const { company } = createAdminContext();
    const admin = fakeDb.seedUser({ companyId: company.id, email: "admin@example.com",
      firstName: "A", lastName: "Admin", role: "admin" });
    const dispatcher = fakeDb.seedUser({ companyId: company.id, email: "dispatch@example.com",
      firstName: "D", lastName: "Dispatcher", role: "dispatcher" });
    const adminActor = { companyId: company.id, userId: admin.id, role: admin.role };
    const dispatcherActor = { companyId: company.id, userId: dispatcher.id, role: dispatcher.role };
    const { customer } = seedEstimateGraph(company.id);
    const estimate = fakeDb.seedEstimate({ companyId: company.id, customerId: customer.id, status: "draft" });
    expect((await estimateService.listEstimates(adminActor, {})).total).toBe(1);
    const item = await estimateItemsService.addItem(dispatcherActor, estimate.id, {
      name: "Diagnostic", quantity: "1", unitPrice: "25.00"
    });
    expect((await estimateItemsService.updateItem(adminActor, estimate.id, item.id,
      { quantity: "2" })).total).toBe("50.00");
    await estimateItemsService.removeItem(dispatcherActor, estimate.id, item.id);
    expect((await estimateItemsService.listItems(company.id, estimate.id))).toHaveLength(0);
  });

  it("rejects a technician mutation at the service boundary without a state event", async () => {
    const { company, actor: owner } = createAdminContext();
    const technician = fakeDb.seedUser({ companyId: company.id, email: "tech@example.com",
      firstName: "Tess", lastName: "Tech", role: "technician" });
    const { customer } = seedEstimateGraph(company.id);
    const estimate = fakeDb.seedEstimate({ companyId: company.id, customerId: customer.id,
      title: "Unchanged", status: "draft" });
    const eventsBefore = fakeDb.getTestState().activityEvents.length;
    await expect(estimateService.updateEstimate(company.id, technician.id, estimate.id,
      { title: "Forbidden" })).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    fakeDb.getTestState().users.find((user) => user.id === owner.id)!.isActive = false;
    await expect(estimateService.updateEstimate(company.id, owner.id, estimate.id,
      { title: "Also forbidden" })).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(fakeDb.getTestState().estimates.find((row) => row.id === estimate.id)?.title).toBe("Unchanged");
    expect(fakeDb.getTestState().activityEvents).toHaveLength(eventsBefore);
  });
  it("listEstimates paginates and filters by status, customer, job, and title search", async () => {
    const { company, actor } = createAdminContext();
    const staff = { companyId: company.id, userId: actor.id, role: actor.role };
    const { customer, job } = seedEstimateGraph(company.id);
    const otherCustomer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Jamie",
      lastName: "Miles"
    });

    fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      jobId: job.id,
      title: "Gold Package",
      status: "sent",
      total: "450.00",
      subtotal: "400.00",
      createdAt: new Date("2026-04-28T09:00:00.000Z")
    });
    fakeDb.seedEstimate({
      companyId: company.id,
      customerId: otherCustomer.id,
      title: "Silver Package",
      status: "draft",
      total: "250.00",
      subtotal: "250.00",
      createdAt: new Date("2026-04-28T10:00:00.000Z")
    });

    const filtered = await estimateService.listEstimates(staff, {
      status: "sent",
      customerId: customer.id,
      jobId: job.id,
      search: "gold"
    });
    const paginated = await estimateService.listEstimates(staff, {
      page: 2,
      limit: 1
    });

    expect(filtered.total).toBe(1);
    expect(filtered.data[0]?.title).toBe("Gold Package");
    expect(paginated.total).toBe(2);
    expect(paginated.page).toBe(2);
    expect(paginated.data).toHaveLength(1);
    expect(paginated.data[0]?.title).toBe("Gold Package");
  });

  it("getEstimate returns detail with nested items and throws NOT_FOUND for unknown or cross-tenant ids", async () => {
    const { company } = createAdminContext();
    const { customer, property, job } = seedEstimateGraph(company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      title: "Detail Estimate",
      total: "325.00",
      subtotal: "300.00"
    });
    fakeDb.seedEstimateItem({
      companyId: company.id,
      estimateId: estimate.id,
      name: "Diagnostics",
      quantity: "1.000",
      unitPrice: "300.00",
      total: "300.00"
    });

    const otherCompany = fakeDb.seedCompany({
      name: "Other HVAC",
      slug: "other-hvac"
    });
    const otherCustomer = fakeDb.seedCustomer({
      companyId: otherCompany.id,
      firstName: "Other",
      lastName: "Customer"
    });
    const otherEstimate = fakeDb.seedEstimate({
      companyId: otherCompany.id,
      customerId: otherCustomer.id,
      title: "Other Estimate"
    });

    const detail = await estimateService.getEstimate(company.id, estimate.id);

    expect(detail.customer.email).toBe("chris@example.com");
    expect(detail.property?.addressLine1).toBe("101 Main St");
    expect(detail.job?.jobNumber).toBe(job.jobNumber);
    expect(detail.items).toHaveLength(1);

    await expect(estimateService.getEstimate(company.id, randomUUID())).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
    await expect(estimateService.getEstimate(company.id, otherEstimate.id)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });

  it("createEstimate creates items, calculates totals, and rejects cross-tenant customers", async () => {
    const { company, actor } = createAdminContext();
    const { customer, property, job } = seedEstimateGraph(company.id);
    const created = await estimateService.createEstimate(company.id, actor.id, {
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      title: "New Estimate",
      taxRate: "0.1",
      discountAmount: "5",
      items: [
        {
          name: "Labor",
          quantity: "2",
          unitPrice: "50"
        },
        {
          name: "Material",
          quantity: "1",
          unitPrice: "25",
          isTaxable: false
        }
      ]
    });

    expect(created.estimateNumber).toBe("EST-0001");
    expect(created.status).toBe("draft");
    expect(created.subtotal).toBe("125.00");
    expect(created.taxAmount).toBe("10.00");
    expect(created.total).toBe("130.00");
    expect(fakeDb.getTestState().estimateItems).toHaveLength(2);
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("estimate.created");

    const otherCompany = fakeDb.seedCompany({
      name: "Other HVAC",
      slug: "other-hvac"
    });
    const otherCustomer = fakeDb.seedCustomer({
      companyId: otherCompany.id,
      firstName: "Other",
      lastName: "Customer"
    });

    await expect(
      estimateService.createEstimate(company.id, actor.id, {
        customerId: otherCustomer.id,
        title: "Cross Tenant"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });

  it("updateEstimate succeeds for drafts and rejects sent estimates", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const draftEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      title: "Draft Estimate",
      taxRate: "0.0500",
      subtotal: "200.00",
      taxAmount: "10.00",
      discountAmount: "0.00",
      total: "210.00",
      status: "draft"
    });
    fakeDb.seedEstimateItem({
      companyId: company.id,
      estimateId: draftEstimate.id,
      name: "Service",
      quantity: "2.000",
      unitPrice: "100.00",
      total: "200.00"
    });

    const updated = await estimateService.updateEstimate(company.id, actor.id, draftEstimate.id, {
      title: "Updated Draft Estimate",
      discountAmount: "10"
    });

    expect(updated.title).toBe("Updated Draft Estimate");
    expect(updated.discountAmount).toBe("10.00");
    expect(updated.total).toBe("200.00");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("estimate.updated");

    const sentEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "sent",
      title: "Sent Estimate"
    });

    await expect(
      estimateService.updateEstimate(company.id, actor.id, sentEstimate.id, {
        title: "Nope"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("deleteEstimate soft deletes draft estimates and items and rejects non-draft deletes", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const draftEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      title: "Delete Me",
      status: "draft"
    });
    const item = fakeDb.seedEstimateItem({
      companyId: company.id,
      estimateId: draftEstimate.id,
      name: "Service"
    });

    await estimateService.deleteEstimate(company.id, actor.id, draftEstimate.id);

    expect(fakeDb.getTestState().estimates.find((row) => row.id === draftEstimate.id)?.deletedAt).toBeInstanceOf(Date);
    expect(fakeDb.getTestState().estimateItems.find((row) => row.id === item.id)?.deletedAt).toBeInstanceOf(Date);
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("estimate.deleted");

    const sentEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "sent"
    });

    await expect(estimateService.deleteEstimate(company.id, actor.id, sentEstimate.id)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("estimate item services add, list, update, remove, and recalculate totals", async () => {
    const { company, actor } = createAdminContext();
    const staff = { companyId: company.id, userId: actor.id, role: actor.role };
    const { customer } = seedEstimateGraph(company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "draft",
      taxRate: "0.0825",
      discountAmount: "10.00"
    });

    const added = await estimateItemsService.addItem(staff, estimate.id, {
      name: "Labor",
      quantity: "2",
      unitPrice: "100",
      sortOrder: 1
    });
    const second = await estimateItemsService.addItem(staff, estimate.id, {
      name: "Material",
      quantity: "1",
      unitPrice: "50",
      isTaxable: false,
      sortOrder: 2
    });
    const listed = await estimateItemsService.listItems(company.id, estimate.id);
    const updated = await estimateItemsService.updateItem(staff, estimate.id, added.id, {
      quantity: "3",
      unitPrice: "80"
    });

    expect(listed).toHaveLength(2);
    expect(updated.total).toBe("240.00");

    await estimateItemsService.recalculateTotals(
      company.id,
      estimate.id,
      fakeDb.db as unknown as Parameters<EstimateItemsServiceModule["recalculateTotals"]>[2]
    );
    const recalculatedEstimate = fakeDb.getTestState().estimates.find((row) => row.id === estimate.id);
    expect(recalculatedEstimate?.subtotal).toBe("290.00");
    expect(recalculatedEstimate?.taxAmount).toBe("19.80");
    expect(recalculatedEstimate?.total).toBe("299.80");

    await estimateItemsService.removeItem(staff, estimate.id, second.id);
    const remainingItems = await estimateItemsService.listItems(company.id, estimate.id);
    const removedItem = fakeDb.getTestState().estimateItems.find((row) => row.id === second.id);

    expect(remainingItems).toHaveLength(1);
    expect(removedItem?.deletedAt).toBeInstanceOf(Date);
  });

  it("sendEstimate sets token/expiry and enqueues notification plus delayed AI when enabled", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "draft",
      title: "Send Me",
      total: "175.00",
      subtotal: "175.00",
      messageToCustomer: "Please review this quote."
    });
    fakeDb.seedEstimateItem({
      companyId: company.id,
      estimateId: estimate.id,
      name: "Diagnostics",
      quantity: "1.000",
      unitPrice: "175.00",
      total: "175.00"
    });
    fakeDb.seedAutomationRule({
      companyId: company.id,
      ruleType: "estimate_follow_up",
      isEnabled: true,
      delayHours: 24
    });

    const sent = await estimateService.sendEstimate(company.id, actor.id, estimate.id);

    expect(sent.status).toBe("sent");
    expect(sent.approvalToken).toBeTruthy();
    expect(sent.approvalToken?.length).toBeGreaterThanOrEqual(32);
    expect(sent.expiresAt?.getTime()).toBe((sent.sentAt?.getTime() ?? 0) + 30 * 24 * 60 * 60 * 1000);
    expect(addNotificationQueueJob).toHaveBeenCalledWith(
      "send-estimate-email",
      {
        companyId: company.id,
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
        companyId: company.id,
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
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("estimate.sent");
  });

  it("approveEstimate approves sent estimates and rejects already approved estimates", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const sentEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "sent"
    });

    const approved = await estimateService.approveEstimate(company.id, actor.id, sentEstimate.id);

    expect(approved.status).toBe("approved");
    expect(approved.approvedByName).toBe("Ava Stone");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("estimate.approved");

    const alreadyApproved = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "approved"
    });

    await expect(estimateService.approveEstimate(company.id, actor.id, alreadyApproved.id)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("declineEstimate declines and enqueues AI evaluation when enabled", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const sentEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "sent"
    });
    fakeDb.seedAutomationRule({
      companyId: company.id,
      ruleType: "estimate_declined",
      isEnabled: true
    });

    const declined = await estimateService.declineEstimate(company.id, actor.id, sentEstimate.id, "Too expensive");

    expect(declined.status).toBe("declined");
    expect(declined.declineReason).toBe("Too expensive");
    expect(addAiQueueJob).toHaveBeenCalledWith(
      "evaluate-revenue-opportunities",
      {
        companyId: company.id,
        estimateId: sentEstimate.id,
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

  it("reviseEstimate creates a new draft revision, copies items, and marks the original revised", async () => {
    const { company, actor } = createAdminContext();
    const { customer, property, job } = seedEstimateGraph(company.id);
    const original = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      status: "sent",
      title: "Original Estimate",
      subtotal: "100.00",
      total: "100.00"
    });
    fakeDb.seedEstimateItem({
      companyId: company.id,
      estimateId: original.id,
      name: "Existing Item",
      quantity: "1.000",
      unitPrice: "100.00",
      total: "100.00"
    });

    const revised = await estimateService.reviseEstimate(company.id, actor.id, original.id);

    expect(revised.id).not.toBe(original.id);
    expect(revised.status).toBe("draft");
    expect(revised.estimateNumber).toBe("EST-0002");
    expect(fakeDb.getTestState().estimates.find((row) => row.id === original.id)?.status).toBe("revised");
    expect(fakeDb.getTestState().estimateItems.filter((row) => row.estimateId === revised.id)).toHaveLength(1);
    expect(fakeDb.getTestState().activityEvents.at(-2)?.eventType).toBe("estimate.revised");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("estimate.created");
  });

  it("convertToJob creates a job from an approved estimate and rejects non-approved estimates", async () => {
    const { company, actor } = createAdminContext();
    const { customer, property, job } = seedEstimateGraph(company.id);
    const approvedEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      status: "approved",
      title: "Approved Estimate",
      total: "275.00"
    });

    const createdJob = await estimateService.convertToJob(company.id, actor.id, approvedEstimate.id);

    expect(createdJob.customerId).toBe(customer.id);
    expect(createdJob.propertyId).toBe(property.id);
    expect(createdJob.parentJobId).toBe(job.id);
    expect(createdJob.estimateTotal).toBe("275.00");
    expect(fakeDb.getTestState().estimates.find((row) => row.id === approvedEstimate.id)?.status).toBe("converted");
    expect(fakeDb.getTestState().activityEvents.at(-2)?.eventType).toBe("estimate.converted");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("job.created");

    const draftEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "draft"
    });

    await expect(estimateService.convertToJob(company.id, actor.id, draftEstimate.id)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("getPublicEstimateSchedulingContext returns booking context when online booking is enabled", async () => {
    const { company } = createAdminContext();
    const { customer, property, job } = seedEstimateGraph(company.id);
    fakeDb.seedBookingSettings({
      companyId: company.id,
      isEnabled: true,
      bookingSlug: "sparkle-co"
    });
    const estimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      status: "sent",
      approvalToken: "s".repeat(32),
      expiresAt: new Date("2026-05-28T00:00:00.000Z")
    });

    const scheduling = await estimateService.getPublicEstimateSchedulingContext(estimate.approvalToken ?? "");

    expect(scheduling).toMatchObject({
      companyName: company.name,
      bookingSlug: "sparkle-co",
      zip: property.zip,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone
      },
      property: {
        addressLine1: property.addressLine1,
        city: property.city,
        state: property.state,
        zip: property.zip
      }
    });
  });

  it("getPublicEstimate returns a customer-safe view, marks viewedAt, and rejects expired tokens", async () => {
    const { company } = createAdminContext();
    const { customer, property, job } = seedEstimateGraph(company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      jobId: job.id,
      status: "sent",
      title: "Public Estimate",
      approvalToken: "x".repeat(32),
      internalNotes: "Only staff should see this",
      expiresAt: new Date("2026-05-28T00:00:00.000Z")
    });
    fakeDb.seedEstimateItem({
      companyId: company.id,
      estimateId: estimate.id,
      name: "Public Item",
      quantity: "1.000",
      unitPrice: "50.00",
      total: "50.00"
    });

    const view = await estimateService.getPublicEstimate(estimate.approvalToken ?? "");
    const publicShape = view as unknown as Record<string, unknown>;

    expect(view.status).toBe("viewed");
    expect(view.estimateNumber).toBe(estimate.estimateNumber);
    expect(view.messageToCustomer).toBe(estimate.messageToCustomer);
    expect(view.items).toHaveLength(1);
    expect(publicShape.id).toBeUndefined();
    expect(publicShape.customer).toBeUndefined();
    expect(publicShape.property).toBeUndefined();
    expect(publicShape.job).toBeUndefined();
    expect(publicShape.createdAt).toBeUndefined();
    expect(publicShape.internalNotes).toBeUndefined();
    expect(view.items[0]).toEqual({
      name: "Public Item",
      description: null,
      quantity: "1.000",
      unitPrice: "50.00",
      total: "50.00"
    });
    expect(fakeDb.getTestState().estimates.find((row) => row.id === estimate.id)?.viewedAt).toBeInstanceOf(Date);
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("estimate.viewed");

    const expiredEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      approvalToken: "y".repeat(32),
      expiresAt: new Date("2026-04-01T00:00:00.000Z")
    });

    await expect(
      estimateService.getPublicEstimate(expiredEstimate.approvalToken ?? "")
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("customerApproveEstimate succeeds and rejects expired or already actioned estimates", async () => {
    const { company } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "sent",
      approvalToken: "a".repeat(32),
      expiresAt: new Date("2026-05-28T00:00:00.000Z")
    });

    await estimateService.customerApproveEstimate(estimate.approvalToken ?? "", "Chris Pine", "https://example.com/signature.png");

    const approvedEstimate = fakeDb.getTestState().estimates.find((row) => row.id === estimate.id);
    expect(approvedEstimate?.status).toBe("approved");
    expect(approvedEstimate?.approvedByName).toBe("Chris Pine");
    expect(approvedEstimate?.approvedSignatureUrl).toBe("https://example.com/signature.png");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.actorType).toBe("customer");

    await expect(
      estimateService.customerApproveEstimate(estimate.approvalToken ?? "", "Chris Pine")
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });

    const expiredEstimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "sent",
      approvalToken: "b".repeat(32),
      expiresAt: new Date("2026-04-01T00:00:00.000Z")
    });

    await expect(
      estimateService.customerApproveEstimate(expiredEstimate.approvalToken ?? "", "Chris Pine")
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("customerDeclineEstimate declines via token and enqueues AI evaluation when enabled", async () => {
    const { company } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "sent",
      approvalToken: "c".repeat(32),
      expiresAt: new Date("2026-05-28T00:00:00.000Z")
    });
    fakeDb.seedAutomationRule({
      companyId: company.id,
      ruleType: "estimate_declined",
      isEnabled: true
    });

    await estimateService.customerDeclineEstimate(estimate.approvalToken ?? "", "Need more time");

    const declinedEstimate = fakeDb.getTestState().estimates.find((row) => row.id === estimate.id);
    expect(declinedEstimate?.status).toBe("declined");
    expect(declinedEstimate?.declineReason).toBe("Need more time");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.actorType).toBe("customer");
    expect(addAiQueueJob).toHaveBeenCalledWith(
      "evaluate-revenue-opportunities",
      {
        companyId: company.id,
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

describe("estimate money contract (FS-174)", () => {
  it("rounds each fractional-quantity line before summing the subtotal", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const estimate = await estimateService.createEstimate(company.id, actor.id, {
      customerId: customer.id,
      items: ["First", "Second", "Third"].map((name) => ({
        name,
        quantity: "0.333",
        unitPrice: "0.05"
      }))
    });
    const detail = await estimateService.getEstimate(company.id, estimate.id);

    expect(detail.items.map((item) => item.total)).toEqual(["0.02", "0.02", "0.02"]);
    expect(estimate.subtotal).toBe("0.06");
    expect(estimate.total).toBe("0.06");
  });

  it("calculates tax on taxable lines before subtracting an estimate discount", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const estimate = await estimateService.createEstimate(company.id, actor.id, {
      customerId: customer.id,
      taxRate: "0.1",
      discountAmount: "10",
      items: [{ name: "Service", quantity: "1", unitPrice: "100" }]
    });

    expect(estimate.subtotal).toBe("100.00");
    expect(estimate.taxAmount).toBe("10.00");
    expect(estimate.discountAmount).toBe("10.00");
    expect(estimate.total).toBe("100.00");
  });

  it("uses normalized decimal strings when extending a line", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const estimate = await estimateService.createEstimate(company.id, actor.id, {
      customerId: customer.id,
      items: [{ name: "Precision edge", quantity: "3", unitPrice: "1.01" }]
    });
    const detail = await estimateService.getEstimate(company.id, estimate.id);

    expect(detail.items[0]?.unitPrice).toBe("1.01");
    expect(detail.items[0]?.total).toBe("3.03");
    expect(estimate.total).toBe("3.03");
  });

  it("rejects negative totals on create, update, and item removal", async () => {
    const { company, actor } = createAdminContext();
    const staff = { companyId: company.id, userId: actor.id, role: actor.role };
    const { customer } = seedEstimateGraph(company.id);

    await expect(estimateService.createEstimate(company.id, actor.id, {
      customerId: customer.id,
      discountAmount: "0.01"
    })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    const estimate = await estimateService.createEstimate(company.id, actor.id, {
      customerId: customer.id,
      items: [{ name: "Primary", quantity: "1", unitPrice: "10.00" }]
    });
    await expect(estimateService.updateEstimate(company.id, actor.id, estimate.id, {
      discountAmount: "10.01"
    })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    await estimateService.updateEstimate(company.id, actor.id, estimate.id, { discountAmount: "5.00" });
    const smallItem = await estimateItemsService.addItem(staff, estimate.id, {
      name: "Small",
      quantity: "1",
      unitPrice: "2.00"
    });
    const primaryItem = (await estimateItemsService.listItems(company.id, estimate.id))
      .find((item) => item.id !== smallItem.id);
    expect(primaryItem).toBeDefined();
    await expect(
      estimateItemsService.removeItem(staff, estimate.id, primaryItem!.id)
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect((await estimateItemsService.listItems(company.id, estimate.id))).toHaveLength(2);
  });

  it("rejects decimal precision and computed amounts outside database bounds", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);

    await expect(estimateService.createEstimate(company.id, actor.id, {
      customerId: customer.id,
      items: [{ name: "Too precise", quantity: "1.0000", unitPrice: "1.00" }]
    })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });

    await expect(estimateService.createEstimate(company.id, actor.id, {
      customerId: customer.id,
      items: [{ name: "Overflow", quantity: "9999999.999", unitPrice: "99999999.99" }]
    })).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
  });

  it("recalculates and rejects a negative total before sending", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedEstimateGraph(company.id);
    const estimate = fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      status: "draft",
      discountAmount: "1.00",
      total: "0.00"
    });

    await expect(estimateService.sendEstimate(company.id, actor.id, estimate.id))
      .rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(fakeDb.getTestState().estimates.find((row) => row.id === estimate.id)?.status).toBe("draft");
    expect(addNotificationQueueJob).not.toHaveBeenCalled();
  });
});
