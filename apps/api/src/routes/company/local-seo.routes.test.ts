/** Growth (home services): local-business JSON-LD, GBP categories, PATCH /company settings lock. */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GBP_TRADE_CATEGORY_REGISTRY,
  LOCAL_BUSINESS_MAX_AREA_ZIPS,
  buildLocalBusinessJsonLd,
  getGbpCategoriesForTrade,
  sanitizePublicUrl,
  schemaOrgTypeForTrade,
  serializeJsonLdForScript
} from "@fsm/types";

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
let pbrl: typeof import("../../lib/public-booking-rate-limit.js");
let app: Awaited<ReturnType<typeof buildAppModule.buildApp>>;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
  rl = await import("../../lib/fixed-window-rate-limit.js");
  pbrl = await import("../../lib/public-booking-rate-limit.js");
});
beforeEach(async () => {
  fakeDb.resetTestState();
  rl.resetFixedWindowRateLimitStateForTests();
  pbrl.resetPublicBookingRateLimitStateForTests();
  app = await buildAppModule.buildApp();
  await app.ready();
});
afterEach(async () => {
  await closeTestApp(app);
});

function shop(slug: string, settings: Record<string, unknown> = { currency: "USD" }) {
  const company = fakeDb.seedCompany({ name: `Shop ${slug}`, slug, settings } as never);
  fakeDb.seedBookingSettings({ companyId: company.id, bookingSlug: slug, isEnabled: true, allowZipOverflow: true } as never);
  const user = (role: string) => {
    const u = fakeDb.seedUser({ companyId: company.id, email: `${role}@${slug}.test`, firstName: role, lastName: "User", role } as never);
    return `Bearer ${tokens.generateAccessToken({ userId: u.id, companyId: company.id, role: role as never })}`;
  };
  return { company, user };
}

const settingsOf = (id: string) => fakeDb.getTestState().companies.find((c) => c.id === id)!.settings as Record<string, unknown>;

const HOSTILE = "</script><img src=x onerror=alert(1)>&\u2028\u2029";

function seedPublicShop(slug: string, settings: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const a = shop(slug, settings);
  const state = fakeDb.getTestState();
  Object.assign(state.companies.find((c) => c.id === a.company.id)!, {
    email: "owner-private@example.test",
    phone: "(918) 555-0100",
    addressLine1: "42 Private Home Ln",
    city: "Tulsa",
    state: "OK",
    zip: "74103",
    website: "https://acme-hvac.example",
    ...extra
  });
  Object.assign(state.bookingSettings.find((b) => b.companyId === a.company.id)!, {
    googleReviewUrl: "https://g.page/r/acme",
    yelpReviewUrl: "javascript:alert(1)",
    facebookReviewUrl: "not a url",
    customReviewUrl: "ftp://files.example/x",
    availableDays: ["mon", "tue", "wed", "thu", "fri"],
    availableHoursStart: 8,
    availableHoursEnd: 17
  });
  return a;
}

describe("registries", () => {
  it("schema.org @type and GBP categories per trade, fallback to other", () => {
    expect(schemaOrgTypeForTrade("hvac")).toBe("HVACBusiness");
    expect(schemaOrgTypeForTrade("plumbing")).toBe("Plumber");
    expect(schemaOrgTypeForTrade("electrical")).toBe("Electrician");
    expect(schemaOrgTypeForTrade("other")).toBe("HomeAndConstructionBusiness");
    expect(schemaOrgTypeForTrade(undefined)).toBe("HomeAndConstructionBusiness");
    expect(schemaOrgTypeForTrade("__proto__")).toBe("HomeAndConstructionBusiness");
    expect(getGbpCategoriesForTrade("hvac")).toMatchObject({ primary: "HVAC contractor", adapterStatus: "not_configured" });
    expect(getGbpCategoriesForTrade("plumbing").primary).toBe("Plumber");
    expect(getGbpCategoriesForTrade("electrical").primary).toBe("Electrician");
    expect(getGbpCategoriesForTrade(null).trade).toBe("other");
    for (const entry of Object.values(GBP_TRADE_CATEGORY_REGISTRY)) expect(entry.secondary.length).toBeGreaterThan(0);
  });

  it("GBP categories endpoint is owner/admin only and reads settings.trade", async () => {
    const a = shop("gbp-a", { trade: "electrical" });
    const owner = await request(app.server).get("/api/v1/company/gbp-categories").set("Authorization", a.user("owner"));
    expect(owner.status).toBe(200);
    expect(owner.body.gbpCategories).toMatchObject({ trade: "electrical", primary: "Electrician", adapterStatus: "not_configured" });
    expect((await request(app.server).get("/api/v1/company/gbp-categories").set("Authorization", a.user("technician"))).status).toBe(403);
  });
});

