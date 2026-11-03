import { describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const { addQueueJob, redisDelMock, redisGetMock, redisSetMock } = vi.hoisted(() => ({
  addQueueJob: vi.fn(),
  redisDelMock: vi.fn(async () => 1),
  redisGetMock: vi.fn(async () => null),
  redisSetMock: vi.fn(async () => "OK")
}));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: {
    add: addQueueJob
  },
  redisConnection: {
    get: redisGetMock,
    set: redisSetMock,
    del: redisDelMock
  }
}));

describe("DST-aware calendar-day stepping (America/Chicago)", () => {
  const tz = "America/Chicago";
  const HOUR = 60 * 60 * 1000;

  it("fall-back: Nov 1 2026 is a 25h day and the next day starts at local midnight", async () => {
    const svc = await import("./dispatch-intelligence.service.js");
    const start = svc.createTimeZoneDate("2026-11-01", 0, tz);
    const next = svc.getNextTimeZoneDayStart("2026-11-01", tz);
    expect(start.toISOString()).toBe("2026-11-01T05:00:00.000Z");
    expect(next.toISOString()).toBe("2026-11-02T06:00:00.000Z");
    expect(next.getTime() - start.getTime()).toBe(25 * HOUR);
    // Old `+24h` stepping landed at 23:00 on Nov 1, dropping the last local hour.
    expect(new Date(start.getTime() + 24 * HOUR).getTime()).toBeLessThan(next.getTime());
  });

  it("spring-forward: Mar 8 2026 is a 23h day and the next day starts at local midnight", async () => {
    const svc = await import("./dispatch-intelligence.service.js");
    const start = svc.createTimeZoneDate("2026-03-08", 0, tz);
    const next = svc.getNextTimeZoneDayStart("2026-03-08", tz);
    expect(start.toISOString()).toBe("2026-03-08T06:00:00.000Z");
    expect(next.toISOString()).toBe("2026-03-09T05:00:00.000Z");
    expect(next.getTime() - start.getTime()).toBe(23 * HOUR);
    // Old `+24h` stepping overshot into 01:00 on Mar 9.
    expect(new Date(start.getTime() + 24 * HOUR).getTime()).toBeGreaterThan(next.getTime());
  });

  it("ordinary day stays 24h and addCalendarDays handles month/year rollovers", async () => {
    const svc = await import("./dispatch-intelligence.service.js");
    const start = svc.createTimeZoneDate("2026-06-15", 0, tz);
    expect(svc.getNextTimeZoneDayStart("2026-06-15", tz).getTime() - start.getTime()).toBe(24 * HOUR);
    expect(svc.addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(svc.addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(svc.addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
