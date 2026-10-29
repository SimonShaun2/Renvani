/**
 * job.signature.capture via attachmentId: stored as an internal object ref,
 * re-signed on job reads. Contract doc: docs/contracts/field-work-sync-v1.md
 */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildRecordVersionV1 } from "@fsm/types";

import { closeTestApp } from "../../test-support/close-test-app.js";
import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

// App startup otherwise attempts Stripe platform branding sync with test env credentials.
vi.mock("../../plugins/stripe-platform-sync.js", () => ({ default: async () => {} }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("../../lib/storage.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/storage.js")>();
  return {
    ...actual,
    createSignedDownloadUrl: vi.fn(async (objectKey: string) => ({
      url: `https://signed.example/${objectKey}?expires=1`,
      expiresAt: new Date(Date.now() + 900_000),
      objectKey
    })),
    getFileKeyFromUrl: (reference: string) => {
      if (reference.startsWith("memory-object://")) {
        return reference.slice("memory-object://".length);
      }
      throw new Error("unsupported reference");
    },
    getMediaSignedUrlTtlSeconds: () => 900
  };
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
    title: "Service call"
  });

  return { company, techUser, job };
}


function seedSignatureImage(
  companyId: string,
  jobId: string,
  overrides: Record<string, unknown> = {}
) {
  return fakeDb.seedFileAttachment({
    companyId,
    entityType: "job",
    entityId: jobId,
    jobId,
    fileName: "signature.png",
    fileUrl: `memory-object://attachments/${companyId}/1-signature.png`,
    mimeType: "image/png",
    fileSizeBytes: 24_000,
    ...overrides
  } as Parameters<FakeDbModule["seedFileAttachment"]>[0]);
}

function liveJobVersion(jobId: string) {
  const job = fakeDb.getTestState().jobs.find((row) => row.id === jobId)!;
  return buildRecordVersionV1("job", jobId, job.updatedAt);
}

async function capture(
  auth: { companyId: string; userId: string; role: string },
  jobId: string,
  payload: Record<string, unknown>,
  options: { clientOperationId?: string; baseRecordVersion?: string } = {}
) {
  return request(app.server)
    .post("/api/v1/field-work/sync/batches")
    .set("Authorization", bearer(auth.companyId, auth.userId, auth.role))
    .send({
      contractVersion: "1.0.0",
      deviceId: "ipad-sig",
      batchClientId: `batch-${options.clientOperationId ?? "sig-1"}`,
      operations: [
        {
          sequence: 1,
          clientOperationId: options.clientOperationId ?? "sig-1",
          jobId,
          type: "job.signature.capture",
          baseRecordVersion: options.baseRecordVersion ?? liveJobVersion(jobId),
          payload
        }
      ]
    });
}

function authOf(seed: ReturnType<typeof seedFieldJob>) {
  return { companyId: seed.company.id, userId: seed.techUser.id, role: seed.techUser.role };
}

