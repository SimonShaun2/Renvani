/** Growth — public marketing intake routes (demo requests + Growth Check). */
import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { closeTestApp } from "../../../test-support/close-test-app.js";
import { setupTestEnv } from "../../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => (await import("../../../test-support/fake-db.js")).createDrizzleModuleMock());
vi.mock("@fsm/db", async () => (await import("../../../test-support/fake-db.js")).createDbModuleMock());
vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  agreementsQueue: { add: vi.fn() },
  importsQueue: { add: vi.fn() },
  invoicesQueue: { add: vi.fn() },
  notificationsQueue: { add: vi.fn() },
  webhooksQueue: { add: vi.fn() },
  redisConnection: { get: vi.fn(async () => null), set: vi.fn(async () => "OK"), del: vi.fn(async () => 1) }
}));

const envOverrides = vi.hoisted(() => ({ MARKETING_NOTIFY_EMAIL: "", MARKETING_IP_HASH_SALT: "" } as Record<string, string>));
vi.mock("@fsm/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fsm/config")>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get: (target, key) => (typeof key === "string" && key in envOverrides ? envOverrides[key] : Reflect.get(target, key))
    })
  };
});

const repo = vi.hoisted(() => ({
  demo: [] as Array<Record<string, unknown>>,
  growth: [] as Array<Record<string, unknown>>,
  fail: false
}));
vi.mock("../../../services/marketing-intake.repository.js", () => ({
  insertMarketingDemoRequest: vi.fn(async (row: Record<string, unknown>) => {
    repo.demo.push(row);
    return `00000000-0000-4000-8000-${String(repo.demo.length).padStart(12, "0")}`;
  }),
  insertMarketingGrowthCheck: vi.fn(async (row: Record<string, unknown>) => {
    repo.growth.push(row);
    return `00000000-0000-4000-9000-${String(repo.growth.length).padStart(12, "0")}`;
  })
}));
const mail = vi.hoisted(() => ({ send: vi.fn(async () => ({ providerMessageId: "m1" })), channel: true }));
vi.mock("../../../lib/outbound-email.js", () => ({
  getEmailChannel: () => (mail.channel ? { sendTransactionalEmail: mail.send } : null)
}));

let buildAppModule: typeof import("../../../app.js");
let rl: typeof import("../../../lib/fixed-window-rate-limit.js");
let app: Awaited<ReturnType<typeof buildAppModule.buildApp>>;

beforeAll(async () => {
  buildAppModule = await import("../../../app.js");
  rl = await import("../../../lib/fixed-window-rate-limit.js");
});
beforeEach(async () => {
  repo.demo.length = 0;
  repo.growth.length = 0;
  mail.send.mockClear();
  mail.send.mockImplementation(async () => ({ providerMessageId: "m1" }));
  mail.channel = true;
  envOverrides.MARKETING_NOTIFY_EMAIL = "";
  envOverrides.MARKETING_IP_HASH_SALT = "";
  rl.resetFixedWindowRateLimitStateForTests();
  app = await buildAppModule.buildApp();
  await app.ready();
});
afterEach(async () => {
  await closeTestApp(app);
});

let ipCounter = 0;
const freshIp = () => `203.0.113.${(ipCounter += 1)}`;
const DEMO = "/api/v1/public/marketing/demo-requests";
const GC = "/api/v1/public/marketing/growth-checks";
const demo = { name: "  Ann Lee ", email: " Ann@Example.COM ", phone: "(918) 555-0100", company: " Lee Heating ", trade: "hvac", message: " Call me <b>soon</b> " };
const gc = { websiteUrl: " https://leeheating.example/ ", trade: "plumbing", zip: "74103", email: "OWNER@LeeHeating.example" };

async function post(path: string, payload: unknown, ip = freshIp()) {
  return app.inject({ method: "POST", url: path, payload: payload as object, remoteAddress: ip });
}

