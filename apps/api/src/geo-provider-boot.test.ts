import { resetEnvCacheForTests } from "@fsm/config";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "./test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => (await import("./test-support/fake-db.js")).createDrizzleModuleMock());
vi.mock("@fsm/db", async () => (await import("./test-support/fake-db.js")).createDbModuleMock());
vi.mock("@fsm/jobs", () => ({ notificationsQueue: { add: vi.fn(async () => undefined) }, redisConnection: { del: vi.fn(async () => 0) } }));

const { buildApp } = await import("./app.js");
const { registerGeoProvider, straightLineGeoProvider } = await import("./services/geo/geo-provider.registry.js");

describe("FS-198 follow-up: GEO_PROVIDER boot validation", () => {
  afterEach(() => {
    delete process.env.GEO_PROVIDER;
    resetEnvCacheForTests();
  });

  it("boots with the default straight_line provider", async () => {
    resetEnvCacheForTests();
    const app = await buildApp();
    await app.close();
  });

  it("fails fast with a clear message when GEO_PROVIDER is not registered", async () => {
    process.env.GEO_PROVIDER = "mapbox_unregistered";
    resetEnvCacheForTests();
    await expect(buildApp()).rejects.toThrow(/GEO_PROVIDER="mapbox_unregistered" is not a registered geo provider \(registered: .*straight_line/);
  });

  it("boots when GEO_PROVIDER names a custom provider registered before startup", async () => {
    registerGeoProvider({ ...straightLineGeoProvider, id: "custom_geo_boot" });
    process.env.GEO_PROVIDER = "custom_geo_boot";
    resetEnvCacheForTests();
    const app = await buildApp();
    await app.close();
  });
});
