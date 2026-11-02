import { randomUUID } from "node:crypto";

import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetEnvCacheForTests } from "@fsm/config";

import { setupTestEnv } from "../test-support/env-setup.js";

const queueAdd = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: queueAdd },
  enqueueBuildJobServiceBriefJob: vi.fn().mockResolvedValue(undefined),
  redisConnection: {
    del: vi.fn().mockResolvedValue(1),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK")
  }
}));

vi.mock("./loyalty-reminder-post-job.service.js", () => ({
  enqueuePostJobLoyaltyReminderEvaluation: vi.fn().mockResolvedValue("skipped_disabled")
}));

const postgresUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const enabled = typeof postgresUrl === "string" && postgresUrl.startsWith("postgres");

setupTestEnv();
if (enabled) {
  vi.stubEnv("DATABASE_URL", postgresUrl as string);
  vi.stubEnv("DATABASE_POOL_MAX", "8");
  resetEnvCacheForTests();
}

type DbModule = typeof import("@fsm/db");
type JobService = typeof import("./job.service.js");
type JobTasksService = typeof import("./job-tasks.service.js");

type Fixture = {
  companyId: string;
  actorId: string;
  customerId: string;
  jobId: string;
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe.runIf(enabled)("FS-237 job completion serialization (Postgres)", { timeout: 30_000 }, () => {
  let dbModule: DbModule;
  let jobService: JobService;
  let jobTasksService: JobTasksService;
  const createdCompanyIds: string[] = [];

  beforeAll(async () => {
    dbModule = await import("@fsm/db");
    jobService = await import("./job.service.js");
    jobTasksService = await import("./job-tasks.service.js");
  });

  beforeEach(() => {
    queueAdd.mockClear();
  });

  afterAll(async () => {
    if (!dbModule || createdCompanyIds.length === 0) {
      return;
    }

    const { activityEvents, companies, customers, jobs, jobTasks, users } = dbModule;
    for (const companyId of createdCompanyIds) {
      await dbModule.db.delete(activityEvents).where(eq(activityEvents.companyId, companyId));
      await dbModule.db.delete(jobTasks).where(eq(jobTasks.companyId, companyId));
      await dbModule.db.delete(jobs).where(eq(jobs.companyId, companyId));
      await dbModule.db.delete(customers).where(eq(customers.companyId, companyId));
      await dbModule.db.delete(users).where(eq(users.companyId, companyId));
      await dbModule.db.delete(companies).where(eq(companies.id, companyId));
    }
  });

  async function seedFixture(label: string): Promise<Fixture> {
    const companyId = randomUUID();
    const actorId = randomUUID();
    const customerId = randomUUID();
    const jobId = randomUUID();
    createdCompanyIds.push(companyId);

    await dbModule.db.insert(dbModule.companies).values({
      id: companyId,
      name: `FS-237 ${label}`,
      slug: `fs-237-${label.toLowerCase()}-${companyId}`
    });
    await dbModule.db.insert(dbModule.users).values({
      id: actorId,
      companyId,
      email: `fs-237-${actorId}@example.com`,
      firstName: "Concurrency",
      lastName: "Tester",
      role: "owner"
    });
    await dbModule.db.insert(dbModule.customers).values({
      id: customerId,
      companyId,
      firstName: "Race",
      lastName: "Customer"
    });
    await dbModule.db.insert(dbModule.jobs).values({
      id: jobId,
      companyId,
      customerId,
      jobNumber: `FS237-${jobId.slice(0, 8)}`,
      title: label,
      status: "in_progress",
      invoiceTotal: "25.00"
    });

    return { companyId, actorId, customerId, jobId };
  }

  async function blockedJobWaiterCount(): Promise<number> {
    const rows = (await dbModule.db.execute(sql`
      select count(*)::int as count
      from pg_stat_activity
      where datname = current_database()
        and pid <> pg_backend_pid()
        and application_name = current_setting('application_name')
        and wait_event_type = 'Lock'
    `)) as unknown as Array<{ count: number }>;
    return Number(rows[0]?.count ?? 0);
  }

  async function waitForBlockedJobWaiters(expected: number): Promise<void> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if ((await blockedJobWaiterCount()) >= expected) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out waiting for ${expected} PostgreSQL job-row lock waiters`);
  }

  async function runBehindJobBarrier<T extends readonly Promise<unknown>[]>(
    fixture: Fixture,
    contenders: () => T
  ): Promise<{ [K in keyof T]: PromiseSettledResult<Awaited<T[K]>> }> {
    const lockAcquired = deferred<void>();
    const releaseLock = deferred<void>();
    const blocker = dbModule.db.transaction(async (tx) => {
      await tx
        .select({ id: dbModule.jobs.id })
        .from(dbModule.jobs)
        .where(
          and(
            eq(dbModule.jobs.companyId, fixture.companyId),
            eq(dbModule.jobs.id, fixture.jobId),
            isNull(dbModule.jobs.deletedAt)
          )
        )
        .for("update");
      lockAcquired.resolve(undefined);
      await releaseLock.promise;
    });

    await lockAcquired.promise;
    const operations = contenders();
    try {
      await waitForBlockedJobWaiters(operations.length);
    } finally {
      releaseLock.resolve(undefined);
      await blocker;
    }

    return Promise.allSettled(operations) as Promise<{ [K in keyof T]: PromiseSettledResult<Awaited<T[K]>> }>;
  }

  async function readInvariant(fixture: Fixture) {
    const [job] = await dbModule.db
      .select({ status: dbModule.jobs.status })
      .from(dbModule.jobs)
      .where(
        and(
          eq(dbModule.jobs.companyId, fixture.companyId),
          eq(dbModule.jobs.id, fixture.jobId),
          isNull(dbModule.jobs.deletedAt)
        )
      );
    const tasks = await dbModule.db
      .select({ isRequired: dbModule.jobTasks.isRequired, status: dbModule.jobTasks.status })
      .from(dbModule.jobTasks)
      .where(
        and(
          eq(dbModule.jobTasks.companyId, fixture.companyId),
          eq(dbModule.jobTasks.jobId, fixture.jobId),
          isNull(dbModule.jobTasks.deletedAt)
        )
      );
    const openRequiredCount = tasks.filter(
      (task) => task.isRequired === true && (task.status === "pending" || task.status === "in_progress")
    ).length;
    return { jobStatus: job?.status, openRequiredCount };
  }

  it("serializes two completion attempts and applies completion side effects once", async () => {
    const fixture = await seedFixture("Complete Complete");

    const results = await runBehindJobBarrier(fixture, () => [
      jobService.completeJob(fixture.companyId, fixture.actorId, fixture.jobId, {}),
      jobService.completeJob(fixture.companyId, fixture.actorId, fixture.jobId, {})
    ] as const);

    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    const [customer] = await dbModule.db
      .select({ totalJobs: dbModule.customers.totalJobs, lifetimeValue: dbModule.customers.lifetimeValue })
      .from(dbModule.customers)
      .where(eq(dbModule.customers.id, fixture.customerId));
    const events = await dbModule.db
      .select({ id: dbModule.activityEvents.id })
      .from(dbModule.activityEvents)
      .where(
        and(
          eq(dbModule.activityEvents.companyId, fixture.companyId),
          eq(dbModule.activityEvents.jobId, fixture.jobId),
          eq(dbModule.activityEvents.eventType, "job.completed")
        )
      );

    expect(customer).toMatchObject({ totalJobs: 1, lifetimeValue: "25.00" });
    expect(events).toHaveLength(1);
    expect(queueAdd).toHaveBeenCalledTimes(1);
  });

  it("serializes completion against required-task creation", async () => {
    const fixture = await seedFixture("Complete Create");

    const results = await runBehindJobBarrier(fixture, () => [
      jobService.completeJob(fixture.companyId, fixture.actorId, fixture.jobId, {}),
      jobTasksService.createTask(fixture.companyId, fixture.jobId, {
        title: "Required safety check",
        isRequired: true
      })
    ] as const);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const state = await readInvariant(fixture);
    expect([
      { jobStatus: "completed", openRequiredCount: 0 },
      { jobStatus: "in_progress", openRequiredCount: 1 }
    ]).toContainEqual(state);
  });

  it("serializes completion against reopening a required task", async () => {
    const fixture = await seedFixture("Complete Reopen");
    const task = await jobTasksService.createTask(fixture.companyId, fixture.jobId, {
      title: "Required commissioning check",
      isRequired: true
    });
    await jobTasksService.completeTask(fixture.companyId, fixture.jobId, task.id, fixture.actorId);

    const results = await runBehindJobBarrier(fixture, () => [
      jobService.completeJob(fixture.companyId, fixture.actorId, fixture.jobId, {}),
      jobTasksService.updateTask(fixture.companyId, fixture.jobId, task.id, { status: "pending" })
    ] as const);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const state = await readInvariant(fixture);
    expect([
      { jobStatus: "completed", openRequiredCount: 0 },
      { jobStatus: "in_progress", openRequiredCount: 1 }
    ]).toContainEqual(state);
  });

  it("serializes completion against a generic status transition", async () => {
    const fixture = await seedFixture("Complete Status");

    const results = await runBehindJobBarrier(fixture, () => [
      jobService.completeJob(fixture.companyId, fixture.actorId, fixture.jobId, {}),
      jobService.transitionStatus(fixture.companyId, fixture.actorId, fixture.jobId, "cancelled", "race test")
    ] as const);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const state = await readInvariant(fixture);
    expect(["completed", "cancelled"]).toContain(state.jobStatus);
    const events = await dbModule.db
      .select({ eventType: dbModule.activityEvents.eventType })
      .from(dbModule.activityEvents)
      .where(
        and(
          eq(dbModule.activityEvents.companyId, fixture.companyId),
          eq(dbModule.activityEvents.jobId, fixture.jobId)
        )
      );
    expect(events).toHaveLength(1);
  });
});
