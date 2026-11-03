import { describe, expect, it } from "vitest";

import {
  buildImportBundleObjectKey,
  buildImportBundleObjectKeyPrefix
} from "@fsm/config/import-bundle-storage";

import {
  normalizeImportPhone,
  normalizeImportSourceId
} from "@fsm/import-normalize";

import {
  MigrateFileBatchJobDataSchema,
  buildMigrateFileBatchIdempotencyKey
} from "./import-queue-jobs.js";
import {
  buildImportLineageUniqueKey,
  isRegisteredLineageSourceSystem,
  toLineageSourceSystem
} from "./import-lineage.js";
import {
  assertImportBundleIdMatchesSession,
  assertImportJobTenantScope,
  tenantScopedImportJobBaseSchema
} from "./import-pipeline.contract.js";
import { MIGRATE_ONBOARDING_SOURCE_CATALOG } from "../migrate-onboarding/v1/source-catalog.js";
import { migrateOnboardingBundleSchema } from "../migrate-onboarding/v1/schemas.js";

describe("FS-128 FS-MIGRATE import bundle + normalize pipeline contracts", () => {
  const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const otherCompanyId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const importSessionId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const importBundleId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  it("maps every onboarding source catalog id to a registered lineage source_system", () => {
    for (const entry of MIGRATE_ONBOARDING_SOURCE_CATALOG) {
      const lineageId = toLineageSourceSystem(entry.id);
      expect(isRegisteredLineageSourceSystem(lineageId)).toBe(true);
    }
  });

  it("builds tenant-scoped R2 keys for bundle media (FS-85 / epic §3)", () => {
    const prefix = buildImportBundleObjectKeyPrefix(companyId, importBundleId);
    expect(prefix).toBe(`${companyId}/imports/${importBundleId}/`);
    expect(buildImportBundleObjectKey(companyId, importBundleId, "media/a.jpg")).toBe(
      `${prefix}media/a.jpg`
    );
    expect(buildImportBundleObjectKey(otherCompanyId, importBundleId, "media/a.jpg")).not.toContain(
      companyId
    );
  });

  it("requires companyId on migrate-file-batch jobs and stable idempotency keys", () => {
    const idempotencyKey = buildMigrateFileBatchIdempotencyKey(importSessionId, 0);
    const payload = MigrateFileBatchJobDataSchema.parse({
      companyId,
      importSessionId,
      importBundleId,
      sourceSystem: "service_fusion",
      batchIndex: 0,
      batchesTotal: 1,
      idempotencyKey,
      objects: [{ vendorFileId: "f-1", relativePath: "media/f-1.jpg" }]
    });

    assertImportJobTenantScope(payload, companyId);
    expect(idempotencyKey).toBe(`${importSessionId}:migrate-file-batch:0`);
    expect(() => assertImportJobTenantScope(payload, otherCompanyId)).toThrow(/tenant scope/);
  });

  it("parses onboarding bundle responses with companyId for multi-tenant assertions", () => {
    const bundle = migrateOnboardingBundleSchema.parse({
      id: importBundleId,
      companyId,
      createdById: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      status: "active",
      wizardStep: 2,
      stepState: { sourceSystem: "jobber", files: [] },
      dedupeDecisions: {},
      createdAt: "2026-10-23T12:00:00.000Z",
      updatedAt: "2026-10-23T12:00:00.000Z",
      completedAt: null,
      abandonedAt: null
    });

    const job = {
      companyId,
      importBundleId: bundle.id,
      importSessionId
    };
    assertImportBundleIdMatchesSession(job, bundle);
    expect(() =>
      assertImportBundleIdMatchesSession({ companyId: otherCompanyId, importBundleId: bundle.id }, bundle)
    ).toThrow(/tenant scope/);
  });

  it("aligns normalize output with lineage unique keys scoped by companyId", () => {
    const sourceId = normalizeImportSourceId("  JOB-9001 ");
    expect(sourceId).toBe("JOB-9001");
    const lineageKey = buildImportLineageUniqueKey(companyId, "jobber", sourceId ?? "", "jobs");
    expect(lineageKey).toBe(`${companyId}:jobber:JOB-9001:jobs`);

    const phone = normalizeImportPhone("(512) 555-0100");
    const phoneKey = buildImportLineageUniqueKey(companyId, "manual_csv", phone ?? "", "customers");
    expect(phoneKey).toContain(companyId);
  });

  it("validates tenant-scoped import job base schema", () => {
    const parsed = tenantScopedImportJobBaseSchema.parse({
      companyId,
      importSessionId
    });
    expect(parsed.companyId).toBe(companyId);
  });
});
