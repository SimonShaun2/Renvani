/**
 * FS-170 — inventory API route tests.
 */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await closeTestApp(app);
});

function bearer(companyId: string, userId: string, role: string): string {
  return `Bearer ${tokens.generateAccessToken({ userId, companyId, role })}`;
}

function seedWorld() {
  const company = fakeDb.seedCompany({ name: "Inv Co", slug: "inv-co" });
  const other = fakeDb.seedCompany({ name: "Other Co", slug: "other-co" });
  const owner = fakeDb.seedUser({ companyId: company.id, email: "owner@inv.test", firstName: "O", lastName: "W", role: "owner" });
  const office = fakeDb.seedUser({ companyId: company.id, email: "office@inv.test", firstName: "O", lastName: "F", role: "office" });
  const techUser = fakeDb.seedUser({ companyId: company.id, email: "tech@inv.test", firstName: "T", lastName: "E", role: "technician" });
  const tech = fakeDb.seedTechnician({ companyId: company.id, userId: techUser.id, firstName: "T", lastName: "E", phone: "+15555550101" });
  const peerUser = fakeDb.seedUser({ companyId: company.id, email: "peer@inv.test", firstName: "P", lastName: "E", role: "technician" });
  const peer = fakeDb.seedTechnician({ companyId: company.id, userId: peerUser.id, firstName: "P", lastName: "E", phone: "+15555550102" });
  const otherOwner = fakeDb.seedUser({ companyId: other.id, email: "owner@other.test", firstName: "X", lastName: "Y", role: "owner" });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Pat", lastName: "C", leadSource: "web" });
  const product = fakeDb.seedProductCatalog({ companyId: company.id, name: "Filter 16x25", category: "part" as never });
  const otherProduct = fakeDb.seedProductCatalog({ companyId: other.id, name: "Other filter" });
  const warehouse = fakeDb.seedStockLocation({ companyId: company.id, name: "Main warehouse", kind: "warehouse" });
  const van = fakeDb.seedStockLocation({ companyId: company.id, name: "Van 1", kind: "van", technicianId: tech.id });
  const otherLoc = fakeDb.seedStockLocation({ companyId: other.id, name: "Other WH", kind: "warehouse" });
  const level = fakeDb.seedStockLevel({
    companyId: company.id, locationId: warehouse.id, productId: product.id, quantity: 10, lowStockThreshold: 3,
    updatedAt: new Date("2026-10-01T00:00:00.000Z")
  });
  const myJob = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, technicianId: tech.id, status: "in_progress", title: "Mine" });
  const peerJob = fakeDb.seedJob({ companyId: company.id, customerId: customer.id, technicianId: peer.id, status: "in_progress", title: "Peer" });
  return {
    company, other, product, otherProduct, warehouse, van, otherLoc, level, myJob, peerJob, tech,
    ownerAuth: bearer(company.id, owner.id, "owner"),
    officeAuth: bearer(company.id, office.id, "office"),
    techAuth: bearer(company.id, techUser.id, "technician"),
    otherAuth: bearer(other.id, otherOwner.id, "owner")
  };
}

const api = () => request(app.server);