describe("POST /public/marketing/demo-requests", () => {
  it("persists trimmed/normalized row and returns only { ok, confirmationId }", async () => {
    const res = await post(DEMO, demo);
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body).toEqual({ ok: true, confirmationId: expect.any(String) });
    expect(res.body).not.toMatch(/Ann|Lee|example|555/i);
    expect(repo.demo).toEqual([
      { name: "Ann Lee", email: "ann@example.com", phone: "+19185550100", company: "Lee Heating", trade: "hvac", message: "Call me <b>soon</b>", ipHash: null }
    ]);
  });

  it("optional phone/message omitted → nulls", async () => {
    const { phone: _p, message: _m, ...rest } = demo;
    expect((await post(DEMO, rest)).statusCode).toBe(201);
    expect(repo.demo[0]).toMatchObject({ phone: null, message: null });
  });

  it.each([
    ["extra field", { ...demo, admin: true }],
    ["missing name", { ...demo, name: undefined }],
    ["bad email", { ...demo, email: "nope" }],
    ["bad phone", { ...demo, phone: "123" }],
    ["unknown trade", { ...demo, trade: "roofing" }],
    ["long company", { ...demo, company: "x".repeat(161) }],
    ["long message", { ...demo, message: "x".repeat(2001) }]
  ])("400 on %s and saves nothing", async (_n, payload) => {
    const res = await post(DEMO, payload);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe("VALIDATION_ERROR");
    expect(repo.demo).toHaveLength(0);
  });

  it("honeypot filled → same 201 shape, nothing persisted, no notification", async () => {
    envOverrides.MARKETING_NOTIFY_EMAIL = "growth@renvani.test";
    const res = await post(DEMO, { ...demo, hp: "http://spam.example" });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true, confirmationId: expect.any(String) });
    expect(repo.demo).toHaveLength(0);
    expect(mail.send).not.toHaveBeenCalled();
  });

  it("413 when body exceeds 8KB", async () => {
    const res = await post(DEMO, { ...demo, message: "x".repeat(9000) });
    expect(res.statusCode).toBe(413);
    expect(repo.demo).toHaveLength(0);
  });

  it("rate limits 5/min/IP with 429 + Retry-After", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) expect((await post(DEMO, demo, ip)).statusCode).toBe(201);
    const res = await post(DEMO, demo, ip);
    expect(res.statusCode).toBe(429);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    expect(res.json().error).toBe("RATE_LIMITED");
    expect(repo.demo).toHaveLength(5);
    expect((await post(DEMO, demo)).statusCode).toBe(201);
  });

  it("notifies with escaped HTML and single-line subject when configured; stores salted IP hash only", async () => {
    envOverrides.MARKETING_NOTIFY_EMAIL = "growth@renvani.test";
    envOverrides.MARKETING_IP_HASH_SALT = "salt";
    const res = await post(DEMO, { ...demo, company: "Evil\r\nBcc: x@y.z" }, "203.0.113.250");
    expect(res.statusCode).toBe(201);
    expect(mail.send).toHaveBeenCalledTimes(1);
    const payload = (mail.send.mock.calls[0] as unknown as [{ to: string; subject: string; html: string }])[0];
    expect(payload.to).toBe("growth@renvani.test");
    expect(payload.subject).not.toMatch(/[\r\n]/);
    expect(payload.html).toContain("&lt;b&gt;soon&lt;/b&gt;");
    expect(payload.html).not.toContain("<b>soon</b>");
    expect(repo.demo[0]!.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(repo.demo[0])).not.toContain("203.0.113.250");
  });

  it("notification failure or missing provider never breaks the request; row still saved", async () => {
    envOverrides.MARKETING_NOTIFY_EMAIL = "growth@renvani.test";
    mail.send.mockImplementation(async () => {
      throw new Error("provider down");
    });
    expect((await post(DEMO, demo)).statusCode).toBe(201);
    mail.channel = false;
    expect((await post(DEMO, demo)).statusCode).toBe(201);
    expect(repo.demo).toHaveLength(2);
  });

  it("skips notification silently when MARKETING_NOTIFY_EMAIL is unset", async () => {
    expect((await post(DEMO, demo)).statusCode).toBe(201);
    expect(mail.send).not.toHaveBeenCalled();
  });
});

describe("POST /public/marketing/growth-checks", () => {
  it("persists normalized row with zip; returns only { ok, confirmationId }", async () => {
    const res = await post(GC, gc);
    expect(res.statusCode).toBe(201);
    expect(res.json()).toEqual({ ok: true, confirmationId: expect.any(String) });
    expect(res.body).not.toMatch(/leeheating|74103/i);
    expect(repo.growth).toEqual([
      { websiteUrl: "https://leeheating.example/", trade: "plumbing", zip: "74103", city: null, email: "owner@leeheating.example", ipHash: null }
    ]);
  });

  it("accepts city instead of zip (trimmed)", async () => {
    const { zip: _z, ...rest } = gc;
    expect((await post(GC, { ...rest, city: "  Tulsa " })).statusCode).toBe(201);
    expect(repo.growth[0]).toMatchObject({ zip: null, city: "Tulsa" });
  });

  it.each([
    ["no zip or city", { ...gc, zip: undefined }],
    ["4-digit zip", { ...gc, zip: "7410" }],
    ["ftp url", { ...gc, websiteUrl: "ftp://x.example" }],
    ["javascript url", { ...gc, websiteUrl: "javascript:alert(1)" }],
    ["bad email", { ...gc, email: "x" }],
    ["long city", { ...gc, city: "x".repeat(101) }],
    ["extra field", { ...gc, companyId: "abc" }]
  ])("400 on %s", async (_n, payload) => {
    const res = await post(GC, payload);
    expect(res.statusCode).toBe(400);
    expect(repo.growth).toHaveLength(0);
  });

  it("honeypot → 201 same shape, nothing persisted", async () => {
    const res = await post(GC, { ...gc, hp: "bot" });
    expect(res.statusCode).toBe(201);
    expect(Object.keys(res.json()).sort()).toEqual(["confirmationId", "ok"]);
    expect(repo.growth).toHaveLength(0);
  });

  it("duplicates get the same response shape", async () => {
    const a = await post(GC, gc);
    const b = await post(GC, gc);
    expect(Object.keys(a.json()).sort()).toEqual(Object.keys(b.json()).sort());
  });

  it("separate 5/min/IP bucket with 429 + Retry-After", async () => {
    const ip = freshIp();
    for (let i = 0; i < 5; i += 1) expect((await post(GC, gc, ip)).statusCode).toBe(201);
    const res = await post(GC, gc, ip);
    expect(res.statusCode).toBe(429);
    expect(res.headers["retry-after"]).toBeDefined();
    expect((await post(DEMO, demo, ip)).statusCode).toBe(201);
  });
});
