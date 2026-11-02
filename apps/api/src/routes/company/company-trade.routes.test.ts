/** Growth: shop trade setting + trade service catalog + public site defaults. */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { HOME_SERVICE_TRADES, TRADE_SERVICE_CATALOG } from "@fsm/types";

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

type FakeDbModule = typeof import("../../test-support/fake-db.js");
let buildAppModule: typeof import("../../app.js");
let fakeDb: FakeDbModule;
let tokens: typeof import("../../lib/tokens.js");
let app: Awaited<ReturnType<typeof buildAppModule.buildApp>>;

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

function shop(slug: string, settings: Record<string, unknown> = { currency: "USD" }) {
  const company = fakeDb.seedCompany({ name: `Shop ${slug}`, slug, settings } as never);
  const user = (role: string) => {
    const u = fakeDb.seedUser({ companyId: company.id, email: `${role}@${slug}.test`, firstName: role, lastName: "User", role } as never);
    return `Bearer ${tokens.generateAccessToken({ userId: u.id, companyId: company.id, role: role as never })}`;
  };
  return { company, user };
}

describe("company trade setting", () => {
  it("owner/admin set the trade; it is stored in settings without dropping other keys", async () => {
    const a = shop("a-hvac");
    const before = await request(app.server).get("/api/v1/company/trade").set("Authorization", a.user("owner"));
    expect(before.status).toBe(200);
    expect(before.body.trade).toEqual({ trade: null, label: null, schemaType: null, tradeDescription: null });

    for (const role of ["owner", "admin"]) {
      const res = await request(app.server).put("/api/v1/company/trade").set("Authorization", a.user(role)).send({ trade: "hvac" });
      expect(res.status).toBe(200);
      expect(res.body.trade).toMatchObject({ trade: "hvac", schemaType: "HVACBusiness" });
    }
    const stored = fakeDb.getTestState().companies.find((c) => c.id === a.company.id)!.settings as Record<string, unknown>;
    expect(stored).toMatchObject({ trade: "hvac", currency: "USD" });
  });

  it.each(["dispatcher", "technician", "office"])("forbids %s from setting the trade", async (role) => {
    const a = shop(`f-${role}`);
    const res = await request(app.server).put("/api/v1/company/trade").set("Authorization", a.user(role)).send({ trade: "plumbing" });
    expect(res.status).toBe(403);
  });

  it("returns 403 (not 400) to non-admin staff even with an invalid body", async () => {
    const a = shop("o-shop");
    for (const role of ["dispatcher", "technician"]) {
      const res = await request(app.server).put("/api/v1/company/trade").set("Authorization", a.user(role)).send({ trade: "roofing", x: 1 });
      expect(res.status).toBe(403);
    }
  });

  it("changes only the trade key and keeps a concurrent settings save", async () => {
    const a = shop("cc-shop");
    const owner = a.user("owner");
    const [put, patch] = await Promise.all([
      request(app.server).put("/api/v1/company/trade").set("Authorization", owner).send({ trade: "plumbing" }),
      request(app.server).patch("/api/v1/company").set("Authorization", owner).send({ settings: { tradingName: "Pipes R Us" } })
    ]);
    expect(put.status).toBe(200);
    expect(patch.status).toBe(200);
    const stored = fakeDb.getTestState().companies.find((c) => c.id === a.company.id)!.settings as Record<string, unknown>;
    expect(stored).toMatchObject({ trade: "plumbing", tradingName: "Pipes R Us", currency: "USD" });
  });

  it.each([[{ trade: "cleaning" }], [{ trade: "" }], [{}], [{ trade: "hvac", extra: 1 }]])("rejects invalid body %j", async (body) => {
    const a = shop("v-shop");
    const res = await request(app.server).put("/api/v1/company/trade").set("Authorization", a.user("owner")).send(body);
    expect(res.status).toBe(400);
  });

  it("requires auth and is tenant scoped", async () => {
    const a = shop("t-a");
    const b = shop("t-b");
    expect((await request(app.server).get("/api/v1/company/trade")).status).toBe(401);
    await request(app.server).put("/api/v1/company/trade").set("Authorization", a.user("owner")).send({ trade: "electrical" });
    const other = await request(app.server).get("/api/v1/company/trade").set("Authorization", b.user("owner"));
    expect(other.body.trade.trade).toBeNull();
  });
});

