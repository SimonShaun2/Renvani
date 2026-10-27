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
});
