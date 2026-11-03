import { randomUUID } from "node:crypto";

import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorCode, type UpdateAgreementInput } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

setupTestEnv();

const {
  addAiQueueJob,
  cancelServiceAgreementSubscriptionMock,
  createServiceAgreementPriceMock,
  createServiceAgreementSubscriptionMock,
  createStripeCustomerMock,
  updateServiceAgreementSubscriptionCancelAtPeriodEndMock
} = vi.hoisted(() => ({
  addAiQueueJob: vi.fn(),
  cancelServiceAgreementSubscriptionMock: vi.fn(),
  createServiceAgreementPriceMock: vi.fn(),
  createServiceAgreementSubscriptionMock: vi.fn(),
  createStripeCustomerMock: vi.fn(),
  updateServiceAgreementSubscriptionCancelAtPeriodEndMock: vi.fn()
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
    add: addAiQueueJob
  }
}));

vi.mock("../lib/stripe.js", async () => {
  const actual = await vi.importActual<typeof import("../lib/stripe.js")>("../lib/stripe.js");
  return {
    ...actual,
    cancelServiceAgreementSubscription: cancelServiceAgreementSubscriptionMock,
    createServiceAgreementPrice: createServiceAgreementPriceMock,
    createServiceAgreementSubscription: createServiceAgreementSubscriptionMock,
    createStripeCustomer: createStripeCustomerMock,
    updateServiceAgreementSubscriptionCancelAtPeriodEnd: updateServiceAgreementSubscriptionCancelAtPeriodEndMock
  };
});

type AgreementServiceModule = typeof import("./service-agreement.service.js");
type TemplateServiceModule = typeof import("./service-agreement-template.service.js");
type FakeDbModule = typeof import("../test-support/fake-db.js");

let agreementService: AgreementServiceModule;
let fakeDb: FakeDbModule;
let templateService: TemplateServiceModule;

