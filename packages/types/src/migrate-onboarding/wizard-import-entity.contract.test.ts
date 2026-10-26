import { describe, expect, it } from "vitest";

import { migrateOnboardingFileRefSchema } from "./v1/schemas.js";
import {
  assertRelationalPreviewKindMatchesWizardEntity,
  assertWizardEntitySupportedByGoldenBundle,
  listPipelineOnlyGoldenEntityTypes,
  WIZARD_V1_IMPORT_ENTITY_CONTRACT_ID,
  WIZARD_V1_IMPORT_ENTITY_TYPES
} from "./wizard-import-entity.contract.js";

describe(`${WIZARD_V1_IMPORT_ENTITY_CONTRACT_ID}`, () => {
  it("ships customers, properties, jobs, estimates, and price_book on the wizard", () => {
    expect(WIZARD_V1_IMPORT_ENTITY_TYPES).toEqual([
      "customers",
      "properties",
      "jobs",
      "estimates",
      "price_book"
    ]);
  });

  it("maps every wizard entity into golden bundle entity types", () => {
    for (const entity of WIZARD_V1_IMPORT_ENTITY_TYPES) {
      assertWizardEntitySupportedByGoldenBundle(entity);
      if (entity === "price_book") {
        continue;
      }
      expect(assertRelationalPreviewKindMatchesWizardEntity(entity)).toBe(entity);
    }
  });

  it("rejects pipeline-only golden entities on wizard file refs", () => {
    const pipelineOnly = listPipelineOnlyGoldenEntityTypes();
    expect(pipelineOnly).toContain("invoices");
    expect(pipelineOnly).toContain("payments");
    expect(pipelineOnly).toContain("vip_membership_tiers");
    expect(pipelineOnly).toContain("vip_memberships");

    for (const entityType of pipelineOnly) {
      const result = migrateOnboardingFileRefSchema.safeParse({
        importSessionId: "11111111-1111-4111-8111-111111111111",
        entityType,
        fileName: "export.csv"
      });
      expect(result.success).toBe(false);
    }
  });

  it("accepts wizard file refs for each shipped entity type", () => {
    for (const entityType of WIZARD_V1_IMPORT_ENTITY_TYPES) {
      const parsed = migrateOnboardingFileRefSchema.parse({
        importSessionId: "11111111-1111-4111-8111-111111111111",
        entityType,
        fileName: `${entityType}.csv`
      });
      expect(parsed.entityType).toBe(entityType);
    }
  });
});
