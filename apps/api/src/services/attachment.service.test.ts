import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const uploadFileMock = vi.hoisted(() => vi.fn());
const createSignedDownloadUrlMock = vi.hoisted(() => vi.fn());
const createSignedUploadUrlMock = vi.hoisted(() => vi.fn());

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("../lib/storage.js", () => ({
  uploadFile: uploadFileMock,
  createSignedDownloadUrl: createSignedDownloadUrlMock,
  createSignedUploadUrl: createSignedUploadUrlMock,
  getFileKeyFromUrl: (reference: string) => {
    if (reference.startsWith("memory-object://")) {
      return reference.slice("memory-object://".length);
    }

    const filesExamplePrefix = "https://files.example/";
    if (reference.startsWith(filesExamplePrefix)) {
      return reference.slice(filesExamplePrefix.length);
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

type AttachmentServiceModule = typeof import("./attachment.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let attachmentService: AttachmentServiceModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  attachmentService = await import("./attachment.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  uploadFileMock.mockReset();
  createSignedDownloadUrlMock.mockReset();
  createSignedUploadUrlMock.mockReset();
  uploadFileMock.mockImplementation(async (key: string) => ({
    url: `https://files.example/${key}`,
    key
  }));
  createSignedDownloadUrlMock.mockImplementation(async (objectKey: string) => ({
    url: `https://signed.example/${objectKey}?expires=1`,
    expiresAt: new Date(Date.now() + 900_000),
    objectKey
  }));
  createSignedUploadUrlMock.mockImplementation(async (objectKey: string) => ({
    url: `https://upload.example/${objectKey}`,
    expiresAt: new Date(Date.now() + 900_000),
    objectKey
  }));
});

describe("FS-192 technician job attachment upload access", () => {
  it("denies multipart and signed upload paths for another technician's job before storage", async () => {
    const company = fakeDb.seedCompany({ name: "Field", slug: "fs192-field" });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Pat", lastName: "Customer" });
    const assignedUser = fakeDb.seedUser({ companyId: company.id, email: "assigned@example.test", firstName: "A", lastName: "Tech", role: "technician" });
    const assignedTech = fakeDb.seedTechnician({ companyId: company.id, userId: assignedUser.id, firstName: "A", lastName: "Tech", phone: "+15555550101" });
    const otherUser = fakeDb.seedUser({ companyId: company.id, email: "other@example.test", firstName: "B", lastName: "Tech", role: "technician" });
    fakeDb.seedTechnician({ companyId: company.id, userId: otherUser.id, firstName: "B", lastName: "Tech", phone: "+15555550102" });
    const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, technicianId: assignedTech.id, title: "Service", status: "dispatched" });
    const input = { entityType: "job" as const, entityId: job.id, fileName: "signature.png", mimeType: "image/png" };

    await expect(attachmentService.uploadAttachment(company.id, otherUser.id, {
      ...input,
      fileBuffer: Buffer.from("signature")
    })).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    await expect(attachmentService.createAttachmentUploadUrl(company.id, otherUser.id, {
      ...input,
      fileSizeBytes: 9
    })).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
    expect(uploadFileMock).not.toHaveBeenCalled();
    expect(createSignedUploadUrlMock).not.toHaveBeenCalled();
  });

  it("denies an unassigned technician list, signed read, and delete before storage or mutation", async () => {
    const company = fakeDb.seedCompany({ name: "Field read", slug: "fs192-field-read" });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Pat", lastName: "Customer" });
    const assignedUser = fakeDb.seedUser({ companyId: company.id, email: "assigned-read@example.test", firstName: "A", lastName: "Tech", role: "technician" });
    const assignedTech = fakeDb.seedTechnician({ companyId: company.id, userId: assignedUser.id, firstName: "A", lastName: "Tech", phone: "+15555550201" });
    const otherUser = fakeDb.seedUser({ companyId: company.id, email: "other-read@example.test", firstName: "B", lastName: "Tech", role: "technician" });
    fakeDb.seedTechnician({ companyId: company.id, userId: otherUser.id, firstName: "B", lastName: "Tech", phone: "+15555550202" });
    const job = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, technicianId: assignedTech.id, title: "Assigned service", status: "dispatched" });
    const attachment = fakeDb.seedFileAttachment({
      companyId: company.id,
      entityType: "job",
      entityId: job.id,
      jobId: job.id,
      customerId: customer.id,
      uploadedById: assignedUser.id,
      fileName: "private-signature.png",
      fileUrl: `memory-object://attachments/${company.id}/private-signature.png`,
      mimeType: "image/png"
    });

    await expect(attachmentService.listAttachments(company.id, otherUser.id, {
      entityType: "job",
      entityId: job.id
    })).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    await expect(
      attachmentService.mintAttachmentDownloadUrl(company.id, otherUser.id, attachment.id)
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    await expect(
      attachmentService.deleteAttachment(company.id, otherUser.id, attachment.id)
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });

    expect(createSignedDownloadUrlMock).not.toHaveBeenCalled();
    const stored = fakeDb.getTestState().fileAttachments.find((row) => row.id === attachment.id);
    expect(stored?.deletedAt).toBeNull();
  });
});

