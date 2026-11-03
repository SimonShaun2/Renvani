import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppError,
  ErrorCode,
  QUEUE_PLATFORM_CONTRACT_VERSION,
  type DeadLetterJobListV1,
  type FailedJobReplayListV1,
  type PlatformQueueMonitoringSnapshotV1
} from "@fsm/types";

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
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  webhooksQueue: { add: vi.fn() },
  operatorQueue: { add: vi.fn() },
  exportsQueue: { add: vi.fn() },
  growthQueue: { add: vi.fn() },
  redisConnection: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 1)
  }
}));

vi.mock("../../../services/queue-monitoring.service.js", () => ({
  fetchPlatformQueueMonitoringSnapshot: vi.fn(),
  fetchPlatformDeadLetterJobs: vi.fn(),
  fetchPlatformFailedJobsWithReplayMetadata: vi.fn(),
  recoverPlatformDeadLetterJob: vi.fn()
}));

type BuildAppModule = typeof import("../../../app.js");
type FakeDbModule = typeof import("../../../test-support/fake-db.js");
type TokensModule = typeof import("../../../lib/tokens.js");
type QueueMonitoringServiceModule = typeof import("../../../services/queue-monitoring.service.js");

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let queueMonitoringService: QueueMonitoringServiceModule;
let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;

const sampleSnapshot: PlatformQueueMonitoringSnapshotV1 = {
  contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
  collectedAt: "2026-10-23T12:00:00.000Z",
  queues: [
    {
      queueName: "notifications",
      counts: {
        waiting: 1,
        active: 0,
        delayed: 0,
        failed: 0,
        paused: 0,
        backlog: 1
      },
      oldestJobAgeSeconds: 42,
      deadLetter: {
        queueName: "notifications-dlq",
        count: 0,
        oldestJobAgeSeconds: null
      }
    }
  ]
};

const tenantCompanyId = "11111111-1111-4111-8111-111111111111";

const sampleDeadLetterList: DeadLetterJobListV1 = {
  contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
  sourceQueue: "imports",
  deadLetterQueueName: "imports-dlq",
  jobs: [
    {
      deadLetterJobId: "dlq-1",
      sourceQueue: "imports",
      sourceJobId: "job-1",
      jobName: "migrate-file-batch",
      companyId: tenantCompanyId,
      attemptsMade: 5,
      failedAt: "2026-10-23T12:00:00.000Z",
      failureClass: "transient",
      errorMessage: "partial object failure"
    }
  ],
  nextCursor: null
};