describe("trade service catalog", () => {
  it("has text-keyed services for every trade, including the core home-service jobs", () => {
    for (const trade of HOME_SERVICE_TRADES) {
      const keys = TRADE_SERVICE_CATALOG[trade].map((s) => s.key);
      expect(keys.length).toBeGreaterThan(0);
      expect(new Set(keys).size).toBe(keys.length);
      expect(keys.every((k) => k.startsWith(`${trade}.`))).toBe(true);
    }
    const labels = Object.values(TRADE_SERVICE_CATALOG).flat().map((s) => s.label);
    for (const l of ["AC repair", "Furnace tune-up", "Drain cleaning", "Water heater repair", "Panel upgrade", "EV charger installation"]) {
      expect(labels).toContain(l);
    }
  });

  it("serves the company trade's catalog, an explicit trade, or none when unset", async () => {
    const a = shop("c-a", { trade: "plumbing" });
    const own = await request(app.server).get("/api/v1/company/trade/services").set("Authorization", a.user("technician"));
    expect(own.status).toBe(200);
    expect(own.body.trade).toBe("plumbing");
    expect(own.body.services.map((s: { key: string }) => s.key)).toContain("plumbing.drain_cleaning");

    const explicit = await request(app.server).get("/api/v1/company/trade/services?trade=electrical").set("Authorization", a.user("owner"));
    expect(explicit.body.services.map((s: { key: string }) => s.key)).toContain("electrical.panel_upgrade");

    expect((await request(app.server).get("/api/v1/company/trade/services?trade=roofing").set("Authorization", a.user("owner"))).status).toBe(400);
    const b = shop("c-b");
    const none = await request(app.server).get("/api/v1/company/trade/services").set("Authorization", b.user("owner"));
    expect(none.body).toEqual({ trade: null, services: [] });
  });
});

describe("public site uses the trade", () => {
  it("exposes trade + schema type and seeds default services only when the shop has none", async () => {
    const a = shop("p-a", { trade: "hvac" });
    fakeDb.seedBookingSettings({ companyId: a.company.id, bookingSlug: "p-a", isEnabled: true } as never);
    const res = await request(app.server).get("/api/v1/public/booking/p-a");
    expect(res.status).toBe(200);
    expect(res.body.booking.trade).toBe("hvac");
    expect(res.body.booking.tradeSchemaType).toBe("HVACBusiness");
    expect(res.body.booking.offeredServices.map((s: { key: string }) => s.key)).toContain("hvac.ac_repair");

    const b = shop("p-b", { trade: "plumbing" });
    fakeDb.seedBookingSettings({
      companyId: b.company.id,
      bookingSlug: "p-b",
      isEnabled: true,
      offeredServices: [{ name: "Custom repipe" }]
    } as never);
    const custom = await request(app.server).get("/api/v1/public/booking/p-b");
    expect(custom.body.booking.offeredServices).toEqual([{ name: "Custom repipe" }]);
    expect(custom.body.booking.tradeSchemaType).toBe("Plumber");

    const c = shop("p-c");
    fakeDb.seedBookingSettings({ companyId: c.company.id, bookingSlug: "p-c", isEnabled: true } as never);
    const unset = await request(app.server).get("/api/v1/public/booking/p-c");
    expect(unset.body.booking).toMatchObject({ trade: null, tradeSchemaType: null, offeredServices: [] });

    // A stored value outside the four-value enum is never exposed publicly.
    const d = shop("p-d", { trade: "roofing" });
    fakeDb.seedBookingSettings({ companyId: d.company.id, bookingSlug: "p-d", isEnabled: true } as never);
    const bogus = await request(app.server).get("/api/v1/public/booking/p-d");
    expect(bogus.body.booking.trade).toBeNull();
    expect(HOME_SERVICE_TRADES).toEqual(["hvac", "plumbing", "electrical", "other"]);
  });
});