function seedTenantPair() {
  const companyA = fakeDb.seedCompany({ name: "FS-85 Tenant A", slug: "fs85-a" });
  const companyB = fakeDb.seedCompany({ name: "FS-85 Tenant B", slug: "fs85-b" });
  const userA = fakeDb.seedUser({
    companyId: companyA.id,
    email: "a@fs85.example",
    firstName: "A",
    lastName: "Owner",
    role: "owner"
  });
  const userB = fakeDb.seedUser({
    companyId: companyB.id,
    email: "b@fs85.example",
    firstName: "B",
    lastName: "Owner",
    role: "owner"
  });
  const customerB = fakeDb.seedCustomer({
    companyId: companyB.id,
    firstName: "B",
    lastName: "Customer",
    email: "cust-b@fs85.example"
  });
  const jobB = fakeDb.seedJob({
    companyId: companyB.id,
    customerId: customerB.id,
    title: "Tenant B job",
    status: "scheduled"
  });
  const attachmentB = fakeDb.seedFileAttachment({
    companyId: companyB.id,
    entityType: "job",
    entityId: jobB.id,
    jobId: jobB.id,
    customerId: customerB.id,
    uploadedById: userB.id,
    fileName: "secret.pdf",
    fileUrl: `https://files.example/attachments/${companyB.id}/secret.pdf`,
    mimeType: "application/pdf"
  });

  return { companyA, companyB, userA, userB, customerB, jobB, attachmentB };
}