beforeAll(async () => {
  buildAppModule = await import("../../../app.js");
  fakeDb = await import("../../../test-support/fake-db.js");
  tokens = await import("../../../lib/tokens.js");
  queueMonitoringService = await import("../../../services/queue-monitoring.service.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  vi.mocked(queueMonitoringService.recoverPlatformDeadLetterJob).mockReset();
  vi.mocked(queueMonitoringService.fetchPlatformQueueMonitoringSnapshot).mockResolvedValue(
    sampleSnapshot
  );
  vi.mocked(queueMonitoringService.fetchPlatformDeadLetterJobs).mockResolvedValue(sampleDeadLetterList);
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function createInternalAdminContext(role: "owner" | "admin" = "admin") {
  const company = fakeDb.seedCompany({
    id: fakeDb.RENAVANI_INTERNAL_TEST_COMPANY_ID,
    name: "Renvani Internal",
    slug: "renvani-internal",
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}@renvani.test`,
    firstName: "Riley",
    lastName: "Ops",
    role
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return { authorization: `Bearer ${accessToken}` };
}

function createExternalOwnerContext() {
  const company = fakeDb.seedCompany({
    name: "Customer HVAC",
    slug: "customer-hvac",
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@customer.test",
    firstName: "Casey",
    lastName: "Owner",
    role: "owner"
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return { authorization: `Bearer ${accessToken}` };
}

describe("GET /api/v1/internal/admin/queues/monitoring (STACK-05)", () => {
  it("returns queue monitoring snapshot for internal owner/admin", async () => {
    const internalAdmin = createInternalAdminContext("owner");

    const response = await request(app.server)
      .get("/api/v1/internal/admin/queues/monitoring")
      .set("Authorization", internalAdmin.authorization);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(sampleSnapshot);
    expect(queueMonitoringService.fetchPlatformQueueMonitoringSnapshot).toHaveBeenCalledOnce();
  });

  it("rejects external tenant owners", async () => {
    const external = createExternalOwnerContext();

    const response = await request(app.server)
      .get("/api/v1/internal/admin/queues/monitoring")
      .set("Authorization", external.authorization);

    expect(response.statusCode).toBe(403);
    expect(response.body).toMatchObject({ error: "FORBIDDEN" });
  });

  it("rejects internal dispatcher role", async () => {
    const company = fakeDb.seedCompany({
      id: fakeDb.RENAVANI_INTERNAL_TEST_COMPANY_ID,
      name: "Renvani Internal",
      slug: "renvani-internal",
      timezone: "America/Chicago"
    });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "dispatcher@renvani.test",
      firstName: "Dana",
      lastName: "Dispatch",
      role: "dispatcher"
    });
    const accessToken = tokens.generateAccessToken({
      userId: user.id,
      companyId: company.id,
      role: user.role
    });

    const response = await request(app.server)
      .get("/api/v1/internal/admin/queues/monitoring")
      .set("Authorization", `Bearer ${accessToken}`);

    expect(response.statusCode).toBe(403);
    expect(response.body).toMatchObject({ error: "FORBIDDEN" });
  });

  it("requires authentication", async () => {
    const response = await request(app.server).get("/api/v1/internal/admin/queues/monitoring");

    expect(response.statusCode).toBe(401);
  });
});

describe("POST /api/v1/internal/admin/queues/:queueName/dead-letter/:deadLetterJobId/recover (FS-MIGRATE)", () => {
  it("re-enqueues a DLQ job for internal admins", async () => {
    const internalAdmin = createInternalAdminContext("admin");
    vi.mocked(queueMonitoringService.recoverPlatformDeadLetterJob).mockResolvedValue({
      recoveredQueueJobId: "recovered-1"
    });

    const response = await request(app.server)
      .post("/api/v1/internal/admin/queues/imports/dead-letter/dlq-1/recover")
      .set("Authorization", internalAdmin.authorization);

    expect(response.statusCode).toBe(202);
    expect(response.body.recoveredQueueJobId).toBe("recovered-1");
  });

  it("returns the same recovered job for a lost-response retry", async () => {
    const internalAdmin = createInternalAdminContext("admin");
    vi.mocked(queueMonitoringService.recoverPlatformDeadLetterJob).mockResolvedValue({
      recoveredQueueJobId: "recovered-stable-1"
    });

    const first = await request(app.server)
      .post("/api/v1/internal/admin/queues/imports/dead-letter/dlq-1/recover")
      .set("Authorization", internalAdmin.authorization);
    const retry = await request(app.server)
      .post("/api/v1/internal/admin/queues/imports/dead-letter/dlq-1/recover")
      .set("Authorization", internalAdmin.authorization);

    expect(first.statusCode).toBe(202);
    expect(retry.statusCode).toBe(202);
    expect(retry.body).toEqual(first.body);
  });

  it("returns explicit NOT_FOUND for a genuinely missing recovery identity", async () => {
    const internalAdmin = createInternalAdminContext("admin");
    vi.mocked(queueMonitoringService.recoverPlatformDeadLetterJob).mockRejectedValue(
      new AppError(ErrorCode.NOT_FOUND, "Dead-letter job was not found or recovered")
    );

    const response = await request(app.server)
      .post("/api/v1/internal/admin/queues/imports/dead-letter/missing/recover")
      .set("Authorization", internalAdmin.authorization);

    expect(response.statusCode).toBe(404);
    expect(response.body).toMatchObject({ error: "NOT_FOUND" });
  });
});

describe("GET /api/v1/internal/admin/queues/:queueName/dead-letter (FS-MIGRATE)", () => {
  it("returns DLQ job summaries for internal admins", async () => {
    const internalAdmin = createInternalAdminContext("admin");

    const response = await request(app.server)
      .get(
        `/api/v1/internal/admin/queues/imports/dead-letter?companyId=${tenantCompanyId}&limit=10`
      )
      .set("Authorization", internalAdmin.authorization);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(sampleDeadLetterList);
    expect(queueMonitoringService.fetchPlatformDeadLetterJobs).toHaveBeenCalledWith("imports", {
      companyId: tenantCompanyId,
      limit: 10
    });
  });
});

describe("GET /api/v1/internal/admin/queues/:queueName/failed (STACK-05)", () => {
  it("returns tenant-scoped failed job replay metadata", async () => {
    const internalAdmin = createInternalAdminContext("admin");
    const failedList: FailedJobReplayListV1 = {
      contractVersion: QUEUE_PLATFORM_CONTRACT_VERSION,
      sourceQueue: "imports",
      companyId: tenantCompanyId,
      jobs: [
        {
          jobId: "job-9",
          queueName: "imports",
          jobName: "migrate-file-batch",
          companyId: tenantCompanyId,
          attemptsMade: 3,
          failedAt: "2026-10-23T12:00:00.000Z",
          failedReason: "timeout",
          replayable: true
        }
      ],
      nextCursor: null
    };
    vi.mocked(queueMonitoringService.fetchPlatformFailedJobsWithReplayMetadata).mockResolvedValue(
      failedList
    );

    const response = await request(app.server)
      .get(
        `/api/v1/internal/admin/queues/imports/failed?companyId=${tenantCompanyId}&limit=5`
      )
      .set("Authorization", internalAdmin.authorization);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual(failedList);
    expect(queueMonitoringService.fetchPlatformFailedJobsWithReplayMetadata).toHaveBeenCalledWith(
      "imports",
      { companyId: tenantCompanyId, limit: 5 }
    );
  });
});