describe("FS-170 inventory API", () => {
  it("401 without auth", async () => {
    expect((await api().get("/api/v1/inventory/locations")).status).toBe(401);
    expect((await api().post("/api/v1/inventory/adjustments").send({})).status).toBe(401);
  });

  it("lists locations and levels with recordVersion; technician can read", async () => {
    const w = seedWorld();
    const locs = await api().get("/api/v1/inventory/locations").set("Authorization", w.techAuth);
    expect(locs.status).toBe(200);
    expect(locs.body.locations.map((l: { name: string }) => l.name)).toEqual(["Main warehouse", "Van 1"]);
    expect(locs.body.locations[0].recordVersion).toContain(":stock_location:");
    const levels = await api().get(`/api/v1/inventory/levels?locationId=${w.warehouse.id}`).set("Authorization", w.officeAuth);
    expect(levels.status).toBe(200);
    expect(levels.body.levels).toHaveLength(1);
    expect(levels.body.levels[0]).toMatchObject({ quantity: 10, lowStockThreshold: 3, isLowStock: false });
    expect(levels.body.levels[0].recordVersion).toContain(`:stock_level:${w.level.id}:`);
  });

  it("creates and updates a location (office); technician 403; 400 on bad body", async () => {
    const w = seedWorld();
    const created = await api().post("/api/v1/inventory/locations").set("Authorization", w.officeAuth)
      .send({ name: "Van 2", kind: "van", technicianId: w.tech.id });
    expect(created.status).toBe(201);
    expect(created.body.location).toMatchObject({ name: "Van 2", kind: "van", technicianId: w.tech.id, isActive: true });
    expect((await api().post("/api/v1/inventory/locations").set("Authorization", w.techAuth)
      .send({ name: "X", kind: "warehouse" })).status).toBe(403);
    expect((await api().post("/api/v1/inventory/locations").set("Authorization", w.officeAuth)
      .send({ name: "", kind: "garage" })).status).toBe(400);
    expect((await api().post("/api/v1/inventory/locations").set("Authorization", w.officeAuth)
      .send({ name: "WH", kind: "warehouse", technicianId: w.tech.id })).status).toBe(400);
    const patched = await api().patch(`/api/v1/inventory/locations/${w.warehouse.id}`).set("Authorization", w.officeAuth)
      .send({ name: "Central", recordVersion: created.body.location.recordVersion.replace(created.body.location.id, w.warehouse.id) });
    expect(patched.status).toBe(409);
    expect(patched.body).toMatchObject({ error: "CONFLICT", reason: "stale_record_version" });
    expect(patched.body.current.id).toBe(w.warehouse.id);
    const ok = await api().patch(`/api/v1/inventory/locations/${w.warehouse.id}`).set("Authorization", w.officeAuth)
      .send({ name: "Central", recordVersion: patched.body.current.recordVersion });
    expect(ok.status).toBe(200);
    expect(ok.body.location.name).toBe("Central");
  });

  it("adjustment updates level and appends an audit movement", async () => {
    const w = seedWorld();
    const res = await api().post("/api/v1/inventory/adjustments").set("Authorization", w.officeAuth)
      .send({ locationId: w.warehouse.id, productId: w.product.id, quantityDelta: -8, reason: "cycle count" });
    expect(res.status).toBe(201);
    expect(res.body.levels[0]).toMatchObject({ quantity: 2, isLowStock: true });
    expect(res.body.movements[0]).toMatchObject({ kind: "adjustment", quantityDelta: -8, quantityAfter: 2, reason: "cycle count", allowNegative: false });
    const low = await api().get("/api/v1/inventory/low-stock").set("Authorization", w.officeAuth);
    expect(low.body.levels.map((l: { id: string }) => l.id)).toEqual([w.level.id]);
    const moves = await api().get(`/api/v1/inventory/movements?productId=${w.product.id}`).set("Authorization", w.officeAuth);
    expect(moves.status).toBe(200);
    expect(moves.body.movements).toHaveLength(1);
  });

  it("stock never goes negative without an owner/admin override", async () => {
    const w = seedWorld();
    const body = { locationId: w.warehouse.id, productId: w.product.id, quantityDelta: -11, reason: "shrink" };
    const denied = await api().post("/api/v1/inventory/adjustments").set("Authorization", w.officeAuth).send(body);
    expect(denied.status).toBe(409);
    expect(denied.body).toMatchObject({ error: "CONFLICT", reason: "insufficient_stock" });
    expect(denied.body.current.quantity).toBe(10);
    expect(fakeDb.getStockMovements()).toHaveLength(0);
    const officeOverride = await api().post("/api/v1/inventory/adjustments").set("Authorization", w.officeAuth)
      .send({ ...body, allowNegative: true });
    expect(officeOverride.status).toBe(403);
    const ownerOverride = await api().post("/api/v1/inventory/adjustments").set("Authorization", w.ownerAuth)
      .send({ ...body, allowNegative: true });
    expect(ownerOverride.status).toBe(201);
    expect(ownerOverride.body.levels[0].quantity).toBe(-1);
    expect(ownerOverride.body.movements[0].allowNegative).toBe(true);
  });

  it("409 on stale level recordVersion; 400 on zero delta", async () => {
    const w = seedWorld();
    const stale = await api().post("/api/v1/inventory/adjustments").set("Authorization", w.officeAuth).send({
      locationId: w.warehouse.id, productId: w.product.id, quantityDelta: 1, reason: "x",
      recordVersion: `rv1:stock_level:${w.level.id}:2020-01-01T00:00:00.000Z`
    });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: "CONFLICT", reason: "stale_record_version" });
    expect(stale.body.current.recordVersion).toContain(`:stock_level:${w.level.id}:`);
    const fresh = await api().post("/api/v1/inventory/adjustments").set("Authorization", w.officeAuth).send({
      locationId: w.warehouse.id, productId: w.product.id, quantityDelta: 1, reason: "x", recordVersion: stale.body.current.recordVersion
    });
    expect(fresh.status).toBe(201);
    expect((await api().post("/api/v1/inventory/adjustments").set("Authorization", w.officeAuth).send({
      locationId: w.warehouse.id, productId: w.product.id, quantityDelta: 0, reason: "x"
    })).status).toBe(400);
    const threshold = await api().patch(`/api/v1/inventory/levels/${w.level.id}`).set("Authorization", w.officeAuth)
      .send({ lowStockThreshold: 5, recordVersion: stale.body.current.recordVersion });
    expect(threshold.status).toBe(409);
  });

  it("transfer moves stock between locations with a shared transferGroupId", async () => {
    const w = seedWorld();
    const res = await api().post("/api/v1/inventory/transfers").set("Authorization", w.officeAuth)
      .send({ fromLocationId: w.warehouse.id, toLocationId: w.van.id, productId: w.product.id, quantity: 4 });
    expect(res.status).toBe(201);
    expect(res.body.levels.map((l: { quantity: number }) => l.quantity)).toEqual([6, 4]);
    expect(res.body.movements.map((m: { kind: string }) => m.kind)).toEqual(["transfer_out", "transfer_in"]);
    expect(res.body.movements[0].transferGroupId).toBe(res.body.movements[1].transferGroupId);
    const tooMuch = await api().post("/api/v1/inventory/transfers").set("Authorization", w.officeAuth)
      .send({ fromLocationId: w.warehouse.id, toLocationId: w.van.id, productId: w.product.id, quantity: 7 });
    expect(tooMuch.status).toBe(409);
    expect(tooMuch.body.reason).toBe("insufficient_stock");
    expect(fakeDb.getStockMovements()).toHaveLength(2);
    expect((await api().post("/api/v1/inventory/transfers").set("Authorization", w.officeAuth)
      .send({ fromLocationId: w.van.id, toLocationId: w.van.id, productId: w.product.id, quantity: 1 })).status).toBe(400);
    expect((await api().post("/api/v1/inventory/transfers").set("Authorization", w.techAuth)
      .send({ fromLocationId: w.warehouse.id, toLocationId: w.van.id, productId: w.product.id, quantity: 1 })).status).toBe(403);
  });

  it("job usage: technician on own job decrements stock; peer job is 404", async () => {
    const w = seedWorld();
    const ok = await api().post("/api/v1/inventory/job-usage").set("Authorization", w.techAuth)
      .send({ jobId: w.myJob.id, locationId: w.warehouse.id, productId: w.product.id, quantity: 2 });
    expect(ok.status).toBe(201);
    expect(ok.body.levels[0].quantity).toBe(8);
    expect(ok.body.movements[0]).toMatchObject({ kind: "job_usage", jobId: w.myJob.id, quantityDelta: -2 });
    expect((await api().post("/api/v1/inventory/job-usage").set("Authorization", w.techAuth)
      .send({ jobId: w.peerJob.id, locationId: w.warehouse.id, productId: w.product.id, quantity: 1 })).status).toBe(404);
    expect((await api().post("/api/v1/inventory/job-usage").set("Authorization", w.techAuth)
      .send({ jobId: w.myJob.id, locationId: w.warehouse.id, productId: w.product.id, quantity: 1, allowNegative: true })).status).toBe(400);
    expect((await api().get("/api/v1/inventory/movements").set("Authorization", w.techAuth)).status).toBe(403);
  });

  it("cross-tenant ids are 404 and lists never leak other tenants", async () => {
    const w = seedWorld();
    expect((await api().patch(`/api/v1/inventory/locations/${w.warehouse.id}`).set("Authorization", w.otherAuth)
      .send({ name: "hijack" })).status).toBe(404);
    expect((await api().patch(`/api/v1/inventory/levels/${w.level.id}`).set("Authorization", w.otherAuth)
      .send({ lowStockThreshold: 1 })).status).toBe(404);
    expect((await api().post("/api/v1/inventory/adjustments").set("Authorization", w.otherAuth)
      .send({ locationId: w.warehouse.id, productId: w.product.id, quantityDelta: 1, reason: "x" })).status).toBe(404);
    expect((await api().post("/api/v1/inventory/adjustments").set("Authorization", w.officeAuth)
      .send({ locationId: w.warehouse.id, productId: w.otherProduct.id, quantityDelta: 1, reason: "x" })).status).toBe(404);
    expect((await api().post("/api/v1/inventory/job-usage").set("Authorization", w.otherAuth)
      .send({ jobId: w.myJob.id, locationId: w.otherLoc.id, productId: w.otherProduct.id, quantity: 1 })).status).toBe(404);
    const locs = await api().get("/api/v1/inventory/locations").set("Authorization", w.otherAuth);
    expect(locs.body.locations.map((l: { id: string }) => l.id)).toEqual([w.otherLoc.id]);
    expect((await api().get("/api/v1/inventory/levels").set("Authorization", w.otherAuth)).body.levels).toHaveLength(0);
  });
  it("levels and movements carry tenant-scoped productName/productSku for dispatcher and office", async () => {
    const w = seedWorld();
    const dispatcher = fakeDb.seedUser({ companyId: w.company.id, email: "disp@inv.test", firstName: "D", lastName: "S", role: "dispatcher" });
    const dispatcherAuth = bearer(w.company.id, dispatcher.id, "dispatcher");
    const skuProduct = fakeDb.seedProductCatalog({ companyId: w.company.id, name: "Capacitor 45/5", sku: "CAP-455" } as never);
    fakeDb.seedStockLevel({ companyId: w.company.id, locationId: w.van.id, productId: skuProduct.id, quantity: 4 });
    // Missing product and a foreign tenant's product id must never resolve a label.
    const missingId = "00000000-0000-4000-8000-000000000999";
    fakeDb.seedStockLevel({ companyId: w.company.id, locationId: w.van.id, productId: missingId, quantity: 1 });
    fakeDb.seedStockLevel({ companyId: w.company.id, locationId: w.warehouse.id, productId: w.otherProduct.id, quantity: 2 });

    const adjust = await api().post("/api/v1/inventory/adjustments").set("Authorization", w.officeAuth)
      .send({ locationId: w.warehouse.id, productId: w.product.id, quantityDelta: -1, reason: "count" });
    expect(adjust.status).toBe(201);
    expect(adjust.body.levels[0]).toMatchObject({ productName: "Filter 16x25", productSku: null });
    expect(adjust.body.movements[0]).toMatchObject({ productName: "Filter 16x25", productSku: null });

    for (const auth of [dispatcherAuth, w.officeAuth]) {
      const levels = await api().get("/api/v1/inventory/levels").set("Authorization", auth);
      expect(levels.status).toBe(200);
      const byProduct = new Map(levels.body.levels.map((l: { productId: string }) => [l.productId, l]));
      expect(byProduct.get(w.product.id)).toMatchObject({ productName: "Filter 16x25", productSku: null });
      expect(byProduct.get(skuProduct.id)).toMatchObject({ productName: "Capacitor 45/5", productSku: "CAP-455" });
      expect(byProduct.get(missingId)).toMatchObject({ productName: null, productSku: null });
      expect(byProduct.get(w.otherProduct.id)).toMatchObject({ productName: null, productSku: null });
      expect(JSON.stringify(levels.body)).not.toContain("Other filter");
      // Existing fields unchanged.
      expect(Object.keys(byProduct.get(w.product.id) as object).sort()).toEqual([
        "id", "isLowStock", "locationId", "lowStockThreshold", "productId", "productName", "productSku",
        "quantity", "recordVersion", "updatedAt"
      ]);

      const moves = await api().get(`/api/v1/inventory/movements?productId=${w.product.id}`).set("Authorization", auth);
      expect(moves.status).toBe(200);
      expect(moves.body.movements[0]).toMatchObject({ productId: w.product.id, productName: "Filter 16x25", productSku: null, kind: "adjustment" });
      expect(Object.keys(moves.body.movements[0]).sort()).toEqual([
        "actorUserId", "allowNegative", "createdAt", "id", "jobId", "kind", "locationId", "productId", "productName",
        "productSku", "quantityAfter", "quantityDelta", "reason", "transferGroupId"
      ]);
    }

    const low = await api().get("/api/v1/inventory/low-stock").set("Authorization", w.techAuth);
    expect(low.status).toBe(200);
    const otherLevels = await api().get("/api/v1/inventory/levels").set("Authorization", w.otherAuth);
    expect(otherLevels.body.levels).toHaveLength(0);
  });

  describe("list pagination (#345 follow-up)", () => {
    function seedLevels(w: ReturnType<typeof seedWorld>, count: number) {
      for (let i = 0; i < count; i += 1) {
        const product = fakeDb.seedProductCatalog({ companyId: w.company.id, name: `Part ${i}` });
        fakeDb.seedStockLevel({
          companyId: w.company.id, locationId: w.van.id, productId: product.id, quantity: i, lowStockThreshold: i % 2 === 0 ? 100 : null
        });
      }
    }

    it("caps levels at the default page size and reports page metadata", async () => {
      const w = seedWorld();
      seedLevels(w, 120);
      const res = await api().get("/api/v1/inventory/levels").set("Authorization", w.officeAuth);
      expect(res.status).toBe(200);
      expect(res.body.levels).toHaveLength(100);
      expect(res.body).toMatchObject({ limit: 100, offset: 0, hasMore: true });
      const rest = await api().get("/api/v1/inventory/levels?offset=100").set("Authorization", w.officeAuth);
      expect(rest.body.levels).toHaveLength(21);
      expect(rest.body).toMatchObject({ limit: 100, offset: 100, hasMore: false });
    });

    it("rejects limit above the max, below 1, negative offset and unknown params", async () => {
      const w = seedWorld();
      for (const qs of ["limit=201", "limit=0", "offset=-1", "limit=abc", "bogus=1"]) {
        expect((await api().get(`/api/v1/inventory/levels?${qs}`).set("Authorization", w.officeAuth)).status).toBe(400);
        expect((await api().get(`/api/v1/inventory/low-stock?${qs}`).set("Authorization", w.officeAuth)).status).toBe(400);
        expect((await api().get(`/api/v1/inventory/movements?${qs}`).set("Authorization", w.officeAuth)).status).toBe(400);
      }
      const max = await api().get("/api/v1/inventory/levels?limit=200").set("Authorization", w.officeAuth);
      expect(max.status).toBe(200);
      expect(max.body.limit).toBe(200);
    });

    it("pages levels in a stable order with no overlap or gaps", async () => {
      const w = seedWorld();
      seedLevels(w, 7);
      const seen: string[] = [];
      for (let offset = 0; offset < 8; offset += 3) {
        const res = await api().get(`/api/v1/inventory/levels?limit=3&offset=${offset}`).set("Authorization", w.officeAuth);
        seen.push(...res.body.levels.map((l: { id: string }) => l.id));
      }
      const all = await api().get("/api/v1/inventory/levels?limit=200").set("Authorization", w.officeAuth);
      const allIds = all.body.levels.map((l: { id: string }) => l.id);
      expect(seen).toEqual(allIds);
      expect(new Set(seen).size).toBe(8);
      expect([...allIds].sort()).toEqual(allIds);
    });

    it("applies the low-stock filter before the cap", async () => {
      const w = seedWorld();
      seedLevels(w, 10);
      const res = await api().get("/api/v1/inventory/low-stock?limit=2").set("Authorization", w.officeAuth);
      expect(res.status).toBe(200);
      expect(res.body.levels).toHaveLength(2);
      expect(res.body.levels.every((l: { isLowStock: boolean }) => l.isLowStock)).toBe(true);
      expect(res.body.hasMore).toBe(true);
      const all = await api().get("/api/v1/inventory/low-stock?limit=200").set("Authorization", w.officeAuth);
      expect(all.body.levels).toHaveLength(5);
      expect(all.body.levels.every((l: { isLowStock: boolean }) => l.isLowStock)).toBe(true);
    });

    it("pages movements newest first with stable order", async () => {
      const w = seedWorld();
      for (let i = 0; i < 5; i += 1) {
        const adj = await api().post("/api/v1/inventory/adjustments").set("Authorization", w.officeAuth)
          .send({ locationId: w.warehouse.id, productId: w.product.id, quantityDelta: 1, reason: `r${i}` });
        expect(adj.status).toBe(201);
      }
      const p1 = await api().get("/api/v1/inventory/movements?limit=2").set("Authorization", w.officeAuth);
      const p2 = await api().get("/api/v1/inventory/movements?limit=2&offset=2").set("Authorization", w.officeAuth);
      const p3 = await api().get("/api/v1/inventory/movements?limit=2&offset=4").set("Authorization", w.officeAuth);
      expect(p1.body).toMatchObject({ limit: 2, offset: 0, hasMore: true });
      expect(p3.body).toMatchObject({ hasMore: false });
      const reasons = [...p1.body.movements, ...p2.body.movements, ...p3.body.movements].map((m: { reason: string }) => m.reason);
      expect(reasons).toEqual(["r4", "r3", "r2", "r1", "r0"]);
      expect(p1.body.movements[0]).toMatchObject({ productName: "Filter 16x25" });
      const dflt = await api().get("/api/v1/inventory/movements").set("Authorization", w.officeAuth);
      expect(dflt.body.limit).toBe(100);
    });
  });
});

