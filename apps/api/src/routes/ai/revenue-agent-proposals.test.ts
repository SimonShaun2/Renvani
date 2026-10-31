import { randomUUID } from "node:crypto";

import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const {
  redisDelMock,
  redisGetMock,
  redisSetMock,
  resetRedisStore
} = vi.hoisted(() => {
  const store = new Map<string, string>();

  return {
    redisDelMock: vi.fn(async (key: string) => {
      const deleted = store.delete(key);
      return deleted ? 1 : 0;
    }),
    redisGetMock: vi.fn(async (key: string) => store.get(key) ?? null),
    redisSetMock: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return "OK";
    }),
    resetRedisStore: () => {
      store.clear();
    }
  };
});

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: {
    add: vi.fn()
  },
  agreementsQueue: {
    add: vi.fn()
  },
  importsQueue: {
    add: vi.fn()
  },
  invoicesQueue: {
    add: vi.fn()
  },
  notificationsQueue: {
    add: vi.fn()
  },
  redisConnection: {
    get: redisGetMock,
    set: redisSetMock,
    del: redisDelMock
  },
  webhooksQueue: {
    add: vi.fn()
  }
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let app: AppInstance;
let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  resetRedisStore();
  redisDelMock.mockClear();
  redisGetMock.mockClear();
  redisSetMock.mockClear();
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