describe("job.signature.capture with attachmentId", () => {
  it("captures from a job image attachment and stores an internal ref, not a URL", async () => {
    const seed = seedFieldJob();
    const attachment = seedSignatureImage(seed.company.id, seed.job.id);

    const response = await capture(authOf(seed), seed.job.id, {
      attachmentId: attachment.id,
      signedByName: "Pat Customer"
    });

    expect(response.status).toBe(200);
    expect(response.body.results[0].outcome).toBe("applied");
    const stored = fakeDb.getTestState().jobs[0]!;
    expect(stored.signatureUrl).toBe(`renvani-object:attachments/${seed.company.id}/1-signature.png`);
    expect(stored.signedByName).toBe("Pat Customer");
    expect(stored.signedAt).toBeInstanceOf(Date);
  });

  it("is idempotent when the same signature is captured again", async () => {
    const seed = seedFieldJob();
    const attachment = seedSignatureImage(seed.company.id, seed.job.id);
    await capture(authOf(seed), seed.job.id, { attachmentId: attachment.id, signedByName: "Pat" });

    const replay = await capture(
      authOf(seed),
      seed.job.id,
      { attachmentId: attachment.id, signedByName: "Pat" },
      { clientOperationId: "sig-2" }
    );

    expect(replay.body.results[0].outcome).toBe("applied");
    expect(replay.body.results[0].message).toMatch(/already captured/i);
  });

  it("conflicts when a different signature is already on file", async () => {
    const seed = seedFieldJob();
    const first = seedSignatureImage(seed.company.id, seed.job.id);
    const second = seedSignatureImage(seed.company.id, seed.job.id, {
      fileUrl: `memory-object://attachments/${seed.company.id}/2-signature.png`
    });
    await capture(authOf(seed), seed.job.id, { attachmentId: first.id, signedByName: "Pat" });

    const response = await capture(
      authOf(seed),
      seed.job.id,
      { attachmentId: second.id, signedByName: "Pat" },
      { clientOperationId: "sig-2" }
    );

    expect(response.body.results[0].outcome).toBe("conflict");
    expect(response.body.results[0].conflict?.reason).toMatch(/different signature/i);
  });

  it("conflicts on a stale baseRecordVersion", async () => {
    const seed = seedFieldJob();
    const attachment = seedSignatureImage(seed.company.id, seed.job.id);
    const stale = buildRecordVersionV1("job", seed.job.id, new Date("2020-01-01T00:00:00.000Z"));

    const response = await capture(
      authOf(seed),
      seed.job.id,
      { attachmentId: attachment.id, signedByName: "Pat" },
      { baseRecordVersion: stale }
    );

    expect(response.body.results[0].outcome).toBe("conflict");
    expect(fakeDb.getTestState().jobs[0]!.signatureUrl ?? null).toBeNull();
  });

  it("rejects an attachment that belongs to another job", async () => {
    const seed = seedFieldJob();
    const otherJob = fakeDb.seedJob({
      companyId: seed.company.id,
      customerId: seed.job.customerId,
      status: "dispatched",
      title: "Other"
    });
    const attachment = seedSignatureImage(seed.company.id, otherJob.id);

    const response = await capture(authOf(seed), seed.job.id, { attachmentId: attachment.id, signedByName: "Pat" });

    expect(response.body.results[0].outcome).toBe("rejected");
    expect(response.body.results[0].code).toBe("SIGNATURE_ATTACHMENT_INVALID");
    expect(response.body.results[0].message).toBe("Signature attachment not found on this job");
  });

  it("rejects another company's attachment with the same generic message (no leak)", async () => {
    const seed = seedFieldJob();
    const otherCompany = fakeDb.seedCompany({ name: "Other Co", slug: "other-co" });
    const foreign = seedSignatureImage(otherCompany.id, seed.job.id);

    const response = await capture(authOf(seed), seed.job.id, { attachmentId: foreign.id, signedByName: "Pat" });

    expect(response.body.results[0].outcome).toBe("rejected");
    expect(response.body.results[0].code).toBe("SIGNATURE_ATTACHMENT_INVALID");
    expect(response.body.results[0].message).toBe("Signature attachment not found on this job");
    expect(JSON.stringify(response.body)).not.toContain(otherCompany.id);
    expect(fakeDb.getTestState().jobs[0]!.signatureUrl ?? null).toBeNull();
  });

  it("rejects signature capture by a technician who is not assigned to the job", async () => {
    const seed = seedFieldJob();
    const otherUser = fakeDb.seedUser({
      companyId: seed.company.id,
      email: "other-tech@field-co.test",
      firstName: "Other",
      lastName: "Tech",
      role: "technician"
    });
    fakeDb.seedTechnician({
      companyId: seed.company.id,
      userId: otherUser.id,
      firstName: "Other",
      lastName: "Tech",
      phone: "+15555550102"
    });
    const attachment = seedSignatureImage(seed.company.id, seed.job.id);

    const response = await capture(
      { companyId: seed.company.id, userId: otherUser.id, role: "technician" },
      seed.job.id,
      { attachmentId: attachment.id, signedByName: "Pat" }
    );

    expect(response.status).toBe(200);
    expect(response.body.results[0].outcome).toBe("rejected");
    expect(fakeDb.getTestState().jobs[0]!.signatureUrl).toBeNull();
  });

  it("rejects a non-image attachment", async () => {
    const seed = seedFieldJob();
    const pdf = seedSignatureImage(seed.company.id, seed.job.id, { mimeType: "application/pdf", fileName: "a.pdf" });

    const response = await capture(authOf(seed), seed.job.id, { attachmentId: pdf.id, signedByName: "Pat" });

    expect(response.body.results[0].outcome).toBe("rejected");
    expect(response.body.results[0].message).toMatch(/PNG, JPEG, or WebP/);
  });

  it("rejects a soft-deleted signature attachment", async () => {
    const seed = seedFieldJob();
    const deleted = seedSignatureImage(seed.company.id, seed.job.id, {
      deletedAt: new Date("2026-10-20T00:00:00.000Z")
    });

    const response = await capture(authOf(seed), seed.job.id, {
      attachmentId: deleted.id,
      signedByName: "Pat"
    });

    expect(response.body.results[0].outcome).toBe("rejected");
    expect(response.body.results[0].code).toBe("SIGNATURE_ATTACHMENT_INVALID");
    expect(response.body.results[0].message).toBe("Signature attachment not found on this job");
    expect(fakeDb.getTestState().jobs[0]!.signatureUrl).toBeNull();
  });

  it("rejects an oversized attachment", async () => {
    const seed = seedFieldJob();
    const huge = seedSignatureImage(seed.company.id, seed.job.id, { fileSizeBytes: 40 * 1024 * 1024 });

    const response = await capture(authOf(seed), seed.job.id, { attachmentId: huge.id, signedByName: "Pat" });

    expect(response.body.results[0].outcome).toBe("rejected");
    expect(response.body.results[0].message).toMatch(/size/i);
  });

  it.each([
    ["neither", { signedByName: "Pat" }],
    [
      "both",
      {
        attachmentId: "00000000-0000-4000-8000-000000000001",
        signatureUrl: "https://cdn.example/sig.png",
        signedByName: "Pat"
      }
    ],
    ["blank signer", { signatureUrl: "https://cdn.example/sig.png", signedByName: "   " }]
  ])("rejects payload with %s", async (_label, payload) => {
    const seed = seedFieldJob();
    const response = await capture(authOf(seed), seed.job.id, payload);
    expect(response.status).toBe(400);
  });

  it("still accepts a legacy signatureUrl and returns it unchanged on read", async () => {
    const seed = seedFieldJob();
    const response = await capture(authOf(seed), seed.job.id, {
      signatureUrl: "https://cdn.example/legacy-sig.png",
      signedByName: "Pat"
    });
    expect(response.body.results[0].outcome).toBe("applied");

    const read = await request(app.server)
      .get(`/api/v1/jobs/${seed.job.id}`)
      .set("Authorization", bearer(seed.company.id, seed.techUser.id, seed.techUser.role));
    expect(read.status).toBe(200);
    expect(read.body.job.signatureUrl).toBe("https://cdn.example/legacy-sig.png");
  });

  it("job read returns a freshly signed URL and never the raw storage key", async () => {
    const seed = seedFieldJob();
    const attachment = seedSignatureImage(seed.company.id, seed.job.id);
    await capture(authOf(seed), seed.job.id, { attachmentId: attachment.id, signedByName: "Pat" });

    const read = await request(app.server)
      .get(`/api/v1/jobs/${seed.job.id}`)
      .set("Authorization", bearer(seed.company.id, seed.techUser.id, seed.techUser.role));

    expect(read.status).toBe(200);
    expect(read.body.job.signatureUrl).toBe(
      `https://signed.example/attachments/${seed.company.id}/1-signature.png?expires=1`
    );
    expect(JSON.stringify(read.body)).not.toContain("renvani-object:");
    expect(JSON.stringify(read.body)).not.toContain("memory-object://");
  });

  it("job read fails closed (null) for a ref outside the tenant prefix", async () => {
    const seed = seedFieldJob();
    fakeDb.getTestState().jobs[0] = {
      ...fakeDb.getTestState().jobs[0]!,
      signatureUrl: "renvani-object:attachments/someone-else/1-signature.png"
    };

    const read = await request(app.server)
      .get(`/api/v1/jobs/${seed.job.id}`)
      .set("Authorization", bearer(seed.company.id, seed.techUser.id, seed.techUser.role));

    expect(read.body.job.signatureUrl).toBeNull();
    expect(JSON.stringify(read.body)).not.toContain("someone-else");
  });
});
