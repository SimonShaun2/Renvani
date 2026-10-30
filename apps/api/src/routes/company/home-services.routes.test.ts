/** Growth (home services): service-area ZIP check + 24/7 emergency flag. */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { UsZipSchema, resolveEmergencyRequest } from "@fsm/types";

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
let ipCounter = 0;
const freshIp = () => `198.51.100.${(ipCounter += 1)}`;

describe("service area settings", () => {
  it("owner/admin save a normalized ZIP list + radius; only the serviceArea key changes", async () => {
    const a = shop("sa-a", { currency: "USD", trade: "hvac" });
    const res = await request(app.server)
      .put("/api/v1/company/service-area")
      .set("Authorization", a.user("admin"))
      .send({ zips: ["74103", "74104-1234", "741050000", "74103"], radiusMiles: 25 });
    expect(res.status).toBe(200);
    expect(res.body.serviceArea).toEqual({ zips: ["74103", "74104", "74105"], radiusMiles: 25 });
    expect(settingsOf(a.company.id)).toMatchObject({ currency: "USD", trade: "hvac", serviceArea: { zips: ["74103", "74104", "74105"] } });
    const read = await request(app.server).get("/api/v1/company/service-area").set("Authorization", a.user("technician"));
    expect(read.body.serviceArea.radiusMiles).toBe(25);
  });

  it("staff get 403 before body validation", async () => {
    const a = shop("sa-r");
    for (const role of ["dispatcher", "technician"]) {
      for (const path of ["/api/v1/company/service-area", "/api/v1/company/emergency-service"]) {
        const res = await request(app.server).put(path).set("Authorization", a.user(role)).send({ bogus: true });
        expect(res.status).toBe(403);
      }
    }
  });

  it.each([
    [{ zips: ["7410"] }],
    [{ zips: ["ABCDE"] }],
    [{ zips: ["74103-12"] }],
    [{ zips: ["74103"], radiusMiles: 0 }],
    [{ zips: ["74103"], radiusMiles: 1000 }],
    [{ zips: ["74103"], extra: 1 }],
    [{}]
  ])("rejects invalid body %j with 400", async (body) => {
    const a = shop("sa-v");
    const res = await request(app.server).put("/api/v1/company/service-area").set("Authorization", a.user("owner")).send(body);
    expect(res.status).toBe(400);
  });

  it("concurrent emergency + service-area saves both persist", async () => {
    const a = shop("sa-c");
    const owner = a.user("owner");
    const [x, y] = await Promise.all([
      request(app.server).put("/api/v1/company/service-area").set("Authorization", owner).send({ zips: ["10001"] }),
      request(app.server).put("/api/v1/company/emergency-service").set("Authorization", owner).send({ enabled: true, hoursText: "24/7" })
    ]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect(settingsOf(a.company.id)).toMatchObject({
      currency: "USD",
      serviceArea: { zips: ["10001"] },
      emergencyService: { enabled: true, hoursText: "24/7" }
    });
  });
});

describe("public serves-zip", () => {
  it("answers in/out only, normalizes ZIP+4, and leaks no ZIP list", async () => {
    const a = shop("pz-a");
    await request(app.server).put("/api/v1/company/service-area").set("Authorization", a.user("owner")).send({ zips: ["74103"] });
    const ip = freshIp();
    const inside = await request(app.server).post("/api/v1/public/booking/pz-a/serves-zip").set("X-Forwarded-For", ip).send({ zip: "74103-4455" });
    expect(inside.status).toBe(200);
    expect(inside.body).toEqual({ served: true });
    const outside = await request(app.server).post("/api/v1/public/booking/pz-a/serves-zip").send({ zip: "90210" });
    expect(outside.body).toEqual({ served: false });
    expect(JSON.stringify(outside.body)).not.toContain("74103");
  });

  it("404s for an unknown shop and 400s for bad ZIPs", async () => {
    expect((await request(app.server).post("/api/v1/public/booking/nope/serves-zip").send({ zip: "74103" })).status).toBe(404);
    shop("pz-b");
    for (const body of [{ zip: "7410" }, { zip: "abcde" }, { zip: "74103", x: 1 }, {}]) {
      expect((await request(app.server).post("/api/v1/public/booking/pz-b/serves-zip").send(body)).status).toBe(400);
    }
  });

  it("falls back to existing coverage when no ZIP list is configured", async () => {
    shop("pz-f"); // allowZipOverflow: true
    const res = await request(app.server).post("/api/v1/public/booking/pz-f/serves-zip").send({ zip: "12345" });
    expect(res.body).toEqual({ served: true });
  });

  it("is rate limited per IP with Retry-After", async () => {
    shop("pz-rl");
    const { PUBLIC_SERVES_ZIP_IP_RATE_LIMIT } = await import("../public/booking/index.js");
    let last = 0;
    for (let i = 0; i <= PUBLIC_SERVES_ZIP_IP_RATE_LIMIT; i += 1) {
      const res = await app.inject({ method: "POST", url: "/api/v1/public/booking/pz-rl/serves-zip", remoteAddress: "203.0.113.77", payload: { zip: "74103" } });
      last = res.statusCode;
      if (i < PUBLIC_SERVES_ZIP_IP_RATE_LIMIT) expect(res.statusCode).toBe(200);
      else expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    }
    expect(last).toBe(429);
  });
});

describe("24/7 emergency requests", () => {
  const lead = (extra: Record<string, unknown>, phone: string) => ({
    firstName: "Sam",
    lastName: "Lee",
    phone,
    addressLine1: "1 Main St",
    city: "Tulsa",
    state: "OK",
    zip: "74103",
    ...extra
  });

  it("validates the emergency setting and exposes it read-only on the public site", async () => {
    const a = shop("em-s");
    expect((await request(app.server).put("/api/v1/company/emergency-service").set("Authorization", a.user("owner")).send({ enabled: "yes" })).status).toBe(400);
    const pub0 = await request(app.server).get("/api/v1/public/booking/em-s");
    expect(pub0.body.booking.emergencyService).toEqual({ enabled: false, hoursText: null });
    await request(app.server).put("/api/v1/company/emergency-service").set("Authorization", a.user("owner")).send({ enabled: true, hoursText: "Nights & weekends" });
    const pub = await request(app.server).get("/api/v1/public/booking/em-s");
    expect(pub.body.booking.emergencyService).toEqual({ enabled: true, hoursText: "Nights & weekends" });
  });

  it("accepts emergency when enabled, tags the lead, and sorts emergency leads first", async () => {
    const a = shop("em-a", { emergencyService: { enabled: true, hoursText: null }, trade: "plumbing" });
    const normal = await request(app.server).post("/api/v1/public/booking/em-a/submit").send(lead({}, "555-0301"));
    expect(normal.status).toBe(201);
    expect(normal.body.emergency).toBeUndefined();
    const urgent = await request(app.server).post("/api/v1/public/booking/em-a/submit").send(lead({ emergency: true }, "555-0302"));
    expect(urgent.status).toBe(201);
    expect(urgent.body.emergency).toEqual({ requested: true, accepted: true, downgraded: false });
    const later = await request(app.server).post("/api/v1/public/booking/em-a/submit").send(lead({}, "555-0303"));
    expect(later.status).toBe(201);

    const rows = fakeDb.getTestState().bookingRequests;
    expect(rows.find((r) => r.id === urgent.body.bookingRequest.id)!.urgency).toBe("emergency");
    const ev = fakeDb.getTestState().activityEvents.find((e) => e.eventType === "booking.requested" && e.entityId === urgent.body.bookingRequest.id);
    expect(ev?.payload).toMatchObject({ emergency: true });

    const inbox = await request(app.server).get("/api/v1/booking-requests").set("Authorization", a.user("owner"));
    expect(inbox.status).toBe(200);
    expect(inbox.body.data[0].id).toBe(urgent.body.bookingRequest.id);
    expect(inbox.body.data[0]).toMatchObject({ urgency: "emergency", downgraded: false });
    expect(inbox.body.data.find((r: { id: string }) => r.id === normal.body.bookingRequest.id)).toMatchObject({ downgraded: false });
    const detail = await request(app.server).get(`/api/v1/booking-requests/${urgent.body.bookingRequest.id}`).set("Authorization", a.user("owner"));
    expect(detail.status).toBe(200);
    expect(detail.body.bookingRequest).toMatchObject({ urgency: "emergency", downgraded: false });
  });

  it("downgrades (not rejects) emergency when the shop has it off, and documents it in the response", async () => {
    shop("em-off");
    const res = await request(app.server)
      .post("/api/v1/public/booking/em-off/submit")
      .send(lead({ emergency: true, urgency: "emergency" }, "555-0310"));
    expect(res.status).toBe(201);
    expect(res.body.emergency).toEqual({ requested: true, accepted: false, downgraded: true });
    const row = fakeDb.getTestState().bookingRequests.find((r) => r.id === res.body.bookingRequest.id)!;
    expect(row.urgency).toBe("this_week");
  });

  it("urgency 'emergency' WITHOUT emergency:true is still downgraded when the shop has it off (not tagged, not first)", async () => {
    const a = shop("em-u");
    const first = await request(app.server).post("/api/v1/public/booking/em-u/submit").send(lead({}, "555-0320"));
    const res = await request(app.server).post("/api/v1/public/booking/em-u/submit").send(lead({ urgency: "emergency" }, "555-0321"));
    expect(res.status).toBe(201);
    expect(res.body.emergency).toEqual({ requested: true, accepted: false, downgraded: true });
    expect(fakeDb.getTestState().bookingRequests.find((r) => r.id === res.body.bookingRequest.id)!.urgency).toBe("this_week");
    const ev = fakeDb.getTestState().activityEvents.find((e) => e.eventType === "booking.requested" && e.entityId === res.body.bookingRequest.id);
    expect(ev?.payload).not.toMatchObject({ emergency: true });
    const later = await request(app.server).post("/api/v1/public/booking/em-u/submit").send(lead({}, "555-0322"));
    const inbox = await request(app.server).get("/api/v1/booking-requests").set("Authorization", a.user("owner"));
    expect(inbox.body.data[0].id).toBe(later.body.bookingRequest.id);
    expect(inbox.body.data.map((r: { id: string }) => r.id)).toContain(first.body.bookingRequest.id);
    expect(ev?.payload).toMatchObject({ emergencyDowngraded: true });
    const item = inbox.body.data.find((r: { id: string }) => r.id === res.body.bookingRequest.id);
    expect(item).toMatchObject({ urgency: "this_week", downgraded: true });
    expect(inbox.body.data.find((r: { id: string }) => r.id === first.body.bookingRequest.id)).toMatchObject({ downgraded: false });
    const detail = await request(app.server).get(`/api/v1/booking-requests/${res.body.bookingRequest.id}`).set("Authorization", a.user("owner"));
    expect(detail.status).toBe(200);
    expect(detail.body.bookingRequest).toMatchObject({ urgency: "this_week", downgraded: true });
    const oldDetail = await request(app.server).get(`/api/v1/booking-requests/${first.body.bookingRequest.id}`).set("Authorization", a.user("owner"));
    expect(oldDetail.body.bookingRequest.downgraded).toBe(false);
  });

  it("urgency 'emergency' alone is accepted when the shop has it on", async () => {
    shop("em-u2", { emergencyService: { enabled: true, hoursText: null }, trade: "hvac" });
    const res = await request(app.server).post("/api/v1/public/booking/em-u2/submit").send(lead({ urgency: "emergency" }, "555-0323"));
    expect(res.body.emergency).toEqual({ requested: true, accepted: true, downgraded: false });
    expect(fakeDb.getTestState().bookingRequests.find((r) => r.id === res.body.bookingRequest.id)!.urgency).toBe("emergency");
  });

  it("guard lives in submitBookingRequest itself: direct service callers cannot skip the downgrade", async () => {
    shop("em-direct");
    const bookingService = await import("../../services/booking.service.js");
    const out = await bookingService.submitBookingRequest("em-direct", lead({ urgency: "emergency", emergency: true }, "555-0324") as never);
    expect(out.bookingRequest.urgency).toBe("this_week");
  });

  it("public site inquiry path cannot carry urgency/emergency (strict body; stored non-emergency)", async () => {
    shop("em-site");
    const bad = await request(app.server)
      .post("/api/v1/public/site/em-site/inquiry")
      .set("X-Forwarded-For", freshIp())
      .send({ name: "Dana Smith", phone: "(918) 555-0142", zip: "74103", urgency: "emergency", emergency: true });
    expect(bad.status).toBe(400);
    const ok = await request(app.server)
      .post("/api/v1/public/site/em-site/inquiry")
      .set("X-Forwarded-For", freshIp())
      .send({ name: "Dana Smith", phone: "(918) 555-0142", zip: "74103", message: "EMERGENCY no heat" });
    expect(ok.status).toBe(201);
    expect(fakeDb.getTestState().bookingRequests.every((r) => r.urgency !== "emergency")).toBe(true);
  });

  it("registry: non-emergency-capable trade downgrades; ZIP schema normalizes", () => {
    expect(resolveEmergencyRequest(true, { enabled: true, hoursText: null }, "other")).toEqual({ requested: true, accepted: false, downgraded: true });
    expect(resolveEmergencyRequest(true, { enabled: true, hoursText: null }, "hvac").accepted).toBe(true);
    expect(resolveEmergencyRequest(false, { enabled: false, hoursText: null })).toEqual({ requested: false, accepted: false, downgraded: false });
    expect(UsZipSchema.parse("12345-6789")).toBe("12345");
    expect(UsZipSchema.safeParse("1234").success).toBe(false);
  });

  it("tenant isolation: another shop's admin cannot read or change these settings", async () => {
    const a = shop("ti-a");
    const b = shop("ti-b");
    await request(app.server).put("/api/v1/company/service-area").set("Authorization", a.user("owner")).send({ zips: ["74103"] });
    const other = await request(app.server).get("/api/v1/company/service-area").set("Authorization", b.user("owner"));
    expect(other.body.serviceArea.zips).toEqual([]);
    expect(settingsOf(b.company.id).serviceArea).toBeUndefined();
  });
});
