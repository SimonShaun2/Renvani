/**
 * FS-87 — offline-safe field work sync contract tests.
 * Contract doc: docs/contracts/field-work-sync-v1.md
 */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildRecordVersionV1 } from "@fsm/types";
import { redisConnection } from "@fsm/jobs";

import { closeTestApp } from "../../test-support/close-test-app.js";
import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  webhooksQueue: { add: vi.fn() },
  redisConnection: {
    get: vi.fn(async () => null),
    set: vi.fn(async () => "OK"),
    del: vi.fn(async () => 1)
  }
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: Awaited<ReturnType<BuildAppModule["buildApp"]>>;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  vi.mocked(redisConnection.del).mockClear();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await closeTestApp(app);
});

function bearer(companyId: string, userId: string, role: string): string {
  return `Bearer ${tokens.generateAccessToken({ userId, companyId, role })}`;
}

function seedFieldJob() {
  const company = fakeDb.seedCompany({ name: "Field Co", slug: "field-co" });
  const customer = fakeDb.seedCustomer({
    companyId: company.id,
    firstName: "Pat",
    lastName: "Customer",
    leadSource: "web"
  });
  const techUser = fakeDb.seedUser({
    companyId: company.id,
    email: "tech@field-co.test",
    firstName: "T",
    lastName: "Tech",
    role: "technician"
  });
  const technician = fakeDb.seedTechnician({
    companyId: company.id,
    userId: techUser.id,
    firstName: "T",
    lastName: "Tech",
    phone: "+15555550101"
  });
  const job = fakeDb.seedJob({
    companyId: company.id,
    customerId: customer.id,
    technicianId: technician.id,
    status: "dispatched",
    title: "Service call",
    scheduledStart: new Date("2026-11-02T15:00:00.000Z")
  });

  return { company, techUser, job };
}