describe("FS-85 attachment.service tenant access", () => {
  it("denies delete when attachment belongs to another company", async () => {
    const { companyA, userA, attachmentB } = seedTenantPair();

    await expect(
      attachmentService.deleteAttachment(companyA.id, userA.id, attachmentB.id)
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
  });

  it("does not list another tenant's attachments for the same entity id probe", async () => {
    const { companyA, userA, userB, jobB, attachmentB } = seedTenantPair();

    await expect(attachmentService.listAttachments(companyA.id, userA.id, {
      entityType: "job",
      entityId: jobB.id
    })).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });

    const tenantBList = await attachmentService.listAttachments(attachmentB.companyId, userB.id, {
      entityType: "job",
      entityId: jobB.id
    });
    expect(tenantBList.data).toHaveLength(1);
    expect(tenantBList.data[0]?.id).toBe(attachmentB.id);
  });

  it("denies upload when entity is not owned by the requesting company", async () => {
    const { companyA, userA, jobB } = seedTenantPair();

    await expect(
      attachmentService.uploadAttachment(companyA.id, userA.id, {
        entityType: "job",
        entityId: jobB.id,
        fileName: "probe.txt",
        mimeType: "text/plain",
        fileBuffer: Buffer.from("probe")
      })
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });

    expect(uploadFileMock).not.toHaveBeenCalled();
  });

  it("allows upload and list within the same tenant", async () => {
    const { companyB, userB, jobB, customerB } = seedTenantPair();

    const attachment = await attachmentService.uploadAttachment(companyB.id, userB.id, {
      entityType: "job",
      entityId: jobB.id,
      fileName: "field-photo.jpg",
      mimeType: "image/jpeg",
      fileBuffer: Buffer.from("jpeg-bytes")
    });

    expect(attachment.companyId).toBe(companyB.id);
    expect(uploadFileMock).toHaveBeenCalled();

    const listed = await attachmentService.listAttachments(companyB.id, userB.id, {
      entityType: "job",
      entityId: jobB.id
    });

    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.data.some((row) => row.id === attachment.id)).toBe(true);
    expect(listed.data.every((row) => row.customerId === customerB.id || row.customerId === null)).toBe(
      true
    );
    expect(listed.data[0]?.fileUrl).toContain("https://signed.example/");
  });

  it("signs import-bundle object keys when listing customer attachments", async () => {
    const { companyB, userB, customerB } = seedTenantPair();
    const importObjectKey = `${companyB.id}/imports/bundle-1/photos/job-photo.jpg`;
    fakeDb.seedFileAttachment({
      companyId: companyB.id,
      entityType: "customer",
      entityId: customerB.id,
      customerId: customerB.id,
      fileName: "job-photo.jpg",
      fileUrl: `memory-object://${importObjectKey}`,
      mimeType: "image/jpeg",
      fileType: "photo"
    });

    const listed = await attachmentService.listAttachments(companyB.id, userB.id, {
      entityType: "customer",
      entityId: customerB.id
    });

    expect(listed.data).toHaveLength(1);
    expect(listed.data[0]?.fileUrl).toBe(`https://signed.example/${importObjectKey}?expires=1`);
    expect(createSignedDownloadUrlMock).toHaveBeenCalledWith(importObjectKey, 900);
  });

  it("fails closed (omits row, never leaks raw URL) when a stored key belongs to another tenant", async () => {
    const { companyA, companyB, userB, customerB } = seedTenantPair();
    const foreignKey = `${companyA.id}/imports/bundle-x/photos/leak.jpg`;
    fakeDb.seedFileAttachment({
      companyId: companyB.id,
      entityType: "customer",
      entityId: customerB.id,
      customerId: customerB.id,
      fileName: "leak.jpg",
      fileUrl: `memory-object://${foreignKey}`,
      thumbnailUrl: `https://files.example/${foreignKey}`,
      mimeType: "image/jpeg",
      fileType: "photo"
    });

    const listed = await attachmentService.listAttachments(companyB.id, userB.id, {
      entityType: "customer",
      entityId: customerB.id
    });

    expect(listed.data).toHaveLength(0);
    expect(JSON.stringify(listed)).not.toContain(foreignKey);
    expect(createSignedDownloadUrlMock).not.toHaveBeenCalledWith(foreignKey, expect.anything());
  });

  it("fails closed when signing throws", async () => {
    const { companyB, userB, customerB } = seedTenantPair();
    const key = `${companyB.id}/imports/bundle-1/photos/ok.jpg`;
    fakeDb.seedFileAttachment({
      companyId: companyB.id,
      entityType: "customer",
      entityId: customerB.id,
      customerId: customerB.id,
      fileName: "ok.jpg",
      fileUrl: `memory-object://${key}`,
      mimeType: "image/jpeg",
      fileType: "photo"
    });
    createSignedDownloadUrlMock.mockRejectedValueOnce(new Error("signer down"));

    const listed = await attachmentService.listAttachments(companyB.id, userB.id, {
      entityType: "customer",
      entityId: customerB.id
    });

    expect(listed.data).toHaveLength(0);
    expect(JSON.stringify(listed)).not.toContain("memory-object://");
  });

  it("nulls an unsignable thumbnail while keeping a signable file", async () => {
    const { companyA, companyB, userB, customerB } = seedTenantPair();
    const key = `${companyB.id}/imports/bundle-1/photos/ok.jpg`;
    const foreignThumb = `${companyA.id}/thumbs/leak.jpg`;
    fakeDb.seedFileAttachment({
      companyId: companyB.id,
      entityType: "customer",
      entityId: customerB.id,
      customerId: customerB.id,
      fileName: "ok.jpg",
      fileUrl: `memory-object://${key}`,
      thumbnailUrl: `memory-object://${foreignThumb}`,
      mimeType: "image/jpeg",
      fileType: "photo"
    });

    const listed = await attachmentService.listAttachments(companyB.id, userB.id, {
      entityType: "customer",
      entityId: customerB.id
    });

    expect(listed.data[0]?.fileUrl).toBe(`https://signed.example/${key}?expires=1`);
    expect(listed.data[0]?.thumbnailUrl).toBeNull();
  });
});
