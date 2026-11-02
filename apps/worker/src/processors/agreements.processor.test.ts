import type { Job } from "bullmq";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../../api/src/test-support/env-setup.js";

setupTestEnv();

vi.mock("@fsm/jobs", () => ({
  notificationsQueue: {
    add: vi.fn()
  }
}));

type AgreementsProcessorModule = typeof import("./agreements.processor.js");

let agreementsProcessor: AgreementsProcessorModule;

beforeAll(async () => {
  agreementsProcessor = await import("./agreements.processor.js");
});

function createJob(name: string, data: Record<string, unknown>): Job<Record<string, unknown>> {
  return {
    id: `job-${name}`,
    name,
    data
  } as unknown as Job<Record<string, unknown>>;
}

function createDependencies(): agreementsProcessor.AgreementsDependencies {
  return {
    loadPlan: vi.fn(async () => null),
    findAutomationRule: vi.fn(async () => null),
    findPendingMaintenanceDueRecommendation: vi.fn(async () => null),
    createMaintenanceDueRecommendation: vi.fn(async () => ({ id: "recommendation-1" })),
    emitRecommendationCreated: vi.fn(async () => undefined),
    enqueueRenewalReminder: vi.fn(async () => undefined)
  };
}

describe("agreements.processor", () => {
  let dependencies: agreementsProcessor.AgreementsDependencies;

  beforeEach(() => {
    dependencies = createDependencies();
  });

  it("service-agreement-renewal-check creates a maintenance_due recommendation and queues the renewal email", async () => {
    vi.mocked(dependencies.loadPlan).mockResolvedValue({
      id: "plan-1",
      companyId: "company-1",
      customerId: "customer-1",
      propertyId: "property-1",
      name: "Gold Plan",
      price: "299.00",
      status: "active",
      nextServiceDate: "2026-05-05",
      customer: {
        firstName: "Chris",
        lastName: "Pine",
        email: "customer@example.com"
      },
      company: {
        name: "Acme HVAC"
      },
      template: {
        name: "Gold Plan"
      }
    });
    vi.mocked(dependencies.findAutomationRule).mockImplementation(async (_companyId, ruleType) => {
      if (ruleType === "maintenance_due" || ruleType === "service_agreement_renewal") {
        return { companyId: "company-1" };
      }

      return null;
    });

    await agreementsProcessor.handleServiceAgreementRenewalCheck(
      createJob("service-agreement-renewal-check", {
        companyId: "company-1",
        planId: "plan-1"
      }),
      dependencies
    );

    expect(dependencies.createMaintenanceDueRecommendation).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "company-1",
        customerId: "customer-1",
        propertyId: "property-1",
        estimatedRevenue: "299.00"
      })
    );
    expect(dependencies.emitRecommendationCreated).toHaveBeenCalledWith({
      companyId: "company-1",
      recommendationId: "recommendation-1",
      customerId: "customer-1",
      summary: "AI recommendation created for Chris Pine"
    });
    expect(dependencies.enqueueRenewalReminder).toHaveBeenCalledWith({
      companyId: "company-1",
      maintenancePlanId: "plan-1"
    });
  });

  it("service-agreement-renewal-check discards cancelled plans", async () => {
    vi.mocked(dependencies.loadPlan).mockResolvedValue({
      id: "plan-1",
      companyId: "company-1",
      customerId: "customer-1",
      propertyId: null,
      name: "Gold Plan",
      price: "299.00",
      status: "cancelled",
      nextServiceDate: "2026-05-05",
      customer: {
        firstName: "Chris",
        lastName: "Pine",
        email: "customer@example.com"
      },
      company: {
        name: "Acme HVAC"
      },
      template: {
        name: "Gold Plan"
      }
    });

    await agreementsProcessor.handleServiceAgreementRenewalCheck(
      createJob("service-agreement-renewal-check", {
        companyId: "company-1",
        planId: "plan-1"
      }),
      dependencies
    );

    expect(dependencies.createMaintenanceDueRecommendation).not.toHaveBeenCalled();
    expect(dependencies.enqueueRenewalReminder).not.toHaveBeenCalled();
  });
});

describe("plan-reminder-scan cron job", () => {
  it("runs the plan reminder scan", async () => {
    const deps = createDependencies();
    const scanPlanReminders = vi.fn(async () => ({ companies: 1, dispatched: 2 }));
    deps.scanPlanReminders = scanPlanReminders;
    const processor = agreementsProcessor.createAgreementsProcessor(deps);
    await processor(createJob(agreementsProcessor.PLAN_REMINDER_SCAN_JOB_NAME, {}) as never);
    expect(scanPlanReminders).toHaveBeenCalledTimes(1);
  });
});