beforeAll(async () => {
  agreementService = await import("./service-agreement.service.js");
  fakeDb = await import("../test-support/fake-db.js");
  templateService = await import("./service-agreement-template.service.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  addAiQueueJob.mockReset();
  cancelServiceAgreementSubscriptionMock.mockReset();
  createServiceAgreementPriceMock.mockReset();
  createServiceAgreementSubscriptionMock.mockReset();
  createStripeCustomerMock.mockReset();
  updateServiceAgreementSubscriptionCancelAtPeriodEndMock.mockReset();

  createStripeCustomerMock.mockResolvedValue({ id: "cus_123" });
  createServiceAgreementPriceMock.mockResolvedValue({ id: "price_platform_fee_123" });
  createServiceAgreementSubscriptionMock.mockResolvedValue({
    id: "sub_123",
    currentPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
    cancelAtPeriodEnd: false
  });
  updateServiceAgreementSubscriptionCancelAtPeriodEndMock.mockResolvedValue({
    id: "sub_123",
    currentPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
    cancelAtPeriodEnd: true
  });
  cancelServiceAgreementSubscriptionMock.mockResolvedValue({
    id: "sub_123",
    currentPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
    currentPeriodEnd: new Date("2026-04-28T00:00:00.000Z"),
    cancelAtPeriodEnd: false
  });
});

function createAdminContext() {
  const company = fakeDb.seedCompany({
    name: "Acme HVAC",
    slug: "acme-hvac",
    stripeAccountId: "acct_123"
  });
  const actor = fakeDb.seedUser({
    companyId: company.id,
    email: "owner@example.com",
    firstName: "Ava",
    lastName: "Stone",
    role: "owner"
  });

  return { company, actor };
}

function seedAgreementGraph(companyId: string) {
  const customer = fakeDb.seedCustomer({
    companyId,
    firstName: "Chris",
    lastName: "Pine",
    email: "chris@example.com"
  });
  const property = fakeDb.seedProperty({
    companyId,
    customerId: customer.id,
    addressLine1: "101 Main St",
    city: "Tulsa",
    state: "OK",
    zip: "74103"
  });
  const asset = fakeDb.seedAsset({
    companyId,
    customerId: customer.id,
    propertyId: property.id,
    name: "Main HVAC",
    assetType: "hvac"
  });
  const template = fakeDb.seedServiceAgreementTemplate({
    companyId,
    name: "Gold Plan",
    visitsPerYear: 2,
    frequency: "bi_annual",
    monthlyPrice: "29.99",
    annualPrice: "299.00",
    stripeMthlyPriceId: "price_monthly_123",
    stripeAnnualPriceId: "price_annual_123",
    includedServices: ["Tune-up"]
  });

  return { customer, property, asset, template };
}

describe("service-agreement.service", () => {
  it("createAgreement succeeds without billing", async () => {
    const { company, actor } = createAdminContext();
    const { customer, property, asset, template } = seedAgreementGraph(company.id);

    const agreement = await agreementService.createAgreement(company.id, actor.id, {
      customerId: customer.id,
      serviceAgreementTemplateId: template.id,
      propertyId: property.id,
      name: "Customer Gold Plan",
      frequency: "quarterly",
      startDate: "2026-04-28",
      assetIds: [asset.id]
    });

    expect(agreement.name).toBe("Customer Gold Plan");
    expect(agreement.stripeSubscriptionId).toBeNull();
    expect(agreement.nextServiceDate).toBe("2026-07-28");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("maintenance_plan.created");
  });

  it("createAgreement with billing creates a Stripe customer and subscription", async () => {
    const { company, actor } = createAdminContext();
    company.settings = { stripePlatformBilling: { planTier: "flex" } };
    const { customer, property, asset, template } = seedAgreementGraph(company.id);

    const agreement = await agreementService.createAgreement(company.id, actor.id, {
      customerId: customer.id,
      serviceAgreementTemplateId: template.id,
      propertyId: property.id,
      name: "Billed Plan",
      frequency: "bi_annual",
      startDate: "2026-04-28",
      billingEnabled: true,
      billingCycle: "monthly",
      assetIds: [asset.id]
    });

    expect(createStripeCustomerMock).toHaveBeenCalledWith({
      companyId: company.id,
      customerId: customer.id,
      email: customer.email,
      name: "Chris Pine"
    });
    expect(createServiceAgreementPriceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: company.id,
        templateId: template.id,
        productName: "Service Fee (2%)",
        amount: "0.60",
        interval: "month"
      })
    );
    expect(createServiceAgreementSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: company.id,
        planId: agreement.id,
        customerId: customer.id,
        stripeCustomerId: "cus_123",
        stripePriceId: "price_monthly_123",
        stripePlatformFeePriceId: "price_platform_fee_123",
        companyStripeAccountId: company.stripeAccountId ?? "",
        applicationFeePercent: 1.96
      })
    );
    expect(agreement.stripeSubscriptionId).toBe("sub_123");
    expect(agreement.stripePriceId).toBe("price_monthly_123");
    expect(agreement.price).toBe("29.99");
    expect(fakeDb.getTestState().customers.find((row) => row.id === customer.id)?.stripeCustomerId).toBe("cus_123");
  });

  it("createAgreement on Flat sends no Service Fee line and no application fee", async () => {
    const { company, actor } = createAdminContext();
    company.settings = { stripePlatformBilling: { planTier: "flat" } };
    const { customer, property, asset, template } = seedAgreementGraph(company.id);

    await agreementService.createAgreement(company.id, actor.id, {
      customerId: customer.id,
      serviceAgreementTemplateId: template.id,
      propertyId: property.id,
      name: "Flat Plan",
      frequency: "bi_annual",
      startDate: "2026-04-28",
      billingEnabled: true,
      billingCycle: "monthly",
      assetIds: [asset.id]
    });

    expect(createServiceAgreementPriceMock).not.toHaveBeenCalled();
    expect(createServiceAgreementSubscriptionMock).toHaveBeenCalledWith(
      expect.objectContaining({ stripePlatformFeePriceId: null, applicationFeePercent: null })
    );
  });

  it("createAgreement throws NOT_FOUND for cross-tenant customers", async () => {
    const { company, actor } = createAdminContext();
    const otherCompany = fakeDb.seedCompany({
      name: "Other HVAC",
      slug: "other-hvac"
    });
    const otherCustomer = fakeDb.seedCustomer({
      companyId: otherCompany.id,
      firstName: "Other",
      lastName: "Customer"
    });

    await expect(
      agreementService.createAgreement(company.id, actor.id, {
        customerId: otherCustomer.id,
        name: "Cross Tenant Plan",
        frequency: "quarterly",
        startDate: "2026-04-28"
      })
    ).rejects.toMatchObject({
      code: ErrorCode.NOT_FOUND
    });
  });

  it("createAgreement throws CONFLICT when an asset does not belong to the property", async () => {
    const { company, actor } = createAdminContext();
    const { customer, property } = seedAgreementGraph(company.id);
    const otherProperty = fakeDb.seedProperty({
      companyId: company.id,
      customerId: customer.id,
      addressLine1: "202 Elm St",
      city: "Tulsa",
      state: "OK",
      zip: "74104"
    });
    const otherAsset = fakeDb.seedAsset({
      companyId: company.id,
      customerId: customer.id,
      propertyId: otherProperty.id,
      name: "Other Unit",
      assetType: "hvac"
    });

    await expect(
      agreementService.createAgreement(company.id, actor.id, {
        customerId: customer.id,
        propertyId: property.id,
        name: "Mismatch Plan",
        frequency: "quarterly",
        startDate: "2026-04-28",
        assetIds: [otherAsset.id]
      })
    ).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });

  it("cancelAgreement immediately cancels the Stripe subscription", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedAgreementGraph(company.id);
    const agreement = fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      name: "Immediate Cancel Plan",
      frequency: "quarterly",
      status: "active",
      stripeSubscriptionId: "sub_123"
    });

    const cancelled = await agreementService.cancelAgreement(company.id, actor.id, agreement.id, {
      cancelImmediately: true,
      reason: "Requested"
    });

    expect(cancelServiceAgreementSubscriptionMock).toHaveBeenCalledWith("sub_123");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.endDate).toBe("2026-04-28");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("maintenance_plan.cancelled");
  });

  it("cancelAgreement at period end sets cancel_at_period_end and enqueues AI only when the rule is enabled", async () => {
    const { company, actor } = createAdminContext();
    const { customer } = seedAgreementGraph(company.id);
    const noRuleAgreement = fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      name: "No Rule Plan",
      frequency: "quarterly",
      status: "active",
      stripeSubscriptionId: "sub_123"
    });

    const noRuleCancelled = await agreementService.cancelAgreement(company.id, actor.id, noRuleAgreement.id, {});

    expect(updateServiceAgreementSubscriptionCancelAtPeriodEndMock).toHaveBeenCalledWith("sub_123", true);
    expect(noRuleCancelled.status).toBe("active");
    expect(noRuleCancelled.stripeCancelAtPeriodEnd).toBe(true);
    expect(addAiQueueJob).not.toHaveBeenCalled();

    const ruleAgreement = fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      name: "Rule Plan",
      frequency: "quarterly",
      status: "active",
      stripeSubscriptionId: "sub_456"
    });
    fakeDb.seedAutomationRule({
      companyId: company.id,
      ruleType: "service_agreement_renewal",
      isEnabled: true
    });
    updateServiceAgreementSubscriptionCancelAtPeriodEndMock.mockResolvedValueOnce({
      id: "sub_456",
      currentPeriodStart: new Date("2026-04-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-05-01T00:00:00.000Z"),
      cancelAtPeriodEnd: true
    });

    await agreementService.cancelAgreement(company.id, actor.id, ruleAgreement.id, {
      cancelImmediately: false
    });

    expect(addAiQueueJob).toHaveBeenCalledWith(
      "evaluate-revenue-opportunities",
      {
        companyId: company.id,
        planId: ruleAgreement.id,
        customerId: customer.id,
        trigger: "plan.cancelled"
      },
      {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000
        }
      }
    );
  });

  it("recordVisit updates plan and asset service dates", async () => {
    const { company, actor } = createAdminContext();
    const { customer, property, asset } = seedAgreementGraph(company.id);
    const agreement = fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      name: "Visit Plan",
      frequency: "quarterly",
      status: "active",
      assetIds: [asset.id]
    });
    const job = fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      assetId: asset.id,
      title: "Maintenance Visit"
    });

    const visit = await agreementService.recordVisit(company.id, actor.id, agreement.id, {
      completedDate: "2026-04-28",
      jobId: job.id,
      notes: "Completed successfully"
    });

    expect(visit.completedDate).toBe("2026-04-28");
    expect(fakeDb.getTestState().maintenancePlans.find((row) => row.id === agreement.id)?.lastServiceDate).toBe("2026-04-28");
    expect(fakeDb.getTestState().maintenancePlans.find((row) => row.id === agreement.id)?.nextServiceDate).toBe("2026-07-28");
    expect(fakeDb.getTestState().assets.find((row) => row.id === asset.id)?.lastServiceDate).toBe("2026-04-28");
    expect(fakeDb.getTestState().assets.find((row) => row.id === asset.id)?.nextServiceDate).toBe("2026-07-28");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("maintenance_visit.completed");
  });

  it("computeNextServiceDate returns the correct date for all supported frequencies", () => {
    const baseDate = new Date("2026-01-15T00:00:00.000Z");

    expect(agreementService.computeNextServiceDate(baseDate, "monthly").toISOString().slice(0, 10)).toBe("2026-02-15");
    expect(agreementService.computeNextServiceDate(baseDate, "bi_monthly").toISOString().slice(0, 10)).toBe("2026-03-15");
    expect(agreementService.computeNextServiceDate(baseDate, "quarterly").toISOString().slice(0, 10)).toBe("2026-04-15");
    expect(agreementService.computeNextServiceDate(baseDate, "bi_annual").toISOString().slice(0, 10)).toBe("2026-07-15");
    expect(agreementService.computeNextServiceDate(baseDate, "annual").toISOString().slice(0, 10)).toBe("2027-01-15");
  });

  it("getAgreement returns detail and listVisits orders newest first", async () => {
    const { company } = createAdminContext();
    const { customer, property, asset, template } = seedAgreementGraph(company.id);
    const agreement = fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      serviceAgreementTemplateId: template.id,
      name: "Detail Plan",
      frequency: "quarterly",
      assetIds: [asset.id],
      nextServiceDate: "2026-07-28",
      lastServiceDate: "2026-04-28"
    });
    fakeDb.seedMaintenanceVisit({
      companyId: company.id,
      maintenancePlanId: agreement.id,
      completedDate: "2026-03-01",
      notes: "First"
    });
    fakeDb.seedMaintenanceVisit({
      companyId: company.id,
      maintenancePlanId: agreement.id,
      completedDate: "2026-04-15",
      notes: "Second"
    });

    const detail = await agreementService.getAgreement(company.id, agreement.id);
    const visits = await agreementService.listVisits(company.id, agreement.id);

    expect(detail.customer.email).toBe("chris@example.com");
    expect(detail.property?.addressLine1).toBe("101 Main St");
    expect(detail.template?.name).toBe("Gold Plan");
    expect(detail.assets).toHaveLength(1);
    expect(detail.recentVisits[0]?.completedDate).toBe("2026-04-15");
    expect(visits[0]?.completedDate).toBe("2026-04-15");
    expect(visits[1]?.completedDate).toBe("2026-03-01");
  });

  it("listAgreements paginates and filters by status and customer", async () => {
    const { company } = createAdminContext();
    const { customer } = seedAgreementGraph(company.id);
    const otherCustomer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Jamie",
      lastName: "Miles"
    });
    fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      name: "Alpha Plan",
      frequency: "quarterly",
      status: "active",
      nextServiceDate: "2026-05-01",
      createdAt: new Date("2026-04-20T00:00:00.000Z")
    });
    fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: otherCustomer.id,
      name: "Bravo Plan",
      frequency: "annual",
      status: "paused",
      nextServiceDate: "2026-06-01",
      createdAt: new Date("2026-04-21T00:00:00.000Z")
    });

    const result = await agreementService.listAgreements(company.id, {
      status: "active",
      customerId: customer.id,
      page: 1,
      limit: 10
    });

    expect(result.total).toBe(1);
    expect(result.data[0]?.name).toBe("Alpha Plan");
  });

  it("updateAgreement updates allowed fields only", async () => {
    const { company, actor } = createAdminContext();
    const { customer, property, asset } = seedAgreementGraph(company.id);
    const replacementAsset = fakeDb.seedAsset({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      name: "Replacement HVAC",
      assetType: "hvac"
    });
    const agreement = fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      propertyId: property.id,
      name: "Starter Plan",
      description: "Original description",
      notes: "Original notes",
      frequency: "quarterly",
      status: "active",
      assetIds: [asset.id],
      price: "29.99",
      billingCycle: "monthly",
      nextServiceDate: "2026-07-28"
    });

    const updated = await agreementService.updateAgreement(
      company.id,
      actor.id,
      agreement.id,
      {
        name: "Updated Plan",
        description: "Updated description",
        notes: "Updated notes",
        frequency: "bi_annual",
        nextServiceDate: "2026-10-28",
        assetIds: [replacementAsset.id],
        status: "cancelled"
      } as UpdateAgreementInput & { status: string }
    );

    expect(updated.name).toBe("Updated Plan");
    expect(updated.description).toBe("Updated description");
    expect(updated.notes).toBe("Updated notes");
    expect(updated.frequency).toBe("bi_annual");
    expect(updated.nextServiceDate).toBe("2026-10-28");
    expect(updated.assetIds).toEqual([replacementAsset.id]);
    expect(updated.status).toBe("active");
    expect(updated.price).toBe("29.99");
    expect(updated.billingCycle).toBe("monthly");
    expect(fakeDb.getTestState().activityEvents.at(-1)?.eventType).toBe("maintenance_plan.updated");
  });

  it("deleteTemplate throws CONFLICT when active plans exist", async () => {
    const { company, actor } = createAdminContext();
    const { customer, template } = seedAgreementGraph(company.id);
    fakeDb.seedMaintenancePlan({
      companyId: company.id,
      customerId: customer.id,
      serviceAgreementTemplateId: template.id,
      name: "Protected Plan",
      frequency: "quarterly",
      status: "active"
    });

    await expect(templateService.deleteTemplate(company.id, actor.id, template.id)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT
    });
  });
});
