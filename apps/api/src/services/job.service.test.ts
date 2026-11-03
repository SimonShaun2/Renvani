import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const { addQueueJob, redisDelMock, redisGetMock, redisSetMock } = vi.hoisted(() => ({
  addQueueJob: vi.fn(),
  redisDelMock: vi.fn(async () => 1),
  redisGetMock: vi.fn(async () => null),
  redisSetMock: vi.fn(async () => "OK")
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
    add: addQueueJob
  },
  redisConnection: {
    get: redisGetMock,
    set: redisSetMock,
    del: redisDelMock
  }
}));

type JobServiceModule = typeof import("./job.service.js");
type JobStateMachineModule = typeof import("../lib/job-state-machine.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let jobService: JobServiceModule;
let stateMachine: JobStateMachineModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  jobService = await import("./job.service.js");
  stateMachine = await import("../lib/job-state-machine.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  addQueueJob.mockReset();
  redisDelMock.mockClear();
  redisGetMock.mockClear();
  redisSetMock.mockClear();
});

function createAdminContext() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago"
  });
  const actor = fakeDb.seedUser({
    companyId: company.id,
    email: "admin@example.com",
    firstName: "Ava",
    lastName: "Stone",
    role: "admin"
  });

  return { company, actor };
}

function seedJobGraph(companyId: string) {
  const customer = fakeDb.seedCustomer({
    companyId,
    firstName: "Chris",
    lastName: "Pine",
    lifetimeValue: "100.00",
    totalJobs: 2
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
    totalJobsCompleted: 4
  });

  return { customer, property, asset, technician };
}

describe("job state machine", () => {
  it("canTransition returns true for valid transitions and false for invalid transitions", () => {
    expect(stateMachine.canTransition("lead", "scheduled")).toBe(true);
    expect(stateMachine.canTransition("lead", "paid")).toBe(false);
  });

  it("transition returns the next status or throws CONFLICT with the current status", () => {
    expect(stateMachine.transition("scheduled", "dispatched")).toBe("dispatched");
    expect(stateMachine.transition("scheduled", "in_progress")).toBe("in_progress");
    expect(stateMachine.transition("cancelled", "lead")).toBe("lead");

    expect(() => stateMachine.transition("lead", "paid")).toThrowError(/lead to paid/i);
    expect(() => stateMachine.transition("cancelled", "scheduled")).toThrowError(
      /cancelled to scheduled/i
    );
  });

  it("getAvailableTransitions excludes the rescheduled event pseudo-status", () => {
    expect(stateMachine.getAvailableTransitions("scheduled")).toEqual([
      "dispatched",
      "in_progress",
      "on_hold",
      "cancelled"
    ]);
  });
});