describe("tradeDescription (Describe your trade)", () => {
  const put = (auth: string, body: unknown) => request(app.server).put("/api/v1/company/trade").set("Authorization", auth).send(body as object);
  const stored = (id: string) => fakeDb.getTestState().companies.find((c) => c.id === id)!.settings as Record<string, unknown>;

  it("is required (400) for trade other: missing, empty or whitespace", async () => {
    const a = shop("d-req");
    for (const body of [{ trade: "other" }, { trade: "other", tradeDescription: "" }, { trade: "other", tradeDescription: "   " }, { trade: "other", tradeDescription: null }]) {
      expect((await put(a.user("owner"), body)).status).toBe(400);
    }
    expect(stored(a.company.id).trade).toBeUndefined();
  });

  it("saves trimmed for other and is returned by the owner read and public settings", async () => {
    const a = shop("d-ok");
    fakeDb.seedBookingSettings({ companyId: a.company.id, bookingSlug: "d-ok", isEnabled: true } as never);
    const res = await put(a.user("admin"), { trade: "other", tradeDescription: "  Pool & spa repair  " });
    expect(res.status).toBe(200);
    expect(res.body.trade).toMatchObject({ trade: "other", tradeDescription: "Pool & spa repair" });
    expect(stored(a.company.id)).toMatchObject({ trade: "other", tradeDescription: "Pool & spa repair", currency: "USD" });
    const read = await request(app.server).get("/api/v1/company/trade").set("Authorization", a.user("owner"));
    expect(read.body.trade.tradeDescription).toBe("Pool & spa repair");
    const pub = await request(app.server).get("/api/v1/public/booking/d-ok");
    expect(pub.body.booking.tradeDescription).toBe("Pool & spa repair");
  });

  it("rejects more than 100 characters (400); exactly 100 is ok", async () => {
    const a = shop("d-len");
    expect((await put(a.user("owner"), { trade: "other", tradeDescription: "x".repeat(101) })).status).toBe(400);
    expect((await put(a.user("owner"), { trade: "other", tradeDescription: "x".repeat(100) })).status).toBe(200);
  });

  it("is cleared when trade is not other, even if sent; public settings return null", async () => {
    const a = shop("d-clr");
    fakeDb.seedBookingSettings({ companyId: a.company.id, bookingSlug: "d-clr", isEnabled: true } as never);
    await put(a.user("owner"), { trade: "other", tradeDescription: "Chimney sweep" });
    const res = await put(a.user("owner"), { trade: "plumbing", tradeDescription: "ignored" });
    expect(res.status).toBe(200);
    expect(res.body.trade.tradeDescription).toBeNull();
    expect(stored(a.company.id)).not.toHaveProperty("tradeDescription");
    expect((await request(app.server).get("/api/v1/public/booking/d-clr")).body.booking.tradeDescription).toBeNull();
  });

  it("staff get 403 before validation (invalid description)", async () => {
    const a = shop("d-403");
    for (const role of ["dispatcher", "technician"]) {
      expect((await put(a.user(role), { trade: "other", tradeDescription: "x".repeat(500) })).status).toBe(403);
      expect((await put(a.user(role), { trade: "other" })).status).toBe(403);
    }
  });

  it("concurrent settings save keeps trade + description", async () => {
    const a = shop("d-cc");
    const owner = a.user("owner");
    const [t, p] = await Promise.all([
      put(owner, { trade: "other", tradeDescription: "Garage doors" }),
      request(app.server).patch("/api/v1/company").set("Authorization", owner).send({ settings: { tradingName: "Doors Co" } })
    ]);
    expect(t.status).toBe(200);
    expect(p.status).toBe(200);
    expect(stored(a.company.id)).toMatchObject({ trade: "other", tradeDescription: "Garage doors", tradingName: "Doors Co", currency: "USD" });
  });
});
