import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { closeTestApp } from "../../test-support/close-test-app.js";
import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const { addImportsQueueJob, addAiQueueJob, enqueueImportFileLinkJobMock, downloadFileMock } = vi.hoisted(() => ({
  addImportsQueueJob: vi.fn(),
  addAiQueueJob: vi.fn(),
  enqueueImportFileLinkJobMock: vi.fn(),
  downloadFileMock: vi.fn()
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
  agreementsQueue: { add: vi.fn() },
  aiQueue: { add: addAiQueueJob },
  enqueueImportFileLinkJob: enqueueImportFileLinkJobMock,
  importsQueue: { add: addImportsQueueJob },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() }
}));

vi.mock("@fsm/config/storage", () => ({
  downloadFile: downloadFileMock,
  getFileKeyFromUrl: (fileUrl: string) => fileUrl.replace("https://r2.test/", "")
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

const SAMPLE_CSV = `firstName,lastName,email,phone
Jane,Doe,jane@example.com,5551234567
`;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  addImportsQueueJob.mockReset();
  addAiQueueJob.mockReset();
  enqueueImportFileLinkJobMock.mockReset();
  downloadFileMock.mockReset();
  downloadFileMock.mockResolvedValue(Buffer.from(SAMPLE_CSV, "utf8"));
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await closeTestApp(app);
});

function createAuthContext(role: "owner" | "admin" = "owner") {
  const company = fakeDb.seedCompany({
    name: "Migrate Co",
    slug: `migrate-${String(Math.random()).slice(2, 8)}`,
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}@migrate.test`,
    firstName: "Owner",
    lastName: "User",
    role
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return { company, user, authorization: `Bearer ${accessToken}` };
}

describe("migrate onboarding wizard API", () => {
  it("runs steps 1-5 with resumable session and dedupe operator actions", async () => {
    const { company, authorization } = createAuthContext("owner");

    fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      phone: "5551234567"
    });

    const createResponse = await request(app.server)
      .post("/api/v1/migrate/onboarding/sessions")
      .set("Authorization", authorization)
      .send({ resumeActive: false })
      .expect(201);

    const bundleId = createResponse.body.id as string;
    expect(createResponse.body.wizardStep).toBe(1);

    await request(app.server)
      .patch(`/api/v1/migrate/onboarding/sessions/${bundleId}/source`)
      .set("Authorization", authorization)
      .send({ sourceSystem: "jobber" })
      .expect(200)
      .expect((response) => {
        expect(response.body.wizardStep).toBe(2);
        expect(response.body.stepState.sourceSystem).toBe("jobber");
      });

    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/imports/customers.csv",
      status: "preview",
      entityType: "customers",
      columnMappings: {
        firstName: "firstName",
        lastName: "lastName",
        email: "email",
        phone: "phone"
      }
    });

    await request(app.server)
      .patch(`/api/v1/migrate/onboarding/sessions/${bundleId}/files`)
      .set("Authorization", authorization)
      .send({
        files: [
          {
            importSessionId: importSession.id,
            entityType: "customers",
            fileName: "customers.csv"
          }
        ]
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.wizardStep).toBe(3);
      });

    await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundleId}/confirm-mappings`)
      .set("Authorization", authorization)
      .send({})
      .expect(200)
      .expect((response) => {
        expect(response.body.wizardStep).toBe(4);
      });

    const dedupePreview = await request(app.server)
      .get(`/api/v1/migrate/onboarding/sessions/${bundleId}/dedupe-preview`)
      .set("Authorization", authorization)
      .expect(200);

    expect(dedupePreview.body.totalDuplicateRows).toBe(1);

    const relationalPreview = await request(app.server)
      .get(`/api/v1/migrate/onboarding/sessions/${bundleId}/relational-preview`)
      .set("Authorization", authorization)
      .expect(200);

    expect(relationalPreview.body.bundleId).toBe(bundleId);
    expect(relationalPreview.body.graph.stats.customerCount).toBeGreaterThanOrEqual(0);
    const collisionKey = dedupePreview.body.collisions[0].collisionKey as string;

    await request(app.server)
      .patch(`/api/v1/migrate/onboarding/sessions/${bundleId}/dedupe-decisions`)
      .set("Authorization", authorization)
      .send({
        decisions: [{ collisionKey, action: "update_existing" }]
      })
      .expect(200);

    await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundleId}/acknowledge-preview`)
      .set("Authorization", authorization)
      .send({})
      .expect(200)
      .expect((response) => {
        expect(response.body.wizardStep).toBe(5);
      });

    const commitResponse = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundleId}/commit`)
      .set("Authorization", authorization)
      .send({})
      .expect(200);

    expect(commitResponse.body.status).toBe("committing");
    expect(addImportsQueueJob).toHaveBeenCalled();
    expect(fakeDb.getTestState().activityEvents.some((event) => event.eventType === "import.bundle.commit_started")).toBe(
      true
    );
  });

  it("returns customer-property-job relational preview on step 4", async () => {
    const { company, authorization } = createAuthContext("owner");

    const createResponse = await request(app.server)
      .post("/api/v1/migrate/onboarding/sessions")
      .set("Authorization", authorization)
      .send({ resumeActive: false })
      .expect(201);

    const bundleId = createResponse.body.id as string;

    await request(app.server)
      .patch(`/api/v1/migrate/onboarding/sessions/${bundleId}/source`)
      .set("Authorization", authorization)
      .send({ sourceSystem: "service_fusion" })
      .expect(200);

    const customerSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/imports/customers.csv",
      status: "preview",
      entityType: "customers",
      columnMappings: { sourceId: "sourceId", displayName: "displayName" }
    });
    const propertySession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "locations.csv",
      fileUrl: "https://r2.test/imports/locations.csv",
      status: "preview",
      entityType: "properties",
      columnMappings: {
        sourceId: "sourceId",
        customerSourceId: "customerSourceId",
        label: "label"
      }
    });
    const jobSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "jobs.csv",
      fileUrl: "https://r2.test/imports/jobs.csv",
      status: "preview",
      entityType: "jobs",
      columnMappings: {
        sourceId: "sourceId",
        propertySourceId: "propertySourceId",
        label: "label"
      }
    });

    downloadFileMock.mockImplementation(async (key: string) => {
      if (key.includes("customers")) {
        return Buffer.from("sourceId,displayName\nC-1,Acme\n", "utf8");
      }
      if (key.includes("locations")) {
        return Buffer.from("sourceId,customerSourceId,label\nP-1,C-1,Main St\n", "utf8");
      }
      return Buffer.from("sourceId,propertySourceId,label\nJ-1,P-1,Tune-up\n", "utf8");
    });

    await request(app.server)
      .patch(`/api/v1/migrate/onboarding/sessions/${bundleId}/files`)
      .set("Authorization", authorization)
      .send({
        files: [
          {
            importSessionId: customerSession.id,
            entityType: "customers",
            fileName: "customers.csv"
          },
          {
            importSessionId: propertySession.id,
            entityType: "properties",
            fileName: "locations.csv"
          },
          {
            importSessionId: jobSession.id,
            entityType: "jobs",
            fileName: "jobs.csv"
          }
        ]
      })
      .expect(200);

    await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundleId}/confirm-mappings`)
      .set("Authorization", authorization)
      .send({})
      .expect(200);

    const relationalPreview = await request(app.server)
      .get(`/api/v1/migrate/onboarding/sessions/${bundleId}/relational-preview`)
      .set("Authorization", authorization)
      .expect(200);

    expect(relationalPreview.body.graph.edges).toHaveLength(1);
    expect(relationalPreview.body.graph.propertyJobEdges).toHaveLength(1);
    expect(relationalPreview.body.graph.stats).toEqual({
      customerCount: 1,
      propertyCount: 1,
      jobCount: 1,
      estimateCount: 0,
      linkedPropertyCount: 1,
      linkedJobCount: 1,
      linkedEstimateCount: 0
    });
    expect(relationalPreview.body.graph.historyDepth).toHaveLength(2);
  });

  it("returns relational preview on wizard step 3 before mappings are confirmed", async () => {
    const { company, authorization } = createAuthContext("owner");

    const createResponse = await request(app.server)
      .post("/api/v1/migrate/onboarding/sessions")
      .set("Authorization", authorization)
      .send({ resumeActive: false })
      .expect(201);

    const bundleId = createResponse.body.id as string;

    await request(app.server)
      .patch(`/api/v1/migrate/onboarding/sessions/${bundleId}/source`)
      .set("Authorization", authorization)
      .send({ sourceSystem: "service_fusion" })
      .expect(200);

    const customerSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/imports/customers.csv",
      status: "mapping",
      entityType: "customers",
      columnMappings: { sourceId: "sourceId", displayName: "displayName" }
    });

    downloadFileMock.mockResolvedValue(Buffer.from("sourceId,displayName\nC-1,Acme\n", "utf8"));

    await request(app.server)
      .patch(`/api/v1/migrate/onboarding/sessions/${bundleId}/files`)
      .set("Authorization", authorization)
      .send({
        files: [
          {
            importSessionId: customerSession.id,
            entityType: "customers",
            fileName: "customers.csv"
          }
        ]
      })
      .expect(200)
      .expect((response) => {
        expect(response.body.wizardStep).toBe(3);
      });

    const relationalPreview = await request(app.server)
      .get(`/api/v1/migrate/onboarding/sessions/${bundleId}/relational-preview`)
      .set("Authorization", authorization)
      .expect(200);

    expect(relationalPreview.body.graph.stats.customerCount).toBe(1);
  });

  it("resumes the active bundle when resumeActive is true", async () => {
    const { company, user, authorization } = createAuthContext("owner");

    const bundle = fakeDb.seedImportBundle({
      companyId: company.id,
      createdById: user.id,
      wizardStep: 2,
      stepState: { files: [], sourceSystem: "qbo" }
    });

    const response = await request(app.server)
      .post("/api/v1/migrate/onboarding/sessions")
      .set("Authorization", authorization)
      .send({ resumeActive: true })
      .expect(201);

    expect(response.body.id).toBe(bundle.id);
    expect(response.body.wizardStep).toBe(2);
  });

  it("exposes QuickBooks OAuth founder gate on source catalog", async () => {
    const { authorization } = createAuthContext("owner");

    const response = await request(app.server)
      .get("/api/v1/migrate/onboarding/sources")
      .set("Authorization", authorization)
      .expect(200);

    const qbo = response.body.sources.find((entry: { id: string }) => entry.id === "qbo");
    expect(qbo?.oauth?.enabled).toBe(false);
    expect(qbo?.oauth?.founderGate).toBe(true);
  });

  it("requires file-link confirmation before acknowledging preview when bundle media exists", async () => {
    const { company, authorization } = createAuthContext("owner");
    const importBundleId = "f1111111-1111-4111-8111-111111111111";

    const bundle = fakeDb.seedImportBundle({
      id: importBundleId,
      companyId: company.id,
      wizardStep: 4,
      stepState: {
        sourceSystem: "qbo",
        files: [],
        mappingsConfirmedAt: new Date().toISOString()
      }
    });

    downloadFileMock.mockResolvedValue(Buffer.from(SAMPLE_CSV, "utf8"));

    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      importBundleId: bundle.id,
      fileName: "customers.csv",
      fileUrl: "https://r2.test/imports/customers.csv",
      status: "preview",
      entityType: "customers",
      columnMappings: {
        firstName: "firstName",
        lastName: "lastName",
        email: "email",
        phone: "phone"
      },
      aiInferences: {
        migrateFileBatchManifest: {
          importBundleId: bundle.id,
          sourceSystem: "qbo",
          batches: [
            {
              batchIndex: 0,
              batchesTotal: 1,
              objects: [{ vendorFileId: "photo-1", relativePath: "Customers/Jane_Doe/photo.jpg" }]
            }
          ]
        }
      }
    });

    const bundleRow = fakeDb.getTestState().importBundles.find((row) => row.id === bundle.id);
    if (!bundleRow) {
      throw new Error("expected seeded import bundle");
    }
    bundleRow.stepState = {
      sourceSystem: "qbo",
      mappingsConfirmedAt: new Date().toISOString(),
      files: [
        {
          importSessionId: importSession.id,
          entityType: "customers",
          fileName: "customers.csv"
        }
      ]
    };

    await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/acknowledge-preview`)
      .set("Authorization", authorization)
      .send({})
      .expect(409);

    await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/file-link/run`)
      .set("Authorization", authorization)
      .send({})
      .expect(202);

    expect(enqueueImportFileLinkJobMock).toHaveBeenCalled();
  });

  it("rejects cross-tenant bundle access", async () => {
    const companyA = fakeDb.seedCompany({ name: "Tenant A", slug: "tenant-a" });
    const companyB = fakeDb.seedCompany({ name: "Tenant B", slug: "tenant-b" });
    const userB = fakeDb.seedUser({
      companyId: companyB.id,
      email: "owner@b.test",
      firstName: "B",
      lastName: "Owner",
      role: "owner"
    });

    const bundleA = fakeDb.seedImportBundle({ companyId: companyA.id, wizardStep: 1, stepState: { files: [] } });

    const accessTokenB = tokens.generateAccessToken({
      userId: userB.id,
      companyId: companyB.id,
      role: userB.role
    });

    const response = await request(app.server)
      .get(`/api/v1/migrate/onboarding/sessions/${bundleA.id}`)
      .set({ Authorization: `Bearer ${accessTokenB}` })
      .expect(404);

    expect(response.body.error).toBe(ErrorCode.NOT_FOUND);
  });
});
