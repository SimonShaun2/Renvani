/**
 * FS-212 estimate good-better-best option sets + disabled financing.
 */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const { addNotificationQueueJob } = vi.hoisted(() => ({ addNotificationQueueJob: vi.fn() }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});
vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});
vi.mock("@fsm/jobs", () => ({ aiQueue: { add: vi.fn() }, notificationsQueue: { add: addNotificationQueueJob } }));

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
  addNotificationQueueJob.mockReset();
  app = await buildAppModule.buildApp();
  await app.ready();
});
afterEach(async () => {
  await app.close();
  vi.unstubAllGlobals();
});

const base = "/api/v1/estimates/option-sets";
const api = () => request(app.server);
const bearer = (companyId: string, userId: string, role: string) => `Bearer ${tokens.generateAccessToken({ userId, companyId, role })}`;

function world() {
  const company = fakeDb.seedCompany({ name: "Northside Heating & Air", slug: "northside-hvac" });
  const other = fakeDb.seedCompany({ name: "Other Electric", slug: "other-electric" });
  const users = Object.fromEntries(
    (["owner", "admin", "dispatcher", "technician"] as const).map((role) => [
      role,
      fakeDb.seedUser({ companyId: company.id, email: `${role}@northside.test`, firstName: role, lastName: "N", role })
    ])
  ) as unknown as Record<"owner" | "admin" | "dispatcher" | "technician", { id: string }>;
  const otherOwner = fakeDb.seedUser({ companyId: other.id, email: "owner@other.test", firstName: "X", lastName: "Y", role: "owner" });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Chris", lastName: "Pine", email: "chris@example.test", phone: "555-0100" });
  const otherCustomer = fakeDb.seedCustomer({ companyId: other.id, firstName: "Sam", lastName: "Lee", email: "sam@example.test", phone: "555-0101" });
  return {
    company, other, customer, otherCustomer, users,
    owner: bearer(company.id, users.owner.id, "owner"),
    admin: bearer(company.id, users.admin.id, "admin"),
    dispatcher: bearer(company.id, users.dispatcher.id, "dispatcher"),
    technician: bearer(company.id, users.technician.id, "technician"),
    otherOwner: bearer(other.id, otherOwner.id, "owner")
  };
}

const option = (tierLabel: string, unitPrice: number, extra: Record<string, unknown> = {}) => ({
  tierLabel,
  title: `${tierLabel} furnace replacement`,
  items: [
    { name: "Furnace unit", quantity: 1, unitPrice },
    { name: "Install labor", itemType: "labor", quantity: 4, unitPrice: 95.5, isTaxable: false }
  ],
  taxRate: 0.0825,
  ...extra
});

function createBody(customerId: string, extra: Record<string, unknown> = {}) {
  return {
    idempotencyKey: "fs212-create-0001",
    customerId,
    title: "Furnace replacement options",
    messageToCustomer: "Three ways to replace your furnace.",
    financingOffered: true,
    options: [option("Best", 5200), option("Good", 2400), option("Better", 3600, { recommended: true })],
    ...extra
  };
}

const create = (auth: string, body: Record<string, unknown>) => api().post(base).set("Authorization", auth).send(body);

