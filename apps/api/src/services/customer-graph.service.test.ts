import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@fsm/types";
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

type CustomerServiceModule = typeof import("./customer.service.js");
type PropertyServiceModule = typeof import("./property.service.js");
type AssetServiceModule = typeof import("./asset.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let customerService: CustomerServiceModule;
let propertyService: PropertyServiceModule;
let assetService: AssetServiceModule;
let fakeDb: FakeDbModule;

beforeAll(async () => {
  customerService = await import("./customer.service.js");
  propertyService = await import("./property.service.js");
  assetService = await import("./asset.service.js");
  fakeDb = await import("../test-support/fake-db.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
});

function createGraphFixture() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac"
  });
  const actor = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@example.com",
    firstName: "Ava",
    lastName: "Stone",
    role: "owner"
  });
  const customer = fakeDb.seedCustomer({
    companyId: company.id,
    firstName: "Chris",
    lastName: "Pine",
    email: "chris@example.com",
    phone: "555-0100",
    tags: ["vip", "maintenance"],
    lifetimeValue: "4250.25",
    totalJobs: 3,
    lastServiceDate: "2026-03-01"
  });
  const property = fakeDb.seedProperty({
    companyId: company.id,
    customerId: customer.id,
    addressLine1: "101 Main St",
    city: "Tulsa",
    state: "OK",
    zip: "74103",
    isPrimary: true
  });
  const asset = fakeDb.seedAsset({
    companyId: company.id,
    customerId: customer.id,
    propertyId: property.id,
    name: "Main HVAC Unit",
    assetType: "hvac",
    lastServiceDate: "2026-03-01"
  });

  return { company, actor, customer, property, asset };
}

describe("customer.service", () => {
  it("listCustomers paginates and filters by search, tags, and active maintenance plan", async () => {
    const { company } = createGraphFixture();
    const inactiveCustomer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Mina",
      lastName: "Hart",
      tags: ["legacy"],
      totalJobs: 1
    });

    fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: inactiveCustomer.id,
      status: "paused"
    });
    fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: fakeDb.getTestState().customers[0]!.id,
      status: "active"
    });

    const result = await customerService.listCustomers(company.id, {
      search: "chris",
      tags: ["maintenance"],
      hasActiveMaintenancePlan: true,
      page: 1,
      limit: 10
    });

    expect(result.total).toBe(1);
    expect(result.data[0]?.firstName).toBe("Chris");
    expect(result.totalPages).toBe(1);
  });

  it("searchCustomers returns the first ten fuzzy matches", async () => {
    const { company } = createGraphFixture();

    for (let index = 0; index < 11; index += 1) {
      fakeDb.seedCustomer({
        companyId: company.id,
        firstName: `Sam ${index}`,
        lastName: "Search"
      });
    }

    const result = await customerService.searchCustomers(company.id, "sam");
    expect(result).toHaveLength(10);
  });

  it("getCustomer returns the nested property and asset graph", async () => {
    const { company, customer, property, asset } = createGraphFixture();

    const result = await customerService.getCustomer(company.id, customer.id);

    expect(result.properties).toHaveLength(1);
    expect(result.properties[0]?.id).toBe(property.id);
    expect(result.properties[0]?.assets[0]?.id).toBe(asset.id);
  });

  it("createCustomer creates a record with firstServiceDate null and emits an event", async () => {
    const { company, actor } = createGraphFixture();

    const result = await customerService.createCustomer(company.id, actor.id, {
      firstName: "Jordan",
      lastName: "Miles",
      email: "Jordan@example.com",
      tags: ["new"]
    });

    const state = fakeDb.getTestState();
    expect(result.email).toBe("jordan@example.com");
    expect(result.firstServiceDate).toBeNull();
    expect(state.activityEvents.at(-1)?.eventType).toBe("customer.created");
  });

  it("FS-281: createCustomer and updateCustomer store phones as E.164 (unrecognised input kept trimmed)", async () => {
    const { company, actor } = createGraphFixture();

    const created = await customerService.createCustomer(company.id, actor.id, {
      firstName: "Pat",
      lastName: "Lee",
      phone: " (555) 111-2222 ",
      altPhone: "1-555-333-4444"
    });
    expect(created.phone).toBe("+15551112222");
    expect(created.altPhone).toBe("+15553334444");

    const updated = await customerService.updateCustomer(company.id, actor.id, created.id, { phone: "555.999.8888" });
    expect(updated.phone).toBe("+15559998888");

    const unrecognised = await customerService.updateCustomer(company.id, actor.id, created.id, { phone: " ext 12 " });
    expect(unrecognised.phone).toBe("ext 12");
  });

  it("updateCustomer updates allowed fields and emits an event", async () => {
    const { company, actor, customer } = createGraphFixture();

    const result = await customerService.updateCustomer(company.id, actor.id, customer.id, {
      firstName: "Updated",
      doNotContact: true
    });

    const state = fakeDb.getTestState();
    expect(result.firstName).toBe("Updated");
    expect(result.doNotContact).toBe(true);
    expect(state.activityEvents.at(-1)?.eventType).toBe("customer.updated");
  });

  it("deleteCustomer soft deletes customer, properties, and assets in one transaction", async () => {
    const { company, actor, customer, property, asset } = createGraphFixture();

    await customerService.deleteCustomer(company.id, actor.id, customer.id);

    const state = fakeDb.getTestState();
    expect(state.customers.find((row) => row.id === customer.id)?.deletedAt).toBeInstanceOf(Date);
    expect(state.properties.find((row) => row.id === property.id)?.deletedAt).toBeInstanceOf(Date);
    expect(state.assets.find((row) => row.id === asset.id)?.deletedAt).toBeInstanceOf(Date);
    expect(state.activityEvents.map((event) => event.eventType)).toEqual([
      "asset.deleted",
      "property.deleted",
      "customer.deleted"
    ]);
  });

  it("returns NOT_FOUND for cross-tenant customer access", async () => {
    const { customer } = createGraphFixture();
    const otherCompany = fakeDb.seedCompany({
      name: "Other HVAC",
      slug: "other-hvac"
    });

    await expect(customerService.getCustomer(otherCompany.id, customer.id)).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });
});

