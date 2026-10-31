import { randomUUID } from "node:crypto";

import { beforeAll, describe, expect, it } from "vitest";

import { AppError, ErrorCode } from "@fsm/types";

import { setupTestEnv } from "../test-support/env-setup.js";

const STUB_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/fsm";
const preservedDatabaseUrl = process.env.DATABASE_URL;

setupTestEnv();

const postgresIntegrationEnabled =
  typeof preservedDatabaseUrl === "string" &&
  preservedDatabaseUrl.startsWith("postgres") &&
  preservedDatabaseUrl !== STUB_DATABASE_URL;

describe.runIf(postgresIntegrationEnabled)("getJobSourceReportingSummary (Postgres)", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = preservedDatabaseUrl;
  });

  it("runs COALESCE period filters for 365- and 366-day in-cap ranges", async () => {
    const { getJobSourceReportingSummary } = await import("./job-source-reporting.service.js");
    const companyId = randomUUID();
    const timeZone = "America/Chicago";

    const summary365 = await getJobSourceReportingSummary(companyId, timeZone, {
      startDate: "2024-01-01",
      endDate: "2024-12-31"
    });

    expect(summary365.totals.bookedJobCount).toBe(0);
    expect(summary365.period.dateInterpretation).toBe("company_local_days");

    const summary366 = await getJobSourceReportingSummary(companyId, timeZone, {
      startDate: "2025-01-01",
      endDate: "2025-12-31"
    });

    expect(summary366.totals.bookedJobCount).toBe(0);
  });

  it("returns VALIDATION_ERROR before querying when the range exceeds 366 days", async () => {
    const { getJobSourceReportingSummary } = await import("./job-source-reporting.service.js");
    const companyId = randomUUID();

    await expect(
      getJobSourceReportingSummary(companyId, "America/Chicago", {
        startDate: "2024-01-01",
        endDate: "2025-01-01"
      })
    ).rejects.toSatisfy((error: unknown) => {
      return error instanceof AppError && error.code === ErrorCode.VALIDATION_ERROR;
    });
  });

  it("runs the direct-demand query (lead_attribution jsonb + paid invoices) for an empty tenant", async () => {
    const { getDirectDemandSummary } = await import("./job-source-reporting.service.js");

    const summary = await getDirectDemandSummary(randomUUID(), "America/Chicago", {
      startDate: "2024-01-01",
      endDate: "2024-12-31"
    });

    expect(summary.totals).toEqual({ jobCount: 0, paidRevenue: "0.00" });
    expect(summary.sources).toEqual([]);
  });
});
