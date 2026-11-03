import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GOLDEN_IMPORT_BUNDLE_MANIFESTS } from "@fsm/config/import-golden-bundles";
import { AppError, ErrorCode } from "@fsm/types";

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

type FakeDbModule = typeof import("../test-support/fake-db.js");

let fakeDb: FakeDbModule;
let listCustomerHistoryTimeline: typeof import("./customer-history-timeline.service.js").listCustomerHistoryTimeline;

beforeAll(async () => {
  fakeDb = await import("../test-support/fake-db.js");
  ({ listCustomerHistoryTimeline } = await import("./customer-history-timeline.service.js"));
});

beforeEach(() => {
  fakeDb.resetTestState();
});

describe("customer-history-timeline.service", () => {
  it("denies cross-tenant access", async () => {
    const companyA = fakeDb.seedCompany({ name: "Tenant A", slug: "tenant-a" });
    const companyB = fakeDb.seedCompany({ name: "Tenant B", slug: "tenant-b" });
    const customer = fakeDb.seedCustomer({
      companyId: companyB.id,
      firstName: "Other",
      lastName: "Tenant"
    });

    await expect(
      listCustomerHistoryTimeline(companyA.id, customer.id, { limit: 10 })
    ).rejects.toBeInstanceOf(AppError);
  });

  it("filters by timeline item type", async () => {
    const company = fakeDb.seedCompany({ name: "Filter Co", slug: "filter-co" });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Filter",
      lastName: "Customer"
    });

    fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "Tune-up"
    });
    fakeDb.seedEstimate({
      companyId: company.id,
      customerId: customer.id,
      title: "Replacement quote"
    });

    const response = await listCustomerHistoryTimeline(company.id, customer.id, {
      limit: 25,
      types: "job"
    });

    expect(response.items).toHaveLength(1);
    expect(response.items[0]?.type).toBe("job");
  });

  it("paginates with cursor across multi-year imported and native jobs", async () => {
    const company = fakeDb.seedCompany({ name: "History Co", slug: "history-co" });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Deep",
      lastName: "History"
    });
    const importSession = fakeDb.seedImportSession({
      companyId: company.id,
      fileName: "jobs.csv",
      fileUrl: "https://r2.test/jobs.csv",
      entityType: "jobs"
    });

    fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "2019 furnace",
      actualEnd: new Date("2019-06-01T12:00:00.000Z"),
      importSessionId: importSession.id
    });
    fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "2024 AC",
      actualEnd: new Date("2024-08-15T12:00:00.000Z")
    });
    fakeDb.seedJob({
      companyId: company.id,
      customerId: customer.id,
      title: "2025 maintenance",
      actualEnd: new Date("2025-01-10T12:00:00.000Z"),
      importSessionId: importSession.id
    });

    const firstPage = await listCustomerHistoryTimeline(company.id, customer.id, {
      limit: 2,
      types: "job"
    });
    expect(firstPage.items).toHaveLength(2);
    expect(firstPage.items[0]?.title).toContain("2025");
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await listCustomerHistoryTimeline(company.id, customer.id, {
      limit: 2,
      types: "job",
      cursor: firstPage.nextCursor ?? undefined
    });
    expect(secondPage.items.length).toBeGreaterThanOrEqual(1);
    expect(secondPage.items.some((item) => item.title.includes("2019"))).toBe(true);
    expect(
      secondPage.items.every(
        (item) => item.occurredAt <= (firstPage.items[firstPage.items.length - 1]?.occurredAt ?? "")
      )
    ).toBe(true);
  });

  it("rejects an unknown types value with a validation (400) error", async () => {
    const company = fakeDb.seedCompany({ name: "Types Co", slug: "types-co" });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Types",
      lastName: "Customer"
    });

    const error = await listCustomerHistoryTimeline(company.id, customer.id, {
      limit: 10,
      types: "job,bogus"
    }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe(ErrorCode.VALIDATION_ERROR);
  });

  it("pages newest-first through every row across sources with same-timestamp ties", async () => {
    const company = fakeDb.seedCompany({ name: "Big Co", slug: "big-co" });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Big",
      lastName: "History"
    });
    const expectedIds = new Set<string>();
    const shared = new Date("2023-03-03T03:03:03.003Z");
    // Seed in scrambled order so insertion order cannot mask missing ORDER BY.
    for (const index of [7, 2, 11, 0, 5, 9, 3, 10, 1, 8, 4, 6]) {
      const job = fakeDb.seedJob({
        companyId: company.id,
        customerId: customer.id,
        title: `Job ${index}`,
        actualEnd: index % 4 === 0 ? shared : new Date(Date.UTC(2015 + index, 0, 1))
      });
      expectedIds.add(job.id);
      const estimate = fakeDb.seedEstimate({
        companyId: company.id,
        customerId: customer.id,
        title: `Estimate ${index}`,
        approvedAt: index % 3 === 0 ? shared : new Date(Date.UTC(2014 + index, 6, 1))
      });
      expectedIds.add(estimate.id);
    }

    const firstPage = await listCustomerHistoryTimeline(company.id, customer.id, { limit: 5, types: "job,estimate" });
    expect(firstPage.items[0]?.occurredAt).toBe(new Date(Date.UTC(2026, 0, 1)).toISOString());

    const seen: Array<{ occurredAt: string; type: string; id: string }> = [...firstPage.items];
    let cursor = firstPage.nextCursor;
    let guard = 0;
    while (cursor && guard < 20) {
      const page = await listCustomerHistoryTimeline(company.id, customer.id, {
        limit: 5,
        types: "job,estimate",
        cursor
      });
      expect(page.items.length).toBeLessThanOrEqual(5);
      seen.push(...page.items);
      cursor = page.nextCursor;
      guard += 1;
    }

    expect(seen).toHaveLength(expectedIds.size);
    expect(new Set(seen.map((item) => item.id))).toEqual(expectedIds);
    for (let index = 1; index < seen.length; index += 1) {
      const previous = seen[index - 1]!;
      const current = seen[index]!;
      const key = (item: typeof current) => `${item.occurredAt}|${item.type}|${item.id}`;
      expect(key(previous) > key(current)).toBe(true);
    }
  });

  it("golden import bundles declare multi-year job history depth", () => {
    const serviceFusion = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((manifest) =>
      manifest.fixtureId.startsWith("service_fusion")
    );
    expect(serviceFusion?.requiredHistorySpanYears).toBeGreaterThanOrEqual(2);
    const jobFile = serviceFusion?.files.find((file) => file.entityType === "jobs");
    expect(jobFile?.businessDateColumn).toBeTruthy();
  });
});
