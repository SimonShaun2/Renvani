import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const uploadFileMock = vi.hoisted(() => vi.fn());
const createSignedDownloadUrlMock = vi.hoisted(() => vi.fn());

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
  notificationsQueue: { add: vi.fn() }
}));

vi.mock("../../lib/storage.js", () => ({
  uploadFile: uploadFileMock,
  createSignedDownloadUrl: createSignedDownloadUrlMock,
  getFileKeyFromUrl: (reference: string) => {
    const filesExamplePrefix = "https://files.example/";
    if (reference.startsWith(filesExamplePrefix)) {
      return reference.slice(filesExamplePrefix.length);
    }

    if (reference.startsWith("memory-object://")) {
      return reference.slice("memory-object://".length);
    }

    return reference;
  },
  getMediaSignedUrlTtlSeconds: () => 900
}));

vi.mock("sharp", () => ({
  default: () => ({
    resize: () => ({
      webp: () => ({
        toBuffer: async () => Buffer.from("webp-thumb")
      })
    })
  })
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
  fakeDb.resetTestState();
  uploadFileMock.mockReset();
  uploadFileMock.mockImplementation(async (key: string) => ({
    url: `https://files.example/${key}`,
    key
  }));
  createSignedDownloadUrlMock.mockReset();
  createSignedDownloadUrlMock.mockImplementation(async (objectKey: string) => ({
    url: `https://signed.example/${objectKey}?expires=1`,
    expiresAt: new Date(Date.now() + 900_000),
    objectKey
  }));
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function authForCompany(
  companyId: string,
  userId: string,
  role: "owner" | "admin" | "dispatcher" | "technician" = "owner"
) {
  const accessToken = tokens.generateAccessToken({
    userId,
    companyId,
    role
  });
  return `Bearer ${accessToken}`;
}

describe("FS-85 attachments API tenant access", () => {
  it("returns 404 on cross-tenant delete and does not leak metadata via list", async () => {
    const companyA = fakeDb.seedCompany({ name: "A", slug: "fs85-route-a" });
    const companyB = fakeDb.seedCompany({ name: "B", slug: "fs85-route-b" });
    const userA = fakeDb.seedUser({
      companyId: companyA.id,
      email: "a-route@fs85.example",
      firstName: "A",
      lastName: "User",
      role: "owner"
    });
    const userB = fakeDb.seedUser({
      companyId: companyB.id,
      email: "b-route@fs85.example",
      firstName: "B",
      lastName: "User",
      role: "owner"
    });
    const customerB = fakeDb.seedCustomer({
      companyId: companyB.id,
      firstName: "B",
      lastName: "Cust",
      email: "cust@b.example"
    });
    const jobB = fakeDb.seedJob({
      companyId: companyB.id,
      customerId: customerB.id,
      title: "B job",
      status: "scheduled"
    });
    const attachmentB = fakeDb.seedFileAttachment({
      companyId: companyB.id,
      entityType: "job",
      entityId: jobB.id,
      jobId: jobB.id,
      customerId: customerB.id,
      uploadedById: userB.id,
      fileName: "private.txt",
      fileUrl: `https://files.example/attachments/${companyB.id}/private.txt`,
      mimeType: "text/plain"
    });

    const listAsA = await request(app.server)
      .get(`/api/v1/attachments?entityType=job&entityId=${jobB.id}`)
      .set("Authorization", authForCompany(companyA.id, userA.id));

    expect(listAsA.status).toBe(404);
    expect(listAsA.body.error).toBe("NOT_FOUND");

    const deleteAsA = await request(app.server)
      .delete(`/api/v1/attachments/${attachmentB.id}`)
      .set("Authorization", authForCompany(companyA.id, userA.id));

    expect(deleteAsA.status).toBe(404);

    const stillThere = fakeDb.getTestState().fileAttachments.find((row) => row.id === attachmentB.id);
    expect(stillThere?.deletedAt).toBeNull();
  });

  it("denies an unassigned technician list, signed read, and delete for another technician's job", async () => {
    const company = fakeDb.seedCompany({ name: "Tech Co", slug: "fs192-route-tech" });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Pat",
      lastName: "Customer",
      email: "pat@fs192-route.test"
    });
    const assignedUser = fakeDb.seedUser({
      companyId: company.id,
      email: "assigned@fs192-route.test",
      firstName: "Assigned",
      lastName: "Tech",
      role: "technician"
    });
    const assignedTechnician = fakeDb.seedTechnician({
      companyId: company.id,
      userId: assignedUser.id,
      firstName: "Assigned",
      lastName: "Tech",
      phone: "+15555550301"
    });
    const otherUser = fakeDb.seedUser({
      companyId: company.id,
      email: "other@fs192-route.test",
      firstName: "Other",
      lastName: "Tech",
      role: "technician"
    });
    fakeDb.seedTechnician({
      companyId: company.id,
      userId: otherUser.id,
      firstName: "Other",
      lastName: "Tech",
      phone: "+15555550302"
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      technicianId: assignedTechnician.id,
      title: "Assigned job",
      status: "dispatched"
    });
    const attachment = fakeDb.seedFileAttachment({
      companyId: company.id,
      entityType: "job",
      entityId: job.id,
      jobId: job.id,
      customerId: customer.id,
      uploadedById: assignedUser.id,
      fileName: "assigned-private.png",
      fileUrl: `memory-object://attachments/${company.id}/assigned-private.png`,
      mimeType: "image/png"
    });
    const authorization = authForCompany(company.id, otherUser.id, "technician");

    const listed = await request(app.server)
      .get(`/api/v1/attachments?entityType=job&entityId=${job.id}`)
      .set("Authorization", authorization);
    expect(listed.status).toBe(404);
    expect(listed.body.error).toBe("NOT_FOUND");

    const signedRead = await request(app.server)
      .get(`/api/v1/attachments/${attachment.id}/download-url`)
      .set("Authorization", authorization);
    expect(signedRead.status).toBe(404);
    expect(signedRead.body.error).toBe("NOT_FOUND");

    const deleted = await request(app.server)
      .delete(`/api/v1/attachments/${attachment.id}`)
      .set("Authorization", authorization);
    expect(deleted.status).toBe(403);
    expect(deleted.body.error).toBe("FORBIDDEN");

    expect(createSignedDownloadUrlMock).not.toHaveBeenCalled();
    const stored = fakeDb.getTestState().fileAttachments.find((row) => row.id === attachment.id);
    expect(stored?.deletedAt).toBeNull();
  });

  it("preserves same-tenant job attachment lists for owner, admin, and dispatcher", async () => {
    const company = fakeDb.seedCompany({ name: "Office Co", slug: "fs192-route-office" });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Office",
      lastName: "Customer",
      email: "customer@fs192-office.test"
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Office-visible job",
      status: "scheduled"
    });
    const owner = fakeDb.seedUser({
      companyId: company.id,
      email: "owner@fs192-office.test",
      firstName: "Office",
      lastName: "Owner",
      role: "owner"
    });
    const attachment = fakeDb.seedFileAttachment({
      companyId: company.id,
      entityType: "job",
      entityId: job.id,
      jobId: job.id,
      customerId: customer.id,
      uploadedById: owner.id,
      fileName: "office-visible.png",
      fileUrl: `memory-object://attachments/${company.id}/office-visible.png`,
      mimeType: "image/png"
    });

    for (const role of ["owner", "admin", "dispatcher"] as const) {
      const user = role === "owner"
        ? owner
        : fakeDb.seedUser({
          companyId: company.id,
          email: `${role}@fs192-office.test`,
          firstName: "Office",
          lastName: role,
          role
        });
      const response = await request(app.server)
        .get(`/api/v1/attachments?entityType=job&entityId=${job.id}`)
        .set("Authorization", authForCompany(company.id, user.id, role));

      expect(response.status, role).toBe(200);
      expect(response.body.data, role).toHaveLength(1);
      expect(response.body.data[0]?.id, role).toBe(attachment.id);
    }
  });

  it("returns 404 when uploading against another tenant's job entity", async () => {
    const companyA = fakeDb.seedCompany({ name: "A2", slug: "fs85-route-a2" });
    const companyB = fakeDb.seedCompany({ name: "B2", slug: "fs85-route-b2" });
    const userA = fakeDb.seedUser({
      companyId: companyA.id,
      email: "a2@fs85.example",
      firstName: "A2",
      lastName: "User",
      role: "owner"
    });
    const customerB = fakeDb.seedCustomer({
      companyId: companyB.id,
      firstName: "B2",
      lastName: "Cust",
      email: "cust2@b.example"
    });
    const jobB = fakeDb.seedJob({
      companyId: companyB.id,
      customerId: customerB.id,
      title: "B2 job",
      status: "scheduled"
    });

    const uploadAsA = await request(app.server)
      .post("/api/v1/attachments")
      .set("Authorization", authForCompany(companyA.id, userA.id))
      .field("entityType", "job")
      .field("entityId", jobB.id)
      .attach("file", Buffer.from("x"), {
        filename: "x.txt",
        contentType: "text/plain"
      });

    expect(uploadAsA.status).toBe(404);
    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated attachment list", async () => {
    const response = await request(app.server).get(
      "/api/v1/attachments?entityType=job&entityId=550e8400-e29b-41d4-a716-446655440000"
    );

    expect(response.status).toBe(401);
  });

  it("returns short-lived signed URLs for same-tenant list (FS-149)", async () => {
    const company = fakeDb.seedCompany({ name: "Signed Co", slug: "fs149-signed" });
    const user = fakeDb.seedUser({
      companyId: company.id,
      email: "signed@fs149.example",
      firstName: "Sign",
      lastName: "Ed",
      role: "owner"
    });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Cust",
      lastName: "Files",
      email: "files@fs149.example"
    });
    const objectKey = `${company.id}/imports/bundle-a/photo.jpg`;
    fakeDb.seedFileAttachment({
      companyId: company.id,
      entityType: "customer",
      entityId: customer.id,
      customerId: customer.id,
      uploadedById: user.id,
      fileName: "photo.jpg",
      fileUrl: `memory-object://${objectKey}`,
      mimeType: "image/jpeg",
      fileType: "photo"
    });

    const response = await request(app.server)
      .get(`/api/v1/attachments?entityType=customer&entityId=${customer.id}`)
      .set("Authorization", authForCompany(company.id, user.id));

    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]?.fileUrl).toBe(`https://signed.example/${objectKey}?expires=1`);
    expect(response.body.data[0]?.fileName).toBe("photo.jpg");
  });
});
