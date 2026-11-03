import { beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

const featureFlagState = vi.hoisted(() => ({
  growthCheckPublicScan: true
}));

vi.mock("@fsm/config/feature-flags", () => ({
  featureFlags: {
    get growthCheckPublicScan() {
      return featureFlagState.growthCheckPublicScan;
    }
  }
}));

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  growthQueueAdd: vi.fn(),
  values: vi.fn(),
  getCompanyTrade: vi.fn()
}));

vi.mock("./company-trade.service.js", () => ({
  getCompanyTrade: mocks.getCompanyTrade
}));

vi.mock("@fsm/db", () => ({
  db: {
    query: {
      growthCheckScans: {
        findFirst: mocks.findFirst
      }
    },
    insert: mocks.insert,
    select: mocks.select,
    update: vi.fn()
  },
  emitEvent: vi.fn(),
  growthCheckScans: {},
  growthCheckFindings: {}
}));

vi.mock("@fsm/jobs", () => ({
  growthQueue: {
    add: mocks.growthQueueAdd
  }
}));

vi.mock("../lib/growth-check/enqueue-rate-limit.js", () => ({
  checkGrowthCheckEnqueueRateLimits: vi.fn(async () => ({ allowed: true, scope: null }))
}));

import { enqueueGrowthCheckPublicScan } from "./growth-check.service.js";

describe("growth-check.service", () => {
  beforeEach(() => {
    featureFlagState.growthCheckPublicScan = true;
    vi.clearAllMocks();
    mocks.findFirst.mockResolvedValue(null);
    mocks.getCompanyTrade.mockResolvedValue({ trade: null, label: null, schemaType: null, tradeDescription: null });
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockImplementation((row: { rubricId: string; rubricVersion: string }) => ({
      returning: vi.fn(async () => [
        {
          id: "scan-new",
          companyId: "company-1",
          targetUrl: "https://example-hvac.com/",
          rubricId: row.rubricId,
          rubricVersion: row.rubricVersion,
          status: "queued",
          progress: {},
          idempotencyKey: "idem-new-123",
          failureReason: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])
    }));
    mocks.growthQueueAdd.mockResolvedValue(undefined);
    mocks.select.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(async () => [])
      }))
    });
  });

  it("returns existing scan for duplicate idempotency key", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "scan-existing",
      companyId: "company-1",
      targetUrl: "https://example-cleaning.com",
      rubricId: "residential-cleaning",
      rubricVersion: "1.0.0",
      status: "queued",
      progress: {},
      idempotencyKey: "idem-12345678",
      failureReason: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const result = await enqueueGrowthCheckPublicScan("company-1", "user-1", {
      targetUrl: "https://example-cleaning.com",
      idempotencyKey: "idem-12345678"
    });

    expect(result.id).toBe("scan-existing");
    expect(mocks.growthQueueAdd).not.toHaveBeenCalled();
  });

  it("rejects disallowed target hosts", async () => {
    await expect(
      enqueueGrowthCheckPublicScan("company-1", "user-1", {
        targetUrl: "http://127.0.0.1"
      })
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it("blocks enqueue when feature flag is off", async () => {
    featureFlagState.growthCheckPublicScan = false;

    await expect(
      enqueueGrowthCheckPublicScan("company-1", "user-1", {
        targetUrl: "https://example-cleaning.com"
      })
    ).rejects.toMatchObject({ code: ErrorCode.FORBIDDEN });
  });

  it("defaults a new scan to the home-services rubric and records id + version", async () => {
    const result = await enqueueGrowthCheckPublicScan("company-1", "user-1", { targetUrl: "https://example-hvac.com" });

    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ rubricId: "home-services", rubricVersion: "1.0.0" }));
    expect(result.rubricId).toBe("home-services");
    expect(mocks.growthQueueAdd).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ rubricId: "home-services", rubricVersion: "1.0.0" }),
      expect.anything()
    );
  });

  it.each(["hvac", "plumbing", "electrical", "other"])("selects the home-services rubric for trade %s", async (trade) => {
    mocks.getCompanyTrade.mockResolvedValue({ trade, label: null, schemaType: null, tradeDescription: null });
    await enqueueGrowthCheckPublicScan("company-1", "user-1", { targetUrl: "https://example-hvac.com" });
    expect(mocks.getCompanyTrade).toHaveBeenCalledWith("company-1");
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ rubricId: "home-services" }));
  });

  it("falls back to home-services when the trade cannot be read", async () => {
    mocks.getCompanyTrade.mockRejectedValue(new Error("company lookup failed"));
    await enqueueGrowthCheckPublicScan("company-1", "user-1", { targetUrl: "https://example-hvac.com" });
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ rubricId: "home-services" }));
  });

  it("still honours an explicit legacy rubric id", async () => {
    await enqueueGrowthCheckPublicScan("company-1", "user-1", {
      targetUrl: "https://example-hvac.com",
      rubricId: "residential-cleaning"
    });
    expect(mocks.getCompanyTrade).not.toHaveBeenCalled();
    expect(mocks.values).toHaveBeenCalledWith(expect.objectContaining({ rubricId: "residential-cleaning" }));
  });

  it("rejects an unknown rubric id without inserting", async () => {
    await expect(
      enqueueGrowthCheckPublicScan("company-1", "user-1", { targetUrl: "https://example-hvac.com", rubricId: "not-a-rubric" })
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_ERROR });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns a stored scan with the legacy rubric unchanged", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "scan-old",
      companyId: "company-1",
      targetUrl: "https://example-hvac.com/",
      rubricId: "residential-cleaning",
      rubricVersion: "1.0.0",
      status: "completed",
      progress: {},
      idempotencyKey: "idem-old-123",
      failureReason: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    const result = await enqueueGrowthCheckPublicScan("company-1", "user-1", {
      targetUrl: "https://example-hvac.com",
      idempotencyKey: "idem-old-123"
    });
    expect(result.rubricId).toBe("residential-cleaning");
    expect(result.rubricVersion).toBe("1.0.0");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