describe("job.service", () => {
  it("listJobs returns paginated results and filters by status and technician", async () => {
    const { company } = createAdminContext();
    const { customer, technician } = seedJobGraph(company.id);
    const otherTechnician = fakeDb.seedTechnician({
      companyId: company.id,
      firstName: "Robin",
      lastName: "Route",
      phone: "555-0101"
    });

    fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      technicianId: technician.id,
      title: "Scheduled First",
      status: "scheduled",
      scheduledStart: new Date("2026-04-28T09:00:00.000Z")
    });
    fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      technicianId: otherTechnician.id,
      title: "Lead Second",
      status: "lead",
      scheduledStart: new Date("2026-04-28T10:00:00.000Z")
    });

    const paginated = await jobService.listJobs(company.id, {
      page: 2,
      limit: 1
    });
    const statusFiltered = await jobService.listJobs(company.id, {
      status: "scheduled"
    });
    const technicianFiltered = await jobService.listJobs(company.id, {
      technicianId: technician.id
    });

    expect(paginated.total).toBe(2);
    expect(paginated.page).toBe(2);
    expect(paginated.limit).toBe(1);
    expect(paginated.data).toHaveLength(1);
    expect(paginated.data[0]?.title).toBe("Lead Second");
    expect(statusFiltered.data).toHaveLength(1);
    expect(statusFiltered.data[0]?.status).toBe("scheduled");
    expect(technicianFiltered.data).toHaveLength(1);
    expect(technicianFiltered.data[0]?.technician?.id).toBe(technician.id);
  });

  it("getJob returns detail with transitions and throws NOT_FOUND for unknown or cross-tenant jobs", async () => {
    const { company } = createAdminContext();
    const { customer, property, asset, technician } = seedJobGraph(company.id);
    const otherCompany = fakeDb.seedCompany({
      name: "Other HVAC",
      slug: "other-hvac"
    });
    const otherCustomer = fakeDb.seedCustomer({
      companyId: otherCompany.id,
      firstName: "Other",
      lastName: "Customer"
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      assetId: asset.id,
      technicianId: technician.id,
      title: "Detail Job",
      status: "lead"
    });
    const crossTenantJob = fakeDb.seedJob({
      companyId: otherCompany.id,
      customerId: otherCustomer.id,
      title: "Other Job",
      status: "lead"
    });

    const detail = await jobService.getJob(company.id, job.id);

    expect(detail.id).toBe(job.id);
    expect(detail.availableTransitions).toEqual([
      "estimate_requested",
      "scheduled",
      "cancelled"
    ]);
    expect(detail.technician?.id).toBe(technician.id);

    await expect(jobService.getJob(company.id, randomUUID())).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
    await expect(jobService.getJob(company.id, crossTenantJob.id)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });

  it("createJob succeeds and emits job.created", async () => {
    const { company, actor } = createAdminContext();
    const { customer, property, asset, technician } = seedJobGraph(company.id);

    const result = await jobService.createJob(company.id, actor.id, {
      customerId: customer.id,
      propertyId: property.id,
      assetId: asset.id,
      technicianId: technician.id,
      title: "Spring Maintenance",
      tags: ["pm"]
    });

    expect(result.jobNumber).toBe("JOB-0001");
    expect(result.status).toBe("lead");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("job.created");
  });

  it("createJob rejects cross-tenant customers and property/customer mismatches", async () => {
    const { company, actor } = createAdminContext();
    const otherCompany = fakeDb.seedCompany({
      name: "Other HVAC",
      slug: "other-hvac"
    });
    const otherCustomer = fakeDb.seedCustomer({
      companyId: otherCompany.id,
      firstName: "Other",
      lastName: "Customer"
    });
    const { customer } = seedJobGraph(company.id);
    const otherProperty = fakeDb.seedProperty({
      companyId: company.id,
      customerId: customer.id,
      addressLine1: "202 Elm St",
      city: "Tulsa",
      state: "OK",
      zip: "74104"
    });
    const unrelatedCustomer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Jamie",
      lastName: "Mismatch"
    });

    await expect(
      jobService.createJob(company.id, actor.id, {
        customerId: otherCustomer.id,
        title: "Cross Tenant"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });

    await expect(
      jobService.createJob(company.id, actor.id, {
        customerId: unrelatedCustomer.id,
        propertyId: otherProperty.id,
        title: "Bad Property"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("transitionStatus succeeds for valid transitions and throws CONFLICT for invalid ones", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      status: "lead",
      title: "New Lead"
    });

    const updated = await jobService.transitionStatus(company.id, actor.id, job.id, "scheduled");

    expect(updated.status).toBe("scheduled");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("job.scheduled");

    await expect(
      jobService.transitionStatus(company.id, actor.id, job.id, "paid")
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      fields: {
        currentStatus: "scheduled",
        nextStatus: "paid"
      }
    });
  });

  it("transitionStatus reopens cancelled jobs to lead, emits job.reopened, and rejects cancelled to scheduled", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const cancelledJob = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      status: "cancelled",
      title: "Reopen Me"
    });
    const otherCancelledJob = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      status: "cancelled",
      title: "Stay Cancelled"
    });

    const reopened = await jobService.transitionStatus(company.id, actor.id, cancelledJob.id, "lead");

    expect(reopened.status).toBe("lead");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("job.reopened");

    await expect(
      jobService.transitionStatus(company.id, actor.id, otherCancelledJob.id, "scheduled")
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
      fields: {
        currentStatus: "cancelled",
        nextStatus: "scheduled"
      }
    });
  });

  it("assignTechnician updates the job and any existing schedule slot", async () => {
    const { company, actor } = createAdminContext();
    const { customer, technician } = seedJobGraph(company.id);
    const replacementTechnician = fakeDb.seedTechnician({
      companyId: company.id,
      firstName: "Robin",
      lastName: "Route",
      phone: "555-0101"
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      technicianId: technician.id,
      scheduledStart: new Date("2026-04-28T14:00:00.000Z"),
      scheduledEnd: new Date("2026-04-28T15:00:00.000Z"),
      title: "Assigned Job"
    });
    const slot = fakeDb.seedScheduleSlot({
      companyId: company.id,
      technicianId: technician.id,
      jobId: job.id,
      startTime: new Date("2026-04-28T14:00:00.000Z"),
      endTime: new Date("2026-04-28T15:00:00.000Z")
    });

    const updated = await jobService.assignTechnician(company.id, actor.id, job.id, replacementTechnician.id);

    expect(updated.technicianId).toBe(replacementTechnician.id);
    expect(fakeDb.getTestState().scheduleSlots.find((row) => row.id === slot.id)?.technicianId).toBe(
      replacementTechnician.id
    );

    const otherCompany = fakeDb.seedCompany({
      name: "Other Co",
      slug: "other-co"
    });
    const crossTenantTechnician = fakeDb.seedTechnician({
      companyId: otherCompany.id,
      firstName: "Cross",
      lastName: "Tenant",
      phone: "555-0102"
    });

    await expect(
      jobService.assignTechnician(company.id, actor.id, job.id, crossTenantTechnician.id)
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });

  it("scheduleJob creates slots when needed, skips them without a technician, and emits rescheduled when appropriate", async () => {
    const { company, actor } = createAdminContext();
    const { customer, technician } = seedJobGraph(company.id);
    const unscheduledJob = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "No Tech Yet",
      status: "lead"
    });
    const scheduledJob = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      technicianId: technician.id,
      title: "Already Scheduled",
      status: "scheduled",
      scheduledStart: new Date("2026-04-28T15:00:00.000Z"),
      scheduledEnd: new Date("2026-04-28T16:00:00.000Z")
    });

    const firstSchedule = await jobService.scheduleJob(company.id, actor.id, unscheduledJob.id, {
      scheduledStart: "2026-04-29T13:00:00.000Z",
      scheduledEnd: "2026-04-29T14:30:00.000Z"
    });

    expect(firstSchedule.status).toBe("scheduled");
    expect(fakeDb.getTestState().scheduleSlots).toHaveLength(0);
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("job.scheduled");

    const rescheduled = await jobService.scheduleJob(company.id, actor.id, scheduledJob.id, {
      scheduledStart: "2026-04-30T13:00:00.000Z",
      scheduledEnd: "2026-04-30T14:00:00.000Z"
    });

    expect(rescheduled.scheduledStart?.toISOString()).toBe("2026-04-30T13:00:00.000Z");
    expect(fakeDb.getTestState().scheduleSlots).toHaveLength(1);
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("job.rescheduled");
  });

  it("completeJob updates customer, technician, and asset fields, enqueues AI work, and rolls back on transaction failures", async () => {
    const { company, actor } = createAdminContext();
    const { customer, asset, technician } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      assetId: asset.id,
      technicianId: technician.id,
      title: "Complete Me",
      status: "in_progress",
      invoiceTotal: "250.00"
    });

    const completed = await jobService.completeJob(company.id, actor.id, job.id, {
      completionNotes: "All set"
    });

    const today = new Date().toISOString().slice(0, 10);
    const stateAfterSuccess = fakeDb.getTestState();

    expect(completed.status).toBe("completed");
    expect(stateAfterSuccess.customers.find((row) => row.id === customer.id)?.lifetimeValue).toBe("350.00");
    expect(stateAfterSuccess.customers.find((row) => row.id === customer.id)?.totalJobs).toBe(3);
    expect(stateAfterSuccess.customers.find((row) => row.id === customer.id)?.lastServiceDate).toBe(today);
    expect(stateAfterSuccess.customers.find((row) => row.id === customer.id)?.firstServiceDate).toBe(today);
    expect(stateAfterSuccess.technicians.find((row) => row.id === technician.id)?.totalJobsCompleted).toBe(5);
    expect(stateAfterSuccess.assets.find((row) => row.id === asset.id)?.lastServiceDate).toBe(today);
    expect(addQueueJob).toHaveBeenCalledWith(
      "evaluate-revenue-opportunities",
      {
        companyId: company.id,
        jobId: job.id,
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

    const rollbackJob = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      assetId: asset.id,
      technicianId: technician.id,
      title: "Rollback Me",
      status: "in_progress",
      invoiceTotal: "75.00"
    });
    const originalUpdate = fakeDb.db.update;
    const updateSpy = vi
      .spyOn(fakeDb.db, "update")
      .mockImplementation((table) => {
        if (table === fakeDb.assets) {
          throw new Error("asset update failed");
        }

        return originalUpdate.call(fakeDb.db, table as never);
      });

    await expect(
      jobService.completeJob(company.id, actor.id, rollbackJob.id, {
        completionNotes: "Should rollback"
      })
    ).rejects.toThrow("asset update failed");

    updateSpy.mockRestore();

    const rolledBackState = fakeDb.getTestState();
    expect(rolledBackState.jobs.find((row) => row.id === rollbackJob.id)?.status).toBe("in_progress");
    expect(rolledBackState.customers.find((row) => row.id === customer.id)?.totalJobs).toBe(3);
  });

  it("completeJob blocks open required tasks without changing state, then allows a retry after completion", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, title: "Checklist Job", status: "in_progress" });
    const task = fakeDb.seedJobTask({ companyId: company.id, jobId: job.id, title: "Safety check", isRequired: true });
    fakeDb.seedJobTask({ companyId: company.id, jobId: job.id, title: "Optional note" });

    await expect(jobService.completeJob(company.id, actor.id, job.id, {})).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    expect(fakeDb.getTestState().jobs.find((row) => row.id === job.id)?.status).toBe("in_progress");
    expect(fakeDb.getTestState().activityEvents.some((event) => event.eventType === "job.completed")).toBe(false);
    expect(addQueueJob).not.toHaveBeenCalled();

    const persistedTask = fakeDb.getTestState().jobTasks.find((row) => row.id === task.id);
    expect(persistedTask).toBeDefined();
    if (!persistedTask) throw new Error("Expected task after rollback");
    persistedTask.status = "completed";
    const completed = await jobService.completeJob(company.id, actor.id, job.id, {});
    expect(completed.status).toBe("completed");
  });

  it("completeJob blocks an in-progress required task but permits skipped required and open optional tasks", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, title: "Mixed Checklist", status: "in_progress" });
    const required = fakeDb.seedJobTask({ companyId: company.id, jobId: job.id, title: "Active check", isRequired: true, status: "in_progress" });
    fakeDb.seedJobTask({ companyId: company.id, jobId: job.id, title: "Optional check", isRequired: false, status: "pending" });

    await expect(jobService.completeJob(company.id, actor.id, job.id, {})).rejects.toMatchObject({ code: ErrorCode.CONFLICT });
    const persistedTask = fakeDb.getTestState().jobTasks.find((row) => row.id === required.id);
    expect(persistedTask).toBeDefined();
    if (!persistedTask) throw new Error("Expected task after rollback");
    persistedTask.status = "skipped";

    const completed = await jobService.completeJob(company.id, actor.id, job.id, {});
    expect(completed.status).toBe("completed");
  });

  it("completeJob ignores open tasks from another tenant and soft-deleted tasks", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, title: "Scoped Job", status: "in_progress" });
    fakeDb.seedJobTask({ companyId: randomUUID(), jobId: job.id, title: "Other tenant", isRequired: true });
    fakeDb.seedJobTask({ companyId: company.id, jobId: job.id, title: "Deleted", isRequired: true, deletedAt: new Date() });

    const completed = await jobService.completeJob(company.id, actor.id, job.id, {});
    expect(completed.status).toBe("completed");
  });

  it("completeJob serializes concurrent attempts and applies completion side effects once", async () => {
    const { company, actor } = createAdminContext();
    const { customer, technician } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      technicianId: technician.id,
      title: "Concurrent Completion",
      status: "in_progress",
      invoiceTotal: "50.00"
    });

    const [first, second] = await Promise.all([
      jobService.completeJob(company.id, actor.id, job.id, { completionNotes: "Done" }),
      jobService.completeJob(company.id, actor.id, job.id, { completionNotes: "Done" })
    ]);

    expect(first.status).toBe("completed");
    expect(second.status).toBe("completed");
    const state = fakeDb.getTestState();
    expect(state.customers.find((row) => row.id === customer.id)?.totalJobs).toBe(3);
    expect(state.customers.find((row) => row.id === customer.id)?.lifetimeValue).toBe("150.00");
    expect(state.technicians.find((row) => row.id === technician.id)?.totalJobsCompleted).toBe(5);
    expect(state.activityEvents.filter((event) => event.eventType === "job.completed")).toHaveLength(1);
    expect(addQueueJob).toHaveBeenCalledTimes(1);
  });

  it("serializes completeJob against a generic status transition", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Completion Status Race",
      status: "in_progress"
    });

    const results = await Promise.allSettled([
      jobService.completeJob(company.id, actor.id, job.id, {}),
      jobService.transitionStatus(company.id, actor.id, job.id, "cancelled", "Concurrent cancellation")
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: ErrorCode.CONFLICT } });
  });

  it("completeJob revalidates a technician's current linkage and assignment inside the transaction", async () => {
    const company = fakeDb.seedCompany({ name: "Field Co", slug: "field-co" });
    const actor = fakeDb.seedUser({
      companyId: company.id,
      email: "tech@example.com",
      firstName: "Terry",
      lastName: "Tech",
      role: "technician"
    });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Casey", lastName: "Client" });
    const linkedTechnician = fakeDb.seedTechnician({
      companyId: company.id,
      userId: actor.id,
      firstName: "Terry",
      lastName: "Tech",
      phone: "555-0101"
    });
    const replacement = fakeDb.seedTechnician({
      companyId: company.id,
      firstName: "Riley",
      lastName: "Replacement",
      phone: "555-0102"
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      technicianId: linkedTechnician.id,
      title: "Reassigned Job",
      status: "in_progress"
    });

    // Simulate reassignment after an earlier route-level ownership check but before service execution.
    fakeDb.getTestState().jobs.find((row) => row.id === job.id)!.technicianId = replacement.id;

    await expect(jobService.completeJob(company.id, actor.id, job.id, {})).rejects.toMatchObject({
      code: ErrorCode.FORBIDDEN
    });
    expect(fakeDb.getTestState().jobs.find((row) => row.id === job.id)?.status).toBe("in_progress");
    expect(fakeDb.getTestState().activityEvents.some((event) => event.eventType === "job.completed")).toBe(false);
    expect(addQueueJob).not.toHaveBeenCalled();
  });

  it("addNote creates a note and emits job.updated", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Note Job"
    });

    const note = await jobService.addNote(company.id, actor.id, job.id, {
      content: "Customer requested afternoon arrival"
    });

    expect(note.content).toBe("Customer requested afternoon arrival");
    expect(fakeDb.getTestState().jobNotes).toHaveLength(1);
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("job.updated");
  });

  it("updateJob succeeds and ignores unexpected status input", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Old Title",
      description: "Old description",
      status: "lead",
      tags: ["old"]
    });

    const updated = await jobService.updateJob(
      company.id,
      actor.id,
      job.id,
      {
        title: "Updated Title",
        description: "Updated description",
        techNotes: "Wear boot covers",
        tags: ["updated"],
        status: "paid"
      } as unknown as Parameters<JobServiceModule["updateJob"]>[3]
    );

    expect(updated.title).toBe("Updated Title");
    expect(updated.description).toBe("Updated description");
    expect(updated.techNotes).toBe("Wear boot covers");
    expect(updated.tags).toEqual(["updated"]);
    expect(updated.status).toBe("lead");
  });

  it("getJobNotes returns newest-first notes for a job", async () => {
    const { company } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Notes Job"
    });

    fakeDb.seedJobNote({
      companyId: company.id,
      jobId: job.id,
      content: "Older note",
      createdAt: new Date("2026-04-28T09:00:00.000Z")
    });
    fakeDb.seedJobNote({
      companyId: company.id,
      jobId: job.id,
      content: "Newer note",
      createdAt: new Date("2026-04-28T10:00:00.000Z")
    });

    const notes = await jobService.getJobNotes(company.id, job.id);

    expect(notes).toHaveLength(2);
    expect(notes[0]?.content).toBe("Newer note");
    expect(notes[1]?.content).toBe("Older note");
  });

  it("addPhoto creates a photo record for the job", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Photo Job"
    });

    const photo = await jobService.addPhoto(company.id, actor.id, job.id, {
      url: "https://cdn.example.com/job-after.jpg",
      photoType: "after"
    });

    expect(photo.url).toBe("https://cdn.example.com/job-after.jpg");
    expect(photo.photoType).toBe("after");
    expect(fakeDb.getTestState().jobPhotos).toHaveLength(1);
  });

  it("getJobPhotos returns saved photos for the job", async () => {
    const { company } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Photos Job"
    });

    fakeDb.seedJobPhoto({
      companyId: company.id,
      jobId: job.id,
      url: "https://cdn.example.com/older.jpg",
      createdAt: new Date("2026-04-28T09:00:00.000Z")
    });
    fakeDb.seedJobPhoto({
      companyId: company.id,
      jobId: job.id,
      url: "https://cdn.example.com/newer.jpg",
      createdAt: new Date("2026-04-28T10:00:00.000Z"),
      photoType: "after"
    });

    const photos = await jobService.getJobPhotos(company.id, job.id);

    expect(photos).toHaveLength(2);
    expect(photos[0]?.url).toBe("https://cdn.example.com/newer.jpg");
    expect(photos[1]?.url).toBe("https://cdn.example.com/older.jpg");
  });

  it("getJobTimeline returns newest-first activity events", async () => {
    const { company } = createAdminContext();
    const { customer } = seedJobGraph(company.id);
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Timeline Job"
    });

    fakeDb.seedActivityEvent({
      companyId: company.id,
      eventType: "job.created",
      entityType: "job",
      entityId: job.id,
      jobId: job.id,
      customerId: customer.id,
      summary: "Job created",
      occurredAt: new Date("2026-04-28T09:00:00.000Z")
    });
    fakeDb.seedActivityEvent({
      companyId: company.id,
      eventType: "job.updated",
      entityType: "job",
      entityId: job.id,
      jobId: job.id,
      customerId: customer.id,
      summary: "Job updated",
      occurredAt: new Date("2026-04-28T10:00:00.000Z")
    });

    const timeline = await jobService.getJobTimeline(company.id, job.id);

    expect(timeline).toHaveLength(2);
    expect(timeline[0]?.summary).toBe("Job updated");
    expect(timeline[1]?.summary).toBe("Job created");
  });
});
