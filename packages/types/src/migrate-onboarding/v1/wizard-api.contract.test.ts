import { describe, expect, it } from "vitest";

import {
  MIGRATE_ONBOARDING_WIZARD_API_CONTRACT_ID,
  MIGRATE_ONBOARDING_WIZARD_API_ROUTES,
  migrateOnboardingWizardRequestSchemas,
  migrateOnboardingWizardResponseSchemas
} from "./wizard-api.contract.js";
import { MIGRATE_ONBOARDING_SOURCE_CATALOG } from "./source-catalog.js";

const companyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const bundleId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const userId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const importSessionId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

describe(`${MIGRATE_ONBOARDING_WIZARD_API_CONTRACT_ID}`, () => {
  it("declares wizard routes with unique method+path pairs", () => {
    expect(MIGRATE_ONBOARDING_WIZARD_API_ROUTES).toHaveLength(21);
    const keys = MIGRATE_ONBOARDING_WIZARD_API_ROUTES.map((route) => `${route.method} ${route.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("parses catalog entries returned by GET /sources", () => {
    for (const entry of MIGRATE_ONBOARDING_SOURCE_CATALOG) {
      const parsed = migrateOnboardingWizardResponseSchemas.migrateOnboardingSourceCatalogEntry.parse(entry);
      expect(parsed.id).toBe(entry.id);
    }
  });

  it("parses session create body and bundle response for POST /sessions", () => {
    migrateOnboardingWizardRequestSchemas.createMigrateOnboardingSessionBody.parse({
      resumeActive: true
    });

    const bundle = migrateOnboardingWizardResponseSchemas.migrateOnboardingBundle.parse({
      id: bundleId,
      companyId,
      createdById: userId,
      status: "active",
      wizardStep: 1,
      stepState: { files: [] },
      dedupeDecisions: {},
      createdAt: "2026-10-23T12:00:00.000Z",
      updatedAt: "2026-10-23T12:00:00.000Z",
      completedAt: null,
      abandonedAt: null
    });

    expect(bundle.wizardStep).toBe(1);
  });

  it("parses step-2 link files body with wizard entity types only", () => {
    const body = migrateOnboardingWizardRequestSchemas.linkMigrateOnboardingFilesBody.parse({
      files: [
        {
          importSessionId,
          entityType: "customers",
          fileName: "clients.csv"
        },
        {
          importSessionId,
          entityType: "properties",
          fileName: "locations.csv",
          label: "Sites"
        }
      ]
    });

    expect(body.files).toHaveLength(2);
  });

  it("parses dedupe preview and relational preview responses", () => {
    migrateOnboardingWizardResponseSchemas.migrateDedupePreviewResponse.parse({
      bundleId,
      collisions: [],
      unresolvedCount: 0,
      totalDuplicateRows: 0
    });

    migrateOnboardingWizardResponseSchemas.migrateRelationalPreviewResponse.parse({
      bundleId,
      files: [
        {
          importSessionId,
          kind: "customers",
          fileName: "clients.csv"
        }
      ],
      graph: {
        customers: [],
        properties: [],
        jobs: [],
        estimates: [],
        edges: [],
        propertyJobEdges: [],
        jobEstimateEdges: [],
        orphanPropertyCount: 0,
        orphanJobCount: 0,
        orphanEstimateCount: 0,
        unmatchedCustomerKeys: [],
        unmatchedPropertyKeys: [],
        unmatchedJobKeys: [],
        historyDepth: [],
        joinIssues: [],
        stats: {
          customerCount: 0,
          propertyCount: 0,
          jobCount: 0,
          estimateCount: 0,
          linkedPropertyCount: 0,
          linkedJobCount: 0,
          linkedEstimateCount: 0
        }
      }
    });
  });

  it("parses commit response for POST /commit", () => {
    migrateOnboardingWizardResponseSchemas.migrateOnboardingCommitResponse.parse({
      bundleId,
      status: "committing",
      importSessionIds: [importSessionId],
      startedAt: "2026-10-23T12:00:00.000Z"
    });
  });
});
