import { beforeEach, describe, expect, it, vi } from "vitest";

const company = vi.hoisted(() => ({ settings: {} as Record<string, unknown> }));
const companyMocks = vi.hoisted(() => ({
  getCompany: vi.fn(async (id: string) => ({ id, settings: company.settings })),
  updateCompany: vi.fn(async (id: string, _actor: string, input: { settings: Record<string, unknown> }) => {
    company.settings = { ...company.settings, ...input.settings };
    return { id, settings: company.settings };
  })
}));
vi.mock("../company.service.js", () => companyMocks);

import {
  DISABLED_GBP_PROVIDER_ID,
  disabledGbpProvider,
  getGbpProvider,
  listGbpProviderIds,
  registerGbpProvider
} from "./gbp-provider.registry.js";
import { getGbpStatus, readGbp, setGbpOptIn } from "./gbp.service.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

beforeEach(() => {
  company.settings = {};
  vi.clearAllMocks();
});

describe("GBP provider registry", () => {
  it("registers the disabled adapter by default", () => {
    expect(listGbpProviderIds()).toContain(DISABLED_GBP_PROVIDER_ID);
    expect(getGbpProvider("disabled")).toBe(disabledGbpProvider);
  });

  it("stays disabled with no GBP keys in env (absent keys never fail boot)", async () => {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("GOOGLE_BUSINESS_PROFILE_")) delete process.env[key];
    }
    vi.resetModules();
    const registry = await import("./gbp-provider.registry.js");
    expect(registry.activeGbpProviderId()).toBe("disabled");
    expect(registry.listGbpProviderIds()).toEqual(["disabled"]);
  });

  it("rejects invalid ids and unknown providers with a handled error", () => {
    expect(() => registerGbpProvider({ ...disabledGbpProvider, id: "Bad-Id" })).toThrow();
    expect(() => getGbpProvider("nope")).toThrow(/GBP_PROVIDER_UNKNOWN/);
  });

  it("disabled stub returns typed not_configured for every read without network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const expected = { status: "not_configured", provider: "disabled", reason: "adapter_disabled" };
    expect(await disabledGbpProvider.getProfile(companyId)).toEqual(expected);
    expect(await disabledGbpProvider.getHours(companyId)).toEqual(expected);
    expect(await disabledGbpProvider.listServices(companyId)).toEqual(expected);
    expect(await disabledGbpProvider.listReviews(companyId)).toEqual(expected);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("GBP opt-in service", () => {
  it("defaults to not opted in and reports the disabled adapter", async () => {
    expect(await getGbpStatus(companyId)).toEqual({ optIn: false, provider: "disabled", configured: false, updatedAt: null });
  });

  it("persists opt-in in company settings JSON and keeps other settings", async () => {
    company.settings = { tradingName: "Acme" };
    const now = new Date("2026-10-30T05:00:00.000Z");
    const status = await setGbpOptIn(companyId, "u1", true, now);
    expect(companyMocks.updateCompany).toHaveBeenCalledWith(companyId, "u1", {
      settings: { googleBusinessProfile: { optIn: true, updatedAt: now.toISOString() } }
    });
    expect(company.settings).toMatchObject({ tradingName: "Acme" });
    expect(status).toMatchObject({ optIn: true, updatedAt: now.toISOString() });
  });

  it("does not reach the adapter until opted in, then returns not_configured", async () => {
    expect(await readGbp(companyId, "reviews")).toEqual({ status: "not_opted_in", provider: "disabled" });
    company.settings = { googleBusinessProfile: { optIn: true } };
    expect(await readGbp(companyId, "hours")).toMatchObject({ status: "not_configured" });
  });
});
