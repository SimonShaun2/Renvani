import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { closeTestApp } from "../../test-support/close-test-app.js";
import { setupTestEnv } from "../../test-support/env-setup.js";
import { CSV_IMPORT_TOO_MANY_FILES_MESSAGE } from "./upload-limits.js";

setupTestEnv();

const {
  addAgreementsQueueJob,
  addAiQueueJob,
  addImportsQueueJob,
  addInvoiceQueueJob,
  addNotificationQueueJob,
  uploadCsvToR2Mock
} = vi.hoisted(() => ({
  addAgreementsQueueJob: vi.fn(),
  addAiQueueJob: vi.fn(),
  addImportsQueueJob: vi.fn(),
  addInvoiceQueueJob: vi.fn(),
  addNotificationQueueJob: vi.fn(),
  uploadCsvToR2Mock: vi.fn()
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
  agreementsQueue: {
    add: addAgreementsQueueJob
  },
  aiQueue: {
    add: addAiQueueJob
  },
  importsQueue: {
    add: addImportsQueueJob
  },
  invoicesQueue: {
    add: addInvoiceQueueJob
  },
  notificationsQueue: {
    add: addNotificationQueueJob
  }
}));

vi.mock("../../services/file-upload.service.js", () => ({
  uploadCsvToR2: uploadCsvToR2Mock
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
  addAgreementsQueueJob.mockReset();
  addAiQueueJob.mockReset();
  addImportsQueueJob.mockReset();
  addInvoiceQueueJob.mockReset();
  addNotificationQueueJob.mockReset();
  uploadCsvToR2Mock.mockReset();
  uploadCsvToR2Mock.mockImplementation(
    async (
      companyId: string,
      fileName: string,
      _fileBuffer: Buffer,
      mimeType: string
    ) => {
      const isCsvFile =
        mimeType === "text/csv" ||
        mimeType === "application/vnd.ms-excel" ||
        fileName.toLowerCase().endsWith(".csv");

      if (!isCsvFile) {
        const { AppError, ErrorCode } = await import("@fsm/types");
        throw new AppError(ErrorCode.VALIDATION_ERROR, "Only CSV files can be uploaded");
      }

      return {
        fileUrl: `https://r2.test/fsm-bucket/imports/${companyId}/${fileName}`,
        fileKey: `imports/${companyId}/${fileName}`
      };
    }
  );

  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await closeTestApp(app);
});

function createAuthContext(role: "owner" | "admin" | "technician" = "owner") {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}@example.com`,
    firstName: "Ava",
    lastName: "Stone",
    role
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

describe("imports routes", () => {
  it("POST /imports returns 201 for owners, 400 for non-CSV files, and 403 for technician role", async () => {
    const owner = createAuthContext("owner");
    const technician = createAuthContext("technician");

    const successResponse = await request(app.server)
      .post("/api/v1/imports")
      .set("Authorization", owner.authorization)
      .attach("file", Buffer.from("First Name,Email\nChris,chris@example.com"), {
        filename: "customers.csv",
        contentType: "text/csv"
      });
    const invalidResponse = await request(app.server)
      .post("/api/v1/imports")
      .set("Authorization", owner.authorization)
      .attach("file", Buffer.from("not,csv"), {
        filename: "notes.txt",
        contentType: "text/plain"
      });
    const forbiddenResponse = await request(app.server)
      .post("/api/v1/imports")
      .set("Authorization", technician.authorization)
      .attach("file", Buffer.from("First Name,Email\nChris,chris@example.com"), {
        filename: "customers.csv",
        contentType: "text/csv"
      });

    expect(successResponse.status).toBe(201);
    expect(successResponse.body.importSession.status).toBe("uploaded");
    expect(invalidResponse.status).toBe(400);
    expect(forbiddenResponse.status).toBe(403);
  });

  it("POST /imports returns 400 when more than one file is attached", async () => {
    const owner = createAuthContext("owner");
    const csv = Buffer.from("First Name,Email\nChris,chris@example.com");

    const response = await request(app.server)
      .post("/api/v1/imports")
      .set("Authorization", owner.authorization)
      .attach("file", csv, { filename: "a.csv", contentType: "text/csv" })
      .attach("secondaryFile", csv, { filename: "b.csv", contentType: "text/csv" });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(ErrorCode.VALIDATION_ERROR);
    expect(response.body.message).toBe(CSV_IMPORT_TOO_MANY_FILES_MESSAGE);
    expect(addImportsQueueJob).not.toHaveBeenCalled();
  });

  it("GET /imports returns a paginated list", async () => {
    const auth = createAuthContext("admin");
    fakeDb.seedImportSession({
      companyId: auth.company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "completed"
    });

    const response = await request(app.server)
      .get("/api/v1/imports?page=1&limit=10")
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.data).toHaveLength(1);
  });

  it("GET /imports/:id returns detail and 404 for unknown sessions", async () => {
    const auth = createAuthContext("owner");
    const importSession = fakeDb.seedImportSession({
      companyId: auth.company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "mapping"
    });

    const successResponse = await request(app.server)
      .get(`/api/v1/imports/${importSession.id}`)
      .set("Authorization", auth.authorization);
    const missingResponse = await request(app.server)
      .get("/api/v1/imports/11111111-1111-1111-1111-111111111111")
      .set("Authorization", auth.authorization);

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.importSession.id).toBe(importSession.id);
    expect(missingResponse.status).toBe(404);
  });

  it("POST /imports/:id/confirm-mapping returns 200 with merged mappings", async () => {
    const auth = createAuthContext("owner");
    const importSession = fakeDb.seedImportSession({
      companyId: auth.company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "mapping",
      columnMappings: {
        Email: "email"
      }
    });

    const response = await request(app.server)
      .post(`/api/v1/imports/${importSession.id}/confirm-mapping`)
      .set("Authorization", auth.authorization)
      .send({
        mappingOverrides: {
          "First Name": "firstName"
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.importSession.status).toBe("preview");
    expect(response.body.importSession.columnMappings).toEqual({
      Email: "email",
      "First Name": "firstName"
    });
  });

  it("POST /imports/:id/start returns 200 for preview sessions and 409 otherwise", async () => {
    const auth = createAuthContext("owner");
    const previewSession = fakeDb.seedImportSession({
      companyId: auth.company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "preview"
    });
    const invalidSession = fakeDb.seedImportSession({
      companyId: auth.company.id,
      fileName: "customers-2.csv",
      fileUrl: "https://r2.test/2",
      status: "mapping"
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/imports/${previewSession.id}/start`)
      .set("Authorization", auth.authorization)
      .send();
    const conflictResponse = await request(app.server)
      .post(`/api/v1/imports/${invalidSession.id}/start`)
      .set("Authorization", auth.authorization)
      .send();

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.importSession.status).toBe("importing");
    expect(conflictResponse.status).toBe(409);
  });

  it("POST /imports/:id/rollback returns 200 for completed sessions and 409 otherwise", async () => {
    const auth = createAuthContext("owner");
    const completedSession = fakeDb.seedImportSession({
      companyId: auth.company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "completed"
    });
    const customer = fakeDb.seedCustomer({
      companyId: auth.company.id,
      firstName: "Chris",
      lastName: "Pine",
      importSessionId: completedSession.id
    });
    const previewSession = fakeDb.seedImportSession({
      companyId: auth.company.id,
      fileName: "customers-2.csv",
      fileUrl: "https://r2.test/2",
      status: "preview"
    });

    const successResponse = await request(app.server)
      .post(`/api/v1/imports/${completedSession.id}/rollback`)
      .set("Authorization", auth.authorization)
      .send();
    const conflictResponse = await request(app.server)
      .post(`/api/v1/imports/${previewSession.id}/rollback`)
      .set("Authorization", auth.authorization)
      .send();

    expect(successResponse.status).toBe(200);
    expect(successResponse.body.importSession.status).toBe("rolled_back");
    expect(fakeDb.getTestState().customers.find((row) => row.id === customer.id)?.deletedAt).not.toBeNull();
    expect(conflictResponse.status).toBe(409);
  });

  it("STACK03-JWT-02/03: cross-tenant import session read returns 404", async () => {
    const tenantA = createAuthContext("owner");
    const tenantB = createAuthContext("owner");
    const sessionA = fakeDb.seedImportSession({
      companyId: tenantA.company.id,
      fileName: "customers-a.csv",
      fileUrl: "https://r2.test/a",
      status: "preview",
      validationErrors: [{ row: 1, field: "email", message: "bad", value: "x" }]
    });

    const getSession = await request(app.server)
      .get(`/api/v1/imports/${sessionA.id}`)
      .set("Authorization", tenantB.authorization);
    const getErrors = await request(app.server)
      .get(`/api/v1/imports/${sessionA.id}/errors`)
      .set("Authorization", tenantB.authorization);

    expect(getSession.status).toBe(404);
    expect(getErrors.status).toBe(404);
  });

  it("GET /imports/:id/errors returns the validation errors array", async () => {
    const auth = createAuthContext("owner");
    const importSession = fakeDb.seedImportSession({
      companyId: auth.company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/1",
      status: "preview",
      validationErrors: [
        {
          row: 12,
          field: "email",
          message: "Invalid email format",
          value: "not-an-email"
        }
      ]
    });

    const response = await request(app.server)
      .get(`/api/v1/imports/${importSession.id}/errors`)
      .set("Authorization", auth.authorization);

    expect(response.status).toBe(200);
    expect(response.body.errors).toEqual([
      {
        row: 12,
        field: "email",
        message: "Invalid email format",
        value: "not-an-email"
      }
    ]);
  });
});