describe("JSON-LD builder", () => {
  it("escapes hostile strings so they cannot break out of a script tag", () => {
    const jsonLd = buildLocalBusinessJsonLd({
      name: HOSTILE, trade: "hvac", url: null, telephone: null, areaServedZips: [], availableDays: [],
      availableHoursStart: null, availableHoursEnd: null, emergency24x7: false, sameAs: []
    });
    const script = serializeJsonLdForScript(jsonLd);
    expect(script).not.toMatch(/[<>&\u2028\u2029]/u);
    expect(script.toLowerCase()).not.toContain("</script");
    expect(JSON.parse(script).name).toBe(HOSTILE);
  });

  it("drops invalid / non-http URLs and caps areaServed ZIPs", () => {
    expect(sanitizePublicUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizePublicUrl("data:text/html,x")).toBeNull();
    expect(sanitizePublicUrl("https://user:pw@x.example")).toBeNull();
    expect(sanitizePublicUrl("https://ok.example/a")).toBe("https://ok.example/a");
    const zips = Array.from({ length: 120 }, (_, i) => String(70000 + i));
    const jsonLd = buildLocalBusinessJsonLd({
      name: "X", trade: "plumbing", url: "javascript:void(0)", telephone: "<b>", areaServedZips: [...zips, "bad"],
      availableDays: [], availableHoursStart: null, availableHoursEnd: null, emergency24x7: false,
      sameAs: ["https://a.example", "vbscript:x", "https://a.example"]
    });
    expect(jsonLd.url).toBeUndefined();
    expect(jsonLd.telephone).toBeUndefined();
    expect(jsonLd.areaServed).toHaveLength(LOCAL_BUSINESS_MAX_AREA_ZIPS);
    expect(jsonLd.sameAs).toEqual(["https://a.example/"]);
  });
});

describe("public structured-data endpoint", () => {
  it("returns public data only (no emails, street address or tech info), hours and sanitized sameAs", async () => {
    seedPublicShop("seo-a", { trade: "hvac", serviceArea: { zips: ["74103", "74104"], radiusMiles: null } });
    const res = await request(app.server).get("/api/v1/public/site/seo-a/structured-data");
    expect(res.status).toBe(200);
    const { jsonLd, script } = res.body;
    expect(jsonLd["@type"]).toBe("HVACBusiness");
    expect(jsonLd.telephone).toBe("(918) 555-0100");
    expect(jsonLd.url).toMatch(/\/site\/seo-a$/u);
    expect(jsonLd.areaServed).toEqual([{ "@type": "PostalCode", postalCode: "74103" }, { "@type": "PostalCode", postalCode: "74104" }]);
    expect(jsonLd.openingHoursSpecification).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "17:00" }
    ]);
    expect(jsonLd.sameAs).toEqual(["https://acme-hvac.example/", "https://g.page/r/acme"]);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain("owner-private@example.test");
    expect(raw).not.toContain("Private Home Ln");
    expect(raw).not.toMatch(/techCount|technician/iu);
    expect(JSON.parse(script)).toEqual(jsonLd);
  });

  it("24/7 hours only when emergency service is enabled and accepted for the trade", async () => {
    seedPublicShop("seo-e", { trade: "plumbing", emergencyService: { enabled: true, hoursText: "24/7" } });
    const on = (await request(app.server).get("/api/v1/public/site/seo-e/structured-data")).body.jsonLd;
    expect(on.openingHoursSpecification).toEqual([
      { "@type": "OpeningHoursSpecification", dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"], opens: "00:00", closes: "23:59" }
    ]);
    seedPublicShop("seo-o", { trade: "other", emergencyService: { enabled: true, hoursText: null } });
    const notCapable = (await request(app.server).get("/api/v1/public/site/seo-o/structured-data")).body.jsonLd;
    expect(notCapable.openingHoursSpecification[0].opens).toBe("08:00");
    seedPublicShop("seo-d", { trade: "hvac", emergencyService: { enabled: false, hoursText: null } });
    const off = (await request(app.server).get("/api/v1/public/site/seo-d/structured-data")).body.jsonLd;
    expect(off.openingHoursSpecification[0].dayOfWeek).toHaveLength(5);
  });

  it("hostile shop name is escaped in the script string; unknown shop 404s", async () => {
    seedPublicShop("seo-x", {}, { name: HOSTILE });
    const res = await request(app.server).get("/api/v1/public/site/seo-x/structured-data");
    expect(res.status).toBe(200);
    expect(res.body.script).not.toMatch(/[<>&]/u);
    expect((await request(app.server).get("/api/v1/public/site/nope-shop/structured-data")).status).toBe(404);
  });
});

describe("PATCH /company settings lock", () => {
  it("concurrent locked settings-key save + PATCH company: settings.trade and the other key both survive", async () => {
    const a = shop("lock-a", { trade: "plumbing", currency: "USD" });
    const owner = a.user("owner");
    const [patch, emergency] = await Promise.all([
      request(app.server).patch("/api/v1/company").set("Authorization", owner).send({ settings: { tradingName: "Acme Plumbing" } }),
      request(app.server).put("/api/v1/company/emergency-service").set("Authorization", owner).send({ enabled: true, hoursText: null })
    ]);
    expect(patch.status).toBe(200);
    expect(emergency.status).toBe(200);
    expect(settingsOf(a.company.id)).toMatchObject({
      trade: "plumbing",
      tradingName: "Acme Plumbing",
      emergencyService: { enabled: true, hoursText: null }
    });
  });

  it("PATCH /company with a stale settings payload never drops trade (merges only sent fields)", async () => {
    const a = shop("lock-b", { currency: "USD" });
    fakeDb.getTestState().companies.find((c) => c.id === a.company.id)!.settings = { currency: "USD", trade: "hvac" } as never;
    const res = await request(app.server).patch("/api/v1/company").set("Authorization", a.user("owner")).send({ name: "Renamed", settings: { tradingName: "T" } });
    expect(res.status).toBe(200);
    expect(settingsOf(a.company.id)).toMatchObject({ trade: "hvac", tradingName: "T", currency: "USD" });
  });
});
