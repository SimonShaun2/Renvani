/** POST /jobs/preview — route gating (technician 403, strict body, 50-item cap, cross-tenant catalog, rate limit). */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { closeTestApp } from "../../test-support/close-test-app.js";
import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => (await import("../../test-support/fake-db.js")).createDrizzleModuleMock());
vi.mock("@fsm/db", async () => (await import("../../test-support/fake-db.js")).createDbModuleMock());
vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  webhooksQueue: { add: vi.fn() },
  redisConnection: { get: vi.fn(async () => null), set: vi.fn(async () => "OK"), del: vi.fn(async () => 1) }
}));

let buildAppModule: typeof import("../../app.js");
let fakeDb: typeof import("../../test-support/fake-db.js");
let tokens: typeof import("../../lib/tokens.js");
let rl: typeof import("../../lib/fixed-window-rate-limit.js");
let routes: typeof import("./index.js");
let app: Awaited<ReturnType<typeof buildAppModule.buildApp>>;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
  rl = await import("../../lib/fixed-window-rate-limit.js");
  routes = await import("./index.js");
});
beforeEach(async () => {
  fakeDb.resetTestState();
  rl.resetFixedWindowRateLimitStateForTests();
  app = await buildAppModule.buildApp();
  await app.ready();
});
afterEach(async () => {
  await closeTestApp(app);
});

function tenant(slug: string) {
  const company = fakeDb.seedCompany({ name: `Co ${slug}`, slug });
  const auth = (role: string) => {
    const u = fakeDb.seedUser({ companyId: company.id, email: `${role}@${slug}.test`, firstName: role, lastName: "U", role } as never);
    return `Bearer ${tokens.generateAccessToken({ userId: u.id, companyId: company.id, role: role as never })}`;
  };
  const product = fakeDb.seedProductCatalog({ companyId: company.id, name: "Tune-up", unitPrice: "150.00" } as never);
  return { company, auth, product };
}

const preview = (auth: string, body: unknown) =>
  request(app.server).post("/api/v1/jobs/preview").set("Authorization", auth).send(body as object);

describe("POST /api/v1/jobs/preview", () => {
  it("401 without credentials", async () => {
    expect((await request(app.server).post("/api/v1/jobs/preview").send({})).status).toBe(401);
  });

  it("technician gets 403", async () => {
    const a = tenant("pv-tech");
    const res = await preview(a.auth("technician"), { products: [{ productCatalogId: a.product.id }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe("FORBIDDEN");
  });

  it("staff preview with own catalog item succeeds", async () => {
    const a = tenant("pv-ok");
    const res = await preview(a.auth("admin"), { products: [{ productCatalogId: a.product.id }] });
    expect(res.status).toBe(200);
  });

  it("strict zod: unknown top-level and line-item keys are 400", async () => {
    const a = tenant("pv-strict");
    const auth = a.auth("admin");
    expect((await preview(auth, { companyId: a.company.id })).status).toBe(400);
    expect((await preview(auth, { products: [{ productCatalogId: a.product.id, companyId: "x" }] })).status).toBe(400);
  });

  it("caps products at 50 and description length", async () => {
    const a = tenant("pv-cap");
    const auth = a.auth("admin");
    const item = { name: "Part", unitPrice: 10 };
    expect((await preview(auth, { products: Array.from({ length: 51 }, () => item) })).status).toBe(400);
    expect((await preview(auth, { products: Array.from({ length: 50 }, () => item) })).status).toBe(200);
    expect((await preview(auth, { products: [{ ...item, description: "x".repeat(2001) }] })).status).toBe(400);
  });

  it("rejects another tenant's productCatalogId", async () => {
    const a = tenant("pv-a");
    const b = tenant("pv-b");
    const res = await preview(a.auth("admin"), { products: [{ productCatalogId: b.product.id }] });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain("Tune-up");
  });

  it("rate limits per user with 429 + Retry-After", async () => {
    const a = tenant("pv-rl");
    const auth = a.auth("admin");
    for (let i = 0; i < routes.JOB_PREVIEW_RATE_LIMIT; i += 1) {
      expect((await preview(auth, {})).status).toBe(200);
    }
    const res = await preview(auth, {});
    expect(res.status).toBe(429);
    expect(res.body.error).toBe("RATE_LIMITED");
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    expect((await preview(a.auth("dispatcher"), {})).status).toBe(200);
  });
});