describe("FS-87 field work sync", () => {
  it("rejects unauthenticated sync batches (expired / missing session)", async () => {
    const { job } = seedFieldJob();
    const response = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .send({
        contractVersion: "1.0.0",
        deviceId: "dev-1",
        batchClientId: "batch-1",
        operations: [
          {
            sequence: 1,
            clientOperationId: "note-unauth",
            jobId: job.id,
            type: "job.note.append",
            payload: { content: "offline note" }
          }
        ]
      });

    expect(response.status).toBe(401);
  });

  it("replays the same clientOperationId without duplicating notes", async () => {
    const { company, techUser, job } = seedFieldJob();
    const body = {
      contractVersion: "1.0.0",
      deviceId: "ipad-01",
      batchClientId: "local-batch-1",
      operations: [
        {
          sequence: 1,
          clientOperationId: "note-op-1",
          jobId: job.id,
          type: "job.note.append",
          payload: { content: "Checked filter", isInternal: true }
        }
      ]
    };

    const first = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(company.id, techUser.id, techUser.role))
      .send(body);

    expect(first.status).toBe(200);
    expect(first.body.results[0].outcome).toBe("applied");
    expect(fakeDb.getTestState().jobNotes).toHaveLength(1);

    const second = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(company.id, techUser.id, techUser.role))
      .send(body);

    expect(second.status).toBe(200);
    expect(second.body.results[0].outcome).toBe("duplicate");
    expect(fakeDb.getTestState().jobNotes).toHaveLength(1);
  });

  it("serializes simultaneous replays before applying a non-idempotent note", async () => {
    const { company, techUser, job } = seedFieldJob();
    const operation = {
      sequence: 1,
      clientOperationId: "note-op-overlap",
      jobId: job.id,
      type: "job.note.append",
      payload: { content: "One field note", isInternal: true }
    };
    const send = (batchClientId: string) =>
      request(app.server)
        .post("/api/v1/field-work/sync/batches")
        .set("Authorization", bearer(company.id, techUser.id, techUser.role))
        .send({
          contractVersion: "1.0.0",
          deviceId: "ipad-overlap",
          batchClientId,
          operations: [operation]
        });

    const [left, right] = await Promise.all([send("overlap-a"), send("overlap-b")]);

    expect(left.status).toBe(200);
    expect(right.status).toBe(200);
    expect([left.body.results[0].outcome, right.body.results[0].outcome].sort()).toEqual([
      "applied",
      "duplicate"
    ]);
    expect(fakeDb.getTestState().jobNotes).toHaveLength(1);
    expect(fakeDb.getTestState().activityEvents).toHaveLength(1);
  });

  it("rejects a simultaneous same-id payload mismatch before either loser mutates", async () => {
    const { company, techUser, job } = seedFieldJob();
    const send = (batchClientId: string, content: string) =>
      request(app.server)
        .post("/api/v1/field-work/sync/batches")
        .set("Authorization", bearer(company.id, techUser.id, techUser.role))
        .send({
          contractVersion: "1.0.0",
          deviceId: "ipad-mismatch-overlap",
          batchClientId,
          operations: [
            {
              sequence: 1,
              clientOperationId: "note-op-overlap-mismatch",
              jobId: job.id,
              type: "job.note.append",
              payload: { content }
            }
          ]
        });

    const [left, right] = await Promise.all([
      send("mismatch-overlap-a", "Original concurrent note"),
      send("mismatch-overlap-b", "Different concurrent note")
    ]);

    expect(left.status).toBe(200);
    expect(right.status).toBe(200);
    expect([left.body.results[0].outcome, right.body.results[0].outcome].sort()).toEqual([
      "applied",
      "rejected"
    ]);
    expect(fakeDb.getTestState().jobNotes).toHaveLength(1);
    expect(["Original concurrent note", "Different concurrent note"]).toContain(
      fakeDb.getTestState().jobNotes[0]!.content
    );
    expect(fakeDb.getTestState().activityEvents).toHaveLength(1);
  });

  it("rolls back a note and its event when the operation receipt cannot be persisted", async () => {
    const { company, techUser, job } = seedFieldJob();
    const originalInsert = fakeDb.db.insert.bind(fakeDb.db);
    let failReceipt = true;
    const body = {
      contractVersion: "1.0.0",
      deviceId: "ipad-receipt-failure",
      batchClientId: "receipt-failure-batch",
      operations: [
        {
          sequence: 1,
          clientOperationId: "note-op-receipt-failure",
          jobId: job.id,
          type: "job.note.append",
          payload: { content: "Atomic note" }
        }
      ]
    };

    fakeDb.db.insert = ((table) => {
      const chain = originalInsert(table);
      const tableName = (table as { __name?: string }).__name;
      return {
        values(values: Record<string, unknown> | Array<Record<string, unknown>>) {
          const pending = chain.values(values);
          return {
            async returning() {
              if (tableName === "fieldSyncOperations" && failReceipt) {
                throw new Error("operation receipt unavailable");
              }
              return pending.returning();
            }
          };
        }
      };
    }) as typeof fakeDb.db.insert;

    const send = () =>
      request(app.server)
        .post("/api/v1/field-work/sync/batches")
        .set("Authorization", bearer(company.id, techUser.id, techUser.role))
        .send(body);

    try {
      const failed = await send();
      expect(failed.status).toBe(500);
      expect(fakeDb.getTestState().jobNotes).toHaveLength(0);
      expect(fakeDb.getTestState().activityEvents).toHaveLength(0);
      expect(fakeDb.getTestState().fieldSyncOperations).toHaveLength(0);

      failReceipt = false;
      const retried = await send();
      expect(retried.status).toBe(200);
      expect(retried.body.results[0].outcome).toBe("applied");
      expect(fakeDb.getTestState().jobNotes).toHaveLength(1);
      expect(fakeDb.getTestState().activityEvents).toHaveLength(1);
      expect(fakeDb.getTestState().fieldSyncOperations).toHaveLength(1);
    } finally {
      fakeDb.db.insert = originalInsert;
    }
  });

  it("invalidates dispatch only after a status operation and receipt commit together", async () => {
    const { company, techUser, job } = seedFieldJob();
    const originalInsert = fakeDb.db.insert.bind(fakeDb.db);
    let failReceipt = true;
    const body = {
      contractVersion: "1.0.0",
      deviceId: "ipad-status-receipt",
      batchClientId: "status-receipt-batch",
      operations: [
        {
          sequence: 1,
          clientOperationId: "status-op-receipt",
          jobId: job.id,
          type: "job.status.update",
          baseRecordVersion: buildRecordVersionV1("job", job.id, job.updatedAt),
          payload: { toStatus: "in_progress" }
        }
      ]
    };

    fakeDb.db.insert = ((table) => {
      const chain = originalInsert(table);
      const tableName = (table as { __name?: string }).__name;
      return {
        values(values: Record<string, unknown> | Array<Record<string, unknown>>) {
          const pending = chain.values(values);
          return {
            async returning() {
              if (tableName === "fieldSyncOperations" && failReceipt) {
                throw new Error("operation receipt unavailable");
              }
              return pending.returning();
            }
          };
        }
      };
    }) as typeof fakeDb.db.insert;

    const send = () =>
      request(app.server)
        .post("/api/v1/field-work/sync/batches")
        .set("Authorization", bearer(company.id, techUser.id, techUser.role))
        .send(body);

    try {
      const failed = await send();
      expect(failed.status).toBe(500);
      expect(fakeDb.getTestState().jobs[0]?.status).toBe("dispatched");
      expect(fakeDb.getTestState().activityEvents).toHaveLength(0);
      expect(redisConnection.del).not.toHaveBeenCalled();

      failReceipt = false;
      const applied = await send();
      expect(applied.status).toBe(200);
      expect(applied.body.results[0].outcome).toBe("applied");
      expect(fakeDb.getTestState().jobs[0]?.status).toBe("in_progress");
      expect(redisConnection.del).toHaveBeenCalledTimes(1);
      expect(redisConnection.del).toHaveBeenCalledWith(`dispatch:${company.id}:2026-11-02`);

      const duplicate = await send();
      expect(duplicate.status).toBe(200);
      expect(duplicate.body.results[0].outcome).toBe("duplicate");
      expect(redisConnection.del).toHaveBeenCalledTimes(1);
    } finally {
      fakeDb.db.insert = originalInsert;
    }
  });

  it("returns conflict when job recordVersion is stale", async () => {
    const { company, techUser, job } = seedFieldJob();
    const staleVersion = buildRecordVersionV1("job", job.id, new Date("2020-01-01T00:00:00.000Z"));

    const response = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(company.id, techUser.id, techUser.role))
      .send({
        contractVersion: "1.0.0",
        deviceId: "ipad-01",
        batchClientId: "local-batch-conflict",
        operations: [
          {
            sequence: 1,
            clientOperationId: "status-op-1",
            jobId: job.id,
            type: "job.status.update",
            baseRecordVersion: staleVersion,
            payload: { toStatus: "in_progress" }
          }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.results[0].outcome).toBe("conflict");
    expect(response.body.results[0].conflict?.liveRecordVersion).toContain(job.id);
    expect(fakeDb.getTestState().jobs[0]?.status).toBe("dispatched");
    expect(redisConnection.del).not.toHaveBeenCalled();
  });

  it("rejects cross-tenant job sync", async () => {
    const { job } = seedFieldJob();
    const other = fakeDb.seedCompany({ name: "Other Co", slug: "other-co" });
    const intruder = fakeDb.seedUser({
      companyId: other.id,
      email: "intruder@other.test",
      firstName: "X",
      lastName: "Y",
      role: "owner"
    });

    const response = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(other.id, intruder.id, intruder.role))
      .send({
        contractVersion: "1.0.0",
        deviceId: "ipad-02",
        batchClientId: "local-batch-x",
        operations: [
          {
            sequence: 1,
            clientOperationId: "note-op-x",
            jobId: job.id,
            type: "job.note.append",
            payload: { content: "Should not apply" }
          }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.results[0].outcome).toBe("rejected");
    expect(fakeDb.getTestState().jobNotes).toHaveLength(0);
  });

  it("rejects clientOperationId replay when payload hash differs", async () => {
    const { company, techUser, job } = seedFieldJob();

    const first = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(company.id, techUser.id, techUser.role))
      .send({
        contractVersion: "1.0.0",
        deviceId: "ipad-04",
        batchClientId: "mismatch-batch",
        operations: [
          {
            sequence: 1,
            clientOperationId: "note-op-mismatch",
            jobId: job.id,
            type: "job.note.append",
            payload: { content: "Original note" }
          }
        ]
      });

    expect(first.status).toBe(200);
    expect(fakeDb.getTestState().jobNotes).toHaveLength(1);

    const second = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(company.id, techUser.id, techUser.role))
      .send({
        contractVersion: "1.0.0",
        deviceId: "ipad-04",
        batchClientId: "mismatch-batch-2",
        operations: [
          {
            sequence: 1,
            clientOperationId: "note-op-mismatch",
            jobId: job.id,
            type: "job.note.append",
            payload: { content: "Tampered note" }
          }
        ]
      });

    expect(second.status).toBe(200);
    expect(second.body.results[0].outcome).toBe("rejected");
    expect(second.body.results[0].message).toMatch(/different payload/i);
    expect(fakeDb.getTestState().jobNotes).toHaveLength(1);
  });

  it("returns conflict when job task recordVersion is stale", async () => {
    const { company, techUser, job } = seedFieldJob();
    const task = fakeDb.seedJobTask({
      companyId: company.id,
      jobId: job.id,
      title: "Inspect filter",
      status: "pending"
    });
    const staleVersion = buildRecordVersionV1("job_task", task.id, new Date("2020-01-01T00:00:00.000Z"));

    const response = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(company.id, techUser.id, techUser.role))
      .send({
        contractVersion: "1.0.0",
        deviceId: "ipad-05",
        batchClientId: "task-conflict",
        operations: [
          {
            sequence: 1,
            clientOperationId: "task-op-1",
            jobId: job.id,
            type: "job.task.update",
            baseRecordVersion: staleVersion,
            payload: { taskId: task.id, status: "completed" }
          }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.results[0].outcome).toBe("conflict");
    expect(fakeDb.getTestState().jobTasks[0]?.status).toBe("pending");
  });

  it("returns conflict when signature already differs on the job", async () => {
    const { company, techUser, job } = seedFieldJob();
    fakeDb.getTestState().jobs[0] = {
      ...job,
      signatureUrl: "https://cdn.example/existing-sig.png",
      signedByName: "Pat Customer",
      signedAt: new Date("2026-01-01T00:00:00.000Z")
    };
    const liveVersion = buildRecordVersionV1(
      "job",
      job.id,
      fakeDb.getTestState().jobs[0]!.updatedAt
    );

    const response = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(company.id, techUser.id, techUser.role))
      .send({
        contractVersion: "1.0.0",
        deviceId: "ipad-06",
        batchClientId: "sig-conflict",
        operations: [
          {
            sequence: 1,
            clientOperationId: "sig-op-1",
            jobId: job.id,
            type: "job.signature.capture",
            baseRecordVersion: liveVersion,
            payload: {
              signatureUrl: "https://cdn.example/new-sig.png",
              signedByName: "Pat Customer"
            }
          }
        ]
      });

    expect(response.status).toBe(200);
    expect(response.body.results[0].outcome).toBe("conflict");
    expect(response.body.results[0].conflict?.reason).toMatch(/signature/i);
  });

  it("resumes a batch and acknowledges media retry via duplicate", async () => {
    const { company, techUser, job } = seedFieldJob();
    const firstBody = {
      contractVersion: "1.0.0",
      deviceId: "ipad-03",
      batchClientId: "resume-batch",
      operations: [
        {
          sequence: 1,
          clientOperationId: "media-op-1",
          jobId: job.id,
          type: "job.media.register",
          payload: {
            url: "https://cdn.example/photo-1.jpg",
            photoType: "after",
            caption: "Completed work"
          }
        }
      ]
    };

    const first = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(company.id, techUser.id, techUser.role))
      .send(firstBody);

    expect(first.status).toBe(200);
    expect(first.body.lastAcknowledgedSequence).toBe(1);
    expect(fakeDb.getTestState().jobPhotos).toHaveLength(1);

    const second = await request(app.server)
      .post("/api/v1/field-work/sync/batches")
      .set("Authorization", bearer(company.id, techUser.id, techUser.role))
      .send({
        ...firstBody,
        resumeBatchId: first.body.batchId,
        operations: [
          firstBody.operations[0],
          {
            sequence: 2,
            clientOperationId: "note-op-2",
            jobId: job.id,
            type: "job.note.append",
            payload: { content: "Follow-up note" }
          }
        ]
      });

    expect(second.status).toBe(200);
    expect(second.body.results[0].outcome).toBe("duplicate");
    expect(second.body.results[1].outcome).toBe("applied");
    expect(second.body.lastAcknowledgedSequence).toBe(2);
    expect(fakeDb.getTestState().jobPhotos).toHaveLength(1);
    expect(fakeDb.getTestState().jobNotes).toHaveLength(1);
  });
});