function createAuthContext(role: "owner" | "admin" | "dispatcher" | "technician" = "owner", slug = `acme-${role}`) {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug,
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}-${slug}@example.com`,
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


function seedRec(companyId: string, overrides: Record<string, unknown> = {}) {
  const customer = fakeDb.seedCustomer({ companyId, firstName: "Chris", lastName: "Pine", phone: "555-0100" });
  const rec = fakeDb.seedAiRecommendation({
    companyId,
    type: "unpaid_invoice",
    customerId: customer.id,
    estimatedRevenue: "225.00",
    urgencyScore: 70,
    headline: "Overdue invoice",
    body: "Invoice is overdue",
    suggestedMessage: "Hi Chris, friendly reminder about your invoice.",
    ...overrides
  });
  return { customer, rec };
}

const propose = (auth: string, id: string) =>
  request(app.server).post(`/api/v1/ai/recommendations/${id}/propose`).set("Authorization", auth).send();

describe("revenue agent proposals", () => {
  it("proposes from a recommendation idempotently (rec:<id>) with an allowlisted response", async () => {
    const owner = createAuthContext("owner");
    const { rec } = seedRec(owner.company.id);

    const first = await propose(owner.authorization, rec.id);
    const second = await propose(owner.authorization, rec.id);

    expect(first.status).toBe(200);
    expect(first.body.created).toBe(true);
    expect(first.body.proposal).toMatchObject({
      actionType: "revenue.invoice_reminder.propose",
      state: "awaiting_approval",
      requiresApproval: true,
      recommendationId: rec.id,
      proposedContent: { channel: "sms", subject: null, body: "Hi Chris, friendly reminder about your invoice." }
    });
    expect(second.status).toBe(200);
    expect(second.body.created).toBe(false);
    expect(second.body.proposal.id).toBe(first.body.proposal.id);
    const raw = JSON.stringify(first.body);
    for (const leaked of ["companyId", owner.company.id, "idempotencyKey", "payloadHash", "phone", "555-0100"]) {
      expect(raw).not.toContain(leaked);
    }
  });

  it("allows dispatchers, denies technicians, and isolates tenants", async () => {
    const dispatcher = createAuthContext("dispatcher");
    const technician = createAuthContext("technician", "acme-dispatcher");
    const other = createAuthContext("owner", "other-co");
    const { rec } = seedRec(dispatcher.company.id);

    expect((await propose(technician.authorization, rec.id)).status).toBe(403);
    expect((await propose(other.authorization, rec.id)).status).toBe(404);
    const generatedOther = await request(app.server)
      .post("/api/v1/ai/revenue-agent/proposals/generate")
      .set("Authorization", other.authorization)
      .send({});
    expect(generatedOther.body).toEqual({ created: 0, existing: 0, skipped: 0, proposals: [] });
    expect((await propose(dispatcher.authorization, rec.id)).status).toBe(200);
  });

  it("generate creates proposals for supported pending kinds, skips others, and is idempotent", async () => {
    const owner = createAuthContext("owner");
    seedRec(owner.company.id, { urgencyScore: 10 });
    seedRec(owner.company.id, { type: "reactivation", urgencyScore: 90 });
    seedRec(owner.company.id, { type: "aging_asset" });
    seedRec(owner.company.id, { status: "dismissed" });

    const gen = () =>
      request(app.server)
        .post("/api/v1/ai/revenue-agent/proposals/generate")
        .set("Authorization", owner.authorization)
        .send({ limit: 5 });
    const first = await gen();
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({ created: 2, existing: 0, skipped: 1 });
    expect(first.body.proposals[0].actionType).toBe("revenue.reactivation.propose");
    const second = await gen();
    expect(second.body).toMatchObject({ created: 0, existing: 2 });

    const bad = await request(app.server)
      .post("/api/v1/ai/revenue-agent/proposals/generate")
      .set("Authorization", owner.authorization)
      .send({ limit: 500, extra: true });
    expect(bad.status).toBe(400);
  });

  it("approve → execute marks the recommendation actioned and records the approved draft", async () => {
    const owner = createAuthContext("owner");
    const { rec } = seedRec(owner.company.id);
    const { proposal } = (await propose(owner.authorization, rec.id)).body;

    const approved = await request(app.server)
      .post(`/api/v1/agent-actions/${proposal.id}/approve`)
      .set("Authorization", owner.authorization)
      .send({ expectedVersion: fakeDb.getTestState().agentActions.find((row) => row.id === proposal.id)!.updatedAt.getTime() });
    expect(approved.status).toBe(200);
    const executed = await request(app.server)
      .post(`/api/v1/agent-actions/${proposal.id}/execute`)
      .set("Authorization", owner.authorization)
      .send({ expectedVersion: approved.body.version });
    expect(executed.status).toBe(200);
    const stored = fakeDb.getTestState().aiRecommendations.find((row) => row.id === rec.id);
    expect(stored?.status).toBe("actioned");
    expect(stored?.actionedById).toBe(owner.user.id);
    const action = fakeDb.getTestState().agentActions.find((row) => row.id === proposal.id);
    expect(action?.state).toBe("succeeded");
    expect(JSON.stringify(action?.executionReceipt)).toContain("friendly reminder");
    expect(redisDelMock).toHaveBeenCalled();
    expect((await propose(owner.authorization, rec.id)).body.created).toBe(false);
  });

  it("reject dismisses the recommendation", async () => {
    const owner = createAuthContext("owner");
    const { rec } = seedRec(owner.company.id);
    const { proposal } = (await propose(owner.authorization, rec.id)).body;

    const rejected = await request(app.server)
      .post(`/api/v1/agent-actions/${proposal.id}/reject`)
      .set("Authorization", owner.authorization)
      .send({});
    expect(rejected.status).toBe(200);
    expect(fakeDb.getTestState().aiRecommendations.find((row) => row.id === rec.id)?.status).toBe("dismissed");
  });

  it("execute is denied by policy when the customer opted out", async () => {
    const owner = createAuthContext("owner");
    const { rec, customer } = seedRec(owner.company.id);
    const { proposal } = (await propose(owner.authorization, rec.id)).body;
    customer.doNotContact = true;

    const approved = await request(app.server)
      .post(`/api/v1/agent-actions/${proposal.id}/approve`)
      .set("Authorization", owner.authorization)
      .send({ expectedVersion: fakeDb.getTestState().agentActions.find((row) => row.id === proposal.id)!.updatedAt.getTime() });
    const executed = await request(app.server)
      .post(`/api/v1/agent-actions/${proposal.id}/execute`)
      .set("Authorization", owner.authorization)
      .send({ expectedVersion: approved.body.version });
    expect(approved.status).toBe(200);
    expect(executed.status).toBeGreaterThanOrEqual(400);
    expect(fakeDb.getTestState().aiRecommendations.find((row) => row.id === rec.id)?.status).toBe("pending");
  });

  it("rejects unsupported recommendation types and non-pending recommendations", async () => {
    const owner = createAuthContext("owner");
    const { rec: unsupported } = seedRec(owner.company.id, { type: "aging_asset" });
    const { rec: done } = seedRec(owner.company.id, { status: "actioned" });
    expect((await propose(owner.authorization, unsupported.id)).status).toBe(400);
    expect((await propose(owner.authorization, done.id)).status).toBe(409);
  });
});
