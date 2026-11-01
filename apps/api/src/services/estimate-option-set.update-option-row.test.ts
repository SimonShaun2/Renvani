/**
 * #374 review nit: updateOptionRow scopes its guarded write by company + tierGroupId + estimateId, so the guard
 * stands alone (it cannot touch an estimate in another option set even with the same optionSetVersion).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});
vi.mock("@fsm/db", async () => {
  const helper = await import("../test-support/fake-db.js");
  return helper.createDbModuleMock();
});
vi.mock("@fsm/jobs", () => ({ aiQueue: { add: vi.fn() }, notificationsQueue: { add: vi.fn() } }));

let fakeDb: typeof import("../test-support/fake-db.js");
let service: typeof import("./estimate-option-set.service.js");

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  service = await import("./estimate-option-set.service.js");
});
beforeEach(() => fakeDb.resetTestState());

const GROUP_A = "00000000-0000-4000-8000-00000000000a";
const GROUP_B = "00000000-0000-4000-8000-00000000000b";

function seed() {
  const company = fakeDb.seedCompany({ name: "Northside", slug: "northside-uor" });
  const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "Casey", lastName: "Client" });
  const inA = fakeDb.seedEstimate({ companyId: company.id, customerId: customer.id, tierGroupId: GROUP_A, tierLabel: "Good", optionSetVersion: 1 } as never);
  const inB = fakeDb.seedEstimate({ companyId: company.id, customerId: customer.id, tierGroupId: GROUP_B, tierLabel: "Best", optionSetVersion: 1 } as never);
  return { company, inA, inB };
}

const row = (id: string) => fakeDb.getTestState().estimates.find((e) => e.id === id)! as unknown as Record<string, unknown>;

describe("updateOptionRow (company + tierGroupId + estimateId guard)", () => {
  it("updates the estimate when it belongs to the named option set at the expected version", async () => {
    const { company, inA } = seed();
    const { db } = await import("@fsm/db");
    await service.updateOptionRow(db as never, company.id, GROUP_A, inA.id, 1, { tierLabel: "Better" });
    expect(row(inA.id).tierLabel).toBe("Better");
  });

  it("refuses (409 stale_version) an estimate from another option set even at the same version, and leaves it unchanged", async () => {
    const { company, inB } = seed();
    const { db } = await import("@fsm/db");
    await expect(service.updateOptionRow(db as never, company.id, GROUP_A, inB.id, 1, { tierLabel: "Hijacked" })).rejects.toThrow(
      "Option set changed since it was loaded"
    );
    expect(row(inB.id).tierLabel).toBe("Best");
  });

  it("refuses a stale version within the right set", async () => {
    const { company, inA } = seed();
    const { db } = await import("@fsm/db");
    await expect(service.updateOptionRow(db as never, company.id, GROUP_A, inA.id, 2, { tierLabel: "Better" })).rejects.toThrow(
      "Option set changed since it was loaded"
    );
    expect(row(inA.id).tierLabel).toBe("Good");
  });
});