describe("FS-212 estimate option sets", () => {
  it("creates a 2-3 option set ordered good/better/best with per-option money math and one recommended", async () => {
    const w = world();
    const res = await create(w.owner, createBody(w.customer.id));
    expect(res.status).toBe(201);
    const set = res.body.optionSet;
    expect(res.body.replayed).toBe(false);
    expect(set.options.map((o: { tierLabel: string }) => o.tierLabel)).toEqual(["Good", "Better", "Best"]);
    expect(set.options.map((o: { rank: number }) => o.rank)).toEqual([1, 2, 3]);
    expect(set.options.filter((o: { recommended: boolean }) => o.recommended)).toHaveLength(1);
    expect(set.recommendedEstimateId).toBe(set.options[1].estimateId);
    expect(set).toMatchObject({ status: "draft", version: 1, customerId: w.customer.id, financingOffered: true });
    // Good: 2400 taxable * 8.25% = 198.00 tax; labor 382.00 untaxed → 2400 + 382 + 198 = 2980.00
    expect(set.options[0]).toMatchObject({ subtotal: "2782.00", taxAmount: "198.00", total: "2980.00" });
    // Better: 3600 * 0.0825 = 297.00 → 3600 + 382 + 297 = 4279.00
    expect(set.options[1]).toMatchObject({ subtotal: "3982.00", taxAmount: "297.00", total: "4279.00" });
    expect(set.options[2]).toMatchObject({ subtotal: "5582.00", taxAmount: "429.00", total: "6011.00" });
    // No fee logic on the financing path; financing is disabled.
    expect(set.financing).toEqual({ offered: false, provider: "disabled", providerReady: false, monthlyFrom: null, reason: "financing_disabled" });
    const rows = fakeDb.getTestState().estimates.filter((e) => e.tierGroupId === set.tierGroupId);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.optionSetVersion === 1 && r.companyId === w.company.id)).toBe(true);
  });

  it("enforces bounds (2-3), unique labels and at most one recommended", async () => {
    const w = world();
    expect((await create(w.owner, createBody(w.customer.id, { options: [option("Good", 1)] }))).status).toBe(400);
    expect((await create(w.owner, createBody(w.customer.id, { options: [option("Good", 1), option("Better", 2), option("Best", 3), option("Premium", 4)] }))).status).toBe(400);
    expect((await create(w.owner, createBody(w.customer.id, { options: [option("Good", 1), option(" good ", 2)] }))).status).toBe(400);
    expect((await create(w.owner, createBody(w.customer.id, { options: [option("Good", 1, { recommended: true }), option("Best", 2, { recommended: true })] }))).status).toBe(400);
    expect((await create(w.owner, createBody(w.customer.id, { options: [option("Good", 1), option("Best", 2)] }))).status).toBe(201);
    expect(fakeDb.getTestState().estimates).toHaveLength(2);
  });

  it("gates roles: 401 unauthenticated, 403 technician, owner/admin/dispatcher allowed", async () => {
    const w = world();
    expect((await api().post(base).send(createBody(w.customer.id))).status).toBe(401);
    expect((await create(w.technician, createBody(w.customer.id))).status).toBe(403);
    const created = await create(w.dispatcher, createBody(w.customer.id));
    expect(created.status).toBe(201);
    const id = created.body.optionSet.tierGroupId as string;
    expect((await api().get(`${base}/${id}`).set("Authorization", w.admin)).status).toBe(200);
    for (const [method, path] of [
      ["get", `${base}/${id}`],
      ["patch", `${base}/${id}`],
      ["post", `${base}/${id}/options`],
      ["delete", `${base}/${id}/options/${created.body.optionSet.options[0].estimateId}?expectedVersion=1&idempotencyKey=fs212-del-0001`],
      ["post", `${base}/${id}/send`],
      ["get", `${base}/${id}/financing-quotes`],
      ["post", `${base}/${id}/financing-applications`]
    ] as const) {
      expect((await api()[method](path).send({})).status).toBe(401);
      expect((await api()[method](path).set("Authorization", w.technician).send({})).status).toBe(403);
    }
  });

  it("is tenant-isolated: foreign customer and foreign set ids are 404 and nothing is written", async () => {
    const w = world();
    expect((await create(w.owner, createBody(w.otherCustomer.id))).status).toBe(404);
    const created = await create(w.owner, createBody(w.customer.id));
    const id = created.body.optionSet.tierGroupId as string;
    const before = JSON.stringify(fakeDb.getTestState().estimates);
    expect((await api().get(`${base}/${id}`).set("Authorization", w.otherOwner)).status).toBe(404);
    expect((await api().patch(`${base}/${id}`).set("Authorization", w.otherOwner).send({ idempotencyKey: "fs212-x-0001", expectedVersion: 1, title: "Taken" })).status).toBe(404);
    expect((await api().post(`${base}/${id}/send`).set("Authorization", w.otherOwner).send({ idempotencyKey: "fs212-x-0002", expectedVersion: 1 })).status).toBe(404);
    expect((await api().get(`${base}/${id}/financing-quotes`).set("Authorization", w.otherOwner)).status).toBe(404);
    expect((await api().post(`${base}/${id}/financing-applications`).set("Authorization", w.otherOwner).send({})).status).toBe(404);
    expect(JSON.stringify(fakeDb.getTestState().estimates)).toBe(before);
    // Same create key in another tenant yields a different set (keys are tenant-scoped).
    const otherCustomerSet = await create(w.otherOwner, createBody(w.otherCustomer.id));
    expect(otherCustomerSet.status).toBe(201);
    expect(otherCustomerSet.body.optionSet.tierGroupId).not.toBe(id);
  });

  it("replays create/patch with the same key, 409 on key reuse with a different payload and on stale version", async () => {
    const w = world();
    const first = await create(w.owner, createBody(w.customer.id));
    const replay = await create(w.owner, createBody(w.customer.id));
    expect(replay.status).toBe(200);
    expect(replay.body.replayed).toBe(true);
    expect(replay.body.optionSet.tierGroupId).toBe(first.body.optionSet.tierGroupId);
    expect(fakeDb.getTestState().estimates).toHaveLength(3);
    const reuse = await create(w.owner, createBody(w.customer.id, { title: "Different" }));
    expect(reuse.status).toBe(409);
    expect(reuse.body.fields).toMatchObject({ reason: "idempotency_conflict" });

    const id = first.body.optionSet.tierGroupId as string;
    const good = first.body.optionSet.options[0].estimateId as string;
    const patchBody = { idempotencyKey: "fs212-patch-0001", expectedVersion: 1, recommendedEstimateId: good, title: "Updated options" };
    const patched = await api().patch(`${base}/${id}`).set("Authorization", w.owner).send(patchBody);
    expect(patched.status).toBe(200);
    expect(patched.body.optionSet).toMatchObject({ version: 2, recommendedEstimateId: good, title: "Updated options" });
    expect(patched.body.optionSet.options.filter((o: { recommended: boolean }) => o.recommended)).toHaveLength(1);
    const patchReplay = await api().patch(`${base}/${id}`).set("Authorization", w.owner).send(patchBody);
    expect(patchReplay.body).toMatchObject({ replayed: true, optionSet: { version: 2 } });
    const stale = await api().patch(`${base}/${id}`).set("Authorization", w.owner).send({ idempotencyKey: "fs212-patch-0002", expectedVersion: 1, title: "Old" });
    expect(stale.status).toBe(409);
    expect(stale.body.fields).toMatchObject({ reason: "stale_version", currentVersion: "2" });
    const dup = await api().patch(`${base}/${id}`).set("Authorization", w.owner).send({
      idempotencyKey: "fs212-patch-0003", expectedVersion: 2, options: [{ estimateId: good, tierLabel: "best" }]
    });
    expect(dup.status).toBe(400);
  });

  it("adds up to 3 options and removes down to 2", async () => {
    const w = world();
    const created = await create(w.owner, createBody(w.customer.id, { options: [option("Good", 100), option("Best", 300)] }));
    const id = created.body.optionSet.tierGroupId as string;
    const added = await api().post(`${base}/${id}/options`).set("Authorization", w.owner).send({
      idempotencyKey: "fs212-add-0001", expectedVersion: 1, option: option("Better", 200, { recommended: true })
    });
    expect(added.status).toBe(201);
    expect(added.body.optionSet.options.map((o: { tierLabel: string }) => o.tierLabel)).toEqual(["Good", "Better", "Best"]);
    const limit = await api().post(`${base}/${id}/options`).set("Authorization", w.owner).send({
      idempotencyKey: "fs212-add-0002", expectedVersion: 2, option: option("Premium", 400)
    });
    expect(limit.status).toBe(409);
    expect(limit.body.fields).toMatchObject({ reason: "option_limit" });
    const better = added.body.optionSet.options[1].estimateId as string;
    const removed = await api().delete(`${base}/${id}/options/${better}?expectedVersion=2&idempotencyKey=fs212-del-0001`).set("Authorization", w.owner);
    expect(removed.status).toBe(200);
    expect(removed.body.optionSet).toMatchObject({ version: 3, recommendedEstimateId: null });
    expect(removed.body.optionSet.options).toHaveLength(2);
    const good = removed.body.optionSet.options[0].estimateId as string;
    const minimum = await api().delete(`${base}/${id}/options/${good}?expectedVersion=3&idempotencyKey=fs212-del-0002`).set("Authorization", w.owner);
    expect(minimum.status).toBe(409);
    expect(minimum.body.fields).toMatchObject({ reason: "option_minimum" });
  });

  it("sends once, then the public view orders tiers with recommended, hides financing, and approve selects exactly one tier", async () => {
    const w = world();
    const created = await create(w.owner, createBody(w.customer.id));
    const id = created.body.optionSet.tierGroupId as string;
    const sendBody = { idempotencyKey: "fs212-send-0001", expectedVersion: 1 };
    const sent = await api().post(`${base}/${id}/send`).set("Authorization", w.owner).send(sendBody);
    expect(sent.status).toBe(200);
    expect(sent.body.optionSet).toMatchObject({ status: "sent", version: 2 });
    expect(JSON.stringify(sent.body)).not.toContain("approvalToken");
    expect(addNotificationQueueJob).toHaveBeenCalledTimes(1);
    expect((await api().post(`${base}/${id}/send`).set("Authorization", w.owner).send(sendBody)).body.replayed).toBe(true);
    expect(addNotificationQueueJob).toHaveBeenCalledTimes(1);
    expect((await api().patch(`${base}/${id}`).set("Authorization", w.owner).send({ idempotencyKey: "fs212-patch-0009", expectedVersion: 2, title: "x" })).body.fields).toMatchObject({ reason: "not_draft" });

    const rows = fakeDb.getTestState().estimates.filter((e) => e.tierGroupId === id);
    const recommendedRow = rows.find((r) => r.isRecommended)!;
    expect(addNotificationQueueJob.mock.calls[0]![1]).toMatchObject({ estimateId: recommendedRow.id });
    const view = await api().get(`/api/v1/public/estimates/${rows[0]!.approvalToken}`);
    expect(view.status).toBe(200);
    expect(view.body.estimate.tiers.map((t: { tierLabel: string }) => t.tierLabel)).toEqual(["Good", "Better", "Best"]);
    expect(view.body.estimate.tiers.map((t: { recommended: boolean }) => t.recommended)).toEqual([false, true, false]);
    expect(view.body.estimate.financingOffered).toBe(false);
    expect(view.body.estimate).not.toHaveProperty("financing");

    const best = rows.find((r) => r.tierLabel === "Best")!;
    const approved = await api().post(`/api/v1/public/estimates/${rows[0]!.approvalToken}/approve`).send({ approvedByName: "Chris Pine", selectedEstimateNumber: best.estimateNumber });
    expect(approved.status).toBe(200);
    const after = await api().get(`${base}/${id}`).set("Authorization", w.owner);
    expect(after.body.optionSet.selectedEstimateId).toBe(best.id);
    expect(after.body.optionSet.options.filter((o: { isSelectedTier: boolean }) => o.isSelectedTier)).toHaveLength(1);
    expect(after.body.optionSet.status).toBe("approved");
  });

  it("keeps financing disabled: quotes [] with financing_disabled, applications 403, no network calls", async () => {
    const w = world();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const created = await create(w.owner, createBody(w.customer.id));
    const id = created.body.optionSet.tierGroupId as string;
    const quotes = await api().get(`${base}/${id}/financing-quotes`).set("Authorization", w.owner);
    expect(quotes.status).toBe(200);
    expect(quotes.body).toEqual({ quotes: [], provider: "disabled", providerReady: false, reason: "financing_disabled" });
    const apply = await api().post(`${base}/${id}/financing-applications`).set("Authorization", w.owner).send({ estimateId: created.body.optionSet.options[0].estimateId });
    expect(apply.status).toBe(403);
    expect(apply.body.fields).toMatchObject({ reason: "financing_disabled" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
