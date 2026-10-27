import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { FS_MIGRATE_RLS_POLICY_CATALOG } from "./rls-policy-catalog.js";

const neonCiUrl = process.env.NEON_CI_DATABASE_URL?.trim();
const postgresIntegrationEnabled =
  typeof neonCiUrl === "string" && neonCiUrl.startsWith("postgres");

const RLS_MATRIX_TABLES = FS_MIGRATE_RLS_POLICY_CATALOG.map((policy) => policy.table);

describe("STACK-10 RLS Neon CI matrix (catalog coverage)", () => {
  it("integration suite exercises every catalog table", () => {
    expect(RLS_MATRIX_TABLES).toEqual(
      ["customers", "import_sessions", "jobs"].sort((a, b) => a.localeCompare(b))
    );
  });
});

describe.runIf(postgresIntegrationEnabled)("STACK-10 RLS policies (Postgres / Neon CI)", () => {
  beforeAll(() => {
    process.env.DATABASE_URL = neonCiUrl;
    process.env.BOOKING_HOLD_TOKEN_SECRET =
      process.env.BOOKING_HOLD_TOKEN_SECRET ?? "booking_hold_test_secret";
  });

  it("denies cross-tenant reads on customers when session GUC is set", async () => {
    const { db } = await import("./client.js");
    const { customers } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");

    const companyA = randomUUID();
    const companyB = randomUUID();
    const customerA = randomUUID();
    const customerB = randomUUID();

    await db.insert(customers).values([
      {
        id: customerA,
        companyId: companyA,
        firstName: "Tenant",
        lastName: "A",
        email: `a-${companyA.slice(0, 8)}@rls.test`
      },
      {
        id: customerB,
        companyId: companyB,
        firstName: "Tenant",
        lastName: "B",
        email: `b-${companyB.slice(0, 8)}@rls.test`
      }
    ]);

    const visibleForA = await runTransactionWithTenantSession(companyA, async (tx) => {
      return tx.select({ id: customers.id }).from(customers);
    });

    const idsForA = visibleForA.map((row) => row.id);
    expect(idsForA).toContain(customerA);
    expect(idsForA).not.toContain(customerB);

    await runTransactionWithTenantSession(companyA, async (tx) => {
      await tx.delete(customers).where(eq(customers.id, customerA));
    });
    await runTransactionWithTenantSession(companyB, async (tx) => {
      await tx.delete(customers).where(eq(customers.id, customerB));
    });
  });

  it("denies cross-tenant reads on import_sessions when session GUC is set", async () => {
    const { db } = await import("./client.js");
    const { importSessions } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");

    const companyA = randomUUID();
    const companyB = randomUUID();
    const sessionA = randomUUID();
    const sessionB = randomUUID();

    await db.insert(importSessions).values([
      {
        id: sessionA,
        companyId: companyA,
        entityType: "customers",
        fileName: "a.csv",
        fileUrl: "https://example.test/a.csv"
      },
      {
        id: sessionB,
        companyId: companyB,
        entityType: "customers",
        fileName: "b.csv",
        fileUrl: "https://example.test/b.csv"
      }
    ]);

    const visibleForA = await runTransactionWithTenantSession(companyA, async (tx) => {
      return tx.select({ id: importSessions.id }).from(importSessions);
    });

    const idsForA = visibleForA.map((row) => row.id);
    expect(idsForA).toContain(sessionA);
    expect(idsForA).not.toContain(sessionB);

    await runTransactionWithTenantSession(companyA, async (tx) => {
      await tx.delete(importSessions).where(eq(importSessions.id, sessionA));
    });
    await runTransactionWithTenantSession(companyB, async (tx) => {
      await tx.delete(importSessions).where(eq(importSessions.id, sessionB));
    });
  });

  it("denies cross-tenant reads on jobs when session GUC is set", async () => {
    const { db } = await import("./client.js");
    const { customers, jobs } = await import("./schema.js");
    const { runTransactionWithTenantSession } = await import("./run-with-tenant-session.js");

    const companyA = randomUUID();
    const companyB = randomUUID();
    const customerA = randomUUID();
    const customerB = randomUUID();
    const jobA = randomUUID();
    const jobB = randomUUID();

    await db.insert(customers).values([
      {
        id: customerA,
        companyId: companyA,
        firstName: "Job",
        lastName: "A",
        email: `job-a-${companyA.slice(0, 8)}@rls.test`
      },
      {
        id: customerB,
        companyId: companyB,
        firstName: "Job",
        lastName: "B",
        email: `job-b-${companyB.slice(0, 8)}@rls.test`
      }
    ]);

    await db.insert(jobs).values([
      {
        id: jobA,
        companyId: companyA,
        customerId: customerA,
        jobNumber: `RLS-A-${jobA.slice(0, 8)}`,
        title: "RLS job A"
      },
      {
        id: jobB,
        companyId: companyB,
        customerId: customerB,
        jobNumber: `RLS-B-${jobB.slice(0, 8)}`,
        title: "RLS job B"
      }
    ]);

    const visibleForA = await runTransactionWithTenantSession(companyA, async (tx) => {
      return tx.select({ id: jobs.id }).from(jobs);
    });

    const idsForA = visibleForA.map((row) => row.id);
    expect(idsForA).toContain(jobA);
    expect(idsForA).not.toContain(jobB);

    await runTransactionWithTenantSession(companyA, async (tx) => {
      await tx.delete(jobs).where(eq(jobs.id, jobA));
      await tx.delete(customers).where(eq(customers.id, customerA));
    });
    await runTransactionWithTenantSession(companyB, async (tx) => {
      await tx.delete(jobs).where(eq(jobs.id, jobB));
      await tx.delete(customers).where(eq(customers.id, customerB));
    });
  });
});
