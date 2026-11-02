import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const { crewCheck } = vi.hoisted(() => ({ crewCheck: vi.fn(async () => undefined) }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

vi.mock("@fsm/jobs", () => ({
  aiQueue: { add: vi.fn() },
  redisConnection: { get: vi.fn(async () => null), set: vi.fn(async () => "OK"), del: vi.fn(async () => 1) }
}));

vi.mock("./crews/crews.service.js", () => ({ assertActiveCrewInTransaction: crewCheck }));

let jobService: typeof import("./job.service.js");
let preview: typeof import("./job-create-preview.service.js");
let chargePreview: typeof import("../lib/charge-preview.js");
let fakeDb: typeof import("../test-support/fake-db.js");

beforeAll(async () => {
  jobService = await import("./job.service.js");
  preview = await import("./job-create-preview.service.js");
  chargePreview = await import("../lib/charge-preview.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  crewCheck.mockClear();
});

function seedTenant(planTier: "flex" | "flat" | null) {
  const company = fakeDb.seedCompany({ name: "Preview Co", slug: `preview-${planTier ?? "none"}` });
  if (planTier) {
    company.settings = { stripePlatformBilling: { planTier } } as typeof company.settings;
  }
  const actor = fakeDb.seedUser({ companyId: company.id, email: "ops@example.com", firstName: "Op", lastName: "Er", role: "admin" });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Chris", lastName: "Pine" });
  const service = fakeDb.seedProductCatalog({ companyId: company.id, name: "Tune-up", unitPrice: "150.00" } as never);
  return { company, actor, customer, service };
}

describe("charge preview (checkout fee rules)", () => {
  it("adds a 2% Service Fee on Flex and none on Flat; no booking fee", () => {
    expect(chargePreview.buildChargePreview({ settings: { stripePlatformBilling: { planTier: "flex" } } }, "200.00")).toMatchObject({
      subtotal: "200.00",
      serviceFeeAmount: "4.00",
      serviceFeeRateBps: 200,
      total: "204.00"
    });
    expect(chargePreview.buildChargePreview({ settings: { stripePlatformBilling: { planTier: "flat" } } }, "200.00")).toMatchObject({
      serviceFeeAmount: "0.00",
      serviceFeeLabel: null,
      total: "200.00"
    });
  });
});

describe("POST /jobs/preview (service)", () => {
  it("prices catalog + manual lines, previews the job number and card-on-file", async () => {
    const { company, customer, service } = seedTenant("flex");
    customer.stripeCustomerId = "cus_test_preview";

    const result = await preview.previewJobCreate(company.id, {
      customerId: customer.id,
      products: [{ productCatalogId: service.id, quantity: 2 }, { name: "Filter", unitPrice: 20, quantity: 1 }]
    });

    expect(result.jobNumberPreview).toBe("JOB-0001");
    expect(result.lines.map((line) => line.total)).toEqual(["300.00", "20.00"]);
    expect(result).toMatchObject({ subtotal: "320.00", serviceFeeAmount: "6.40", total: "326.40", cardOnFile: true });
  });

  it("refuses another tenant's customer", async () => {
    const a = seedTenant("flat");
    const other = fakeDb.seedCompany({ name: "Other", slug: "other-co" });
    const stranger = fakeDb.seedCustomer({ companyId: other.id, firstName: "X", lastName: "Y" });

    await expect(preview.previewJobCreate(a.company.id, { customerId: stranger.id })).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });
});

describe("createJob with line items and crew", () => {
  it("adds products in the create transaction and sets the crew", async () => {
    const { company, actor, customer, service } = seedTenant("flex");
    const crewId = "11111111-1111-4111-8111-111111111111";

    const job = await jobService.createJob(company.id, actor.id, {
      customerId: customer.id,
      title: "Tune-up visit",
      crewId,
      products: [{ productCatalogId: service.id, quantity: 1 }]
    });

    expect(crewCheck).toHaveBeenCalledWith(expect.anything(), company.id, crewId);
    const products = fakeDb.getTestState().jobProducts.filter((row) => row.jobId === job.id);
    expect(products.map((row) => row.total)).toEqual(["150.00"]);
  });

  it("creates nothing when a line item references another tenant's catalog item", async () => {
    const { company, actor, customer } = seedTenant("flex");
    const other = fakeDb.seedCompany({ name: "Other", slug: "other-cat" });
    const foreign = fakeDb.seedProductCatalog({ companyId: other.id, name: "Foreign", unitPrice: "10.00" } as never);

    await expect(
      jobService.createJob(company.id, actor.id, {
        customerId: customer.id,
        title: "Bad item",
        products: [{ productCatalogId: foreign.id, quantity: 1 }]
      })
    ).rejects.toMatchObject({ code: ErrorCode.NOT_FOUND });
    expect(fakeDb.getTestState().jobs.filter((row) => row.companyId === company.id)).toHaveLength(0);
  });
});