describe("property.service", () => {
  it("listProperties and getProperty stay scoped to the customer chain", async () => {
    const { company, customer, property, asset } = createGraphFixture();

    const properties = await propertyService.listProperties(company.id, customer.id);
    const result = await propertyService.getProperty(company.id, customer.id, property.id);

    expect(properties).toHaveLength(1);
    expect(result.assets[0]?.id).toBe(asset.id);
  });

  it("createProperty unsets other primary properties and emits an event", async () => {
    const { company, actor, customer } = createGraphFixture();

    const result = await propertyService.createProperty(company.id, actor.id, customer.id, {
      addressLine1: "202 Second St",
      city: "Tulsa",
      state: "OK",
      zip: "74104",
      isPrimary: true
    });

    const state = fakeDb.getTestState();
    const primaryProperties = state.properties.filter((row) => row.customerId === customer.id && row.isPrimary);
    expect(result.isPrimary).toBe(true);
    expect(primaryProperties).toHaveLength(1);
    expect(state.activityEvents.at(-1)?.eventType).toBe("property.created");
  });

  it("updateProperty can atomically promote a property to primary", async () => {
    const { company, actor, customer } = createGraphFixture();
    const secondProperty = fakeDb.seedProperty({
      companyId: company.id,
      customerId: customer.id,
      addressLine1: "303 Third St",
      city: "Tulsa",
      state: "OK",
      zip: "74105",
      isPrimary: false
    });

    const result = await propertyService.updateProperty(
      company.id,
      actor.id,
      customer.id,
      secondProperty.id,
      {
        isPrimary: true
      }
    );

    const state = fakeDb.getTestState();
    const primaryProperties = state.properties.filter((row) => row.customerId === customer.id && row.isPrimary);
    expect(result.isPrimary).toBe(true);
    expect(primaryProperties).toHaveLength(1);
    expect(primaryProperties[0]?.id).toBe(secondProperty.id);
  });

  it("deleteProperty soft deletes its assets and emits delete events", async () => {
    const { company, actor, customer, property, asset } = createGraphFixture();

    await propertyService.deleteProperty(company.id, actor.id, customer.id, property.id);

    const state = fakeDb.getTestState();
    expect(state.properties.find((row) => row.id === property.id)?.deletedAt).toBeInstanceOf(Date);
    expect(state.assets.find((row) => row.id === asset.id)?.deletedAt).toBeInstanceOf(Date);
    expect(state.activityEvents.map((event) => event.eventType)).toEqual([
      "asset.deleted",
      "property.deleted"
    ]);
  });
});

describe("asset.service", () => {
  it("listAssets and getAsset return only active property assets and include job count", async () => {
    const { company, customer, property, asset } = createGraphFixture();
    fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      assetId: asset.id
    });
    fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      assetId: asset.id
    });

    const assets = await assetService.listAssets(company.id, customer.id, property.id);
    const result = await assetService.getAsset(company.id, customer.id, property.id, asset.id);

    expect(assets).toHaveLength(1);
    expect(result.jobCount).toBe(2);
  });

  it("createAsset adds the asset under the property and emits an event", async () => {
    const { company, actor, customer, property } = createGraphFixture();

    const result = await assetService.createAsset(company.id, actor.id, customer.id, property.id, {
      name: "Water Heater",
      assetType: "water_heater"
    });

    expect(result.assetType).toBe("water_heater");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("asset.created");
  });

  it("updateAsset recalculates nextServiceDate from an active maintenance plan and emits serviced", async () => {
    const { company, actor, customer, property, asset } = createGraphFixture();
    fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      assetIds: [asset.id],
      frequency: "quarterly",
      status: "active"
    });

    const result = await assetService.updateAsset(
      company.id,
      actor.id,
      customer.id,
      property.id,
      asset.id,
      {
        lastServiceDate: "2026-04-10"
      }
    );

    expect(result.nextServiceDate).toBe("2026-07-10");
    expect(fakeDb.getTestState().activityEvents.map((event) => event.eventType)).toEqual([
      "asset.updated",
      "asset.serviced"
    ]);
  });

  it("deleteAsset soft deletes the asset and preserves the chain", async () => {
    const { company, actor, customer, property, asset } = createGraphFixture();

    await assetService.deleteAsset(company.id, actor.id, customer.id, property.id, asset.id);

    const state = fakeDb.getTestState();
    expect(state.assets.find((row) => row.id === asset.id)?.deletedAt).toBeInstanceOf(Date);
    expect(state.activityEvents.at(-1)?.eventType).toBe("asset.deleted");
  });
});
