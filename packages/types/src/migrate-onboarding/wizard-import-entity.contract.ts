import { z } from "zod";

import { goldenBundleEntityTypeSchema } from "../fs-migrate/golden-bundle-manifest.js";
import { importEntityTypeSchema, type WizardImportEntityType } from "./import-entity-bridge.js";

export const WIZARD_V1_IMPORT_ENTITY_CONTRACT_ID = "fsm.migrate-onboarding.wizard-import-entity.v1";

/** Shipped wizard upload slots (step 2 file linking). */
export const WIZARD_V1_IMPORT_ENTITY_TYPES = importEntityTypeSchema.options;

export type WizardV1ImportEntityType = WizardImportEntityType;

/**
 * Golden-bundle entity slots used by FS-MIGRATE pipeline fixtures (epic §3).
 * Wizard v1 accepts only the relational core subset; remaining slots are pipeline-only.
 */
export const GOLDEN_BUNDLE_PIPELINE_ENTITY_TYPES = goldenBundleEntityTypeSchema.options;

const relationalPreviewFileKindSchema = z.enum(["customers", "properties", "jobs", "estimates"]);

export const WIZARD_RELATIONAL_PREVIEW_FILE_KINDS = relationalPreviewFileKindSchema.options;

export function isWizardV1ImportEntityType(value: string): value is WizardV1ImportEntityType {
  return importEntityTypeSchema.safeParse(value).success;
}

const WIZARD_TO_GOLDEN_BUNDLE_ENTITY: Record<WizardV1ImportEntityType, z.infer<typeof goldenBundleEntityTypeSchema>> =
  {
    customers: "customers",
    properties: "properties",
    jobs: "jobs",
    estimates: "estimates",
    price_book: "products"
  };

export function mapWizardEntityToGoldenBundleEntity(
  entity: WizardV1ImportEntityType
): z.infer<typeof goldenBundleEntityTypeSchema> {
  return WIZARD_TO_GOLDEN_BUNDLE_ENTITY[entity];
}

export function assertWizardEntitySupportedByGoldenBundle(entity: WizardV1ImportEntityType): void {
  goldenBundleEntityTypeSchema.parse(mapWizardEntityToGoldenBundleEntity(entity));
}

export function assertRelationalPreviewKindMatchesWizardEntity(
  entity: WizardV1ImportEntityType
): z.infer<typeof relationalPreviewFileKindSchema> {
  return relationalPreviewFileKindSchema.parse(entity);
}

export function isWizardRelationalPreviewEntity(entity: WizardV1ImportEntityType): boolean {
  return relationalPreviewFileKindSchema.safeParse(entity).success;
}

/** Entity types present in golden bundles but not yet linkable in wizard step 2. */
export function listPipelineOnlyGoldenEntityTypes(): string[] {
  const wizardSet = new Set<string>(WIZARD_V1_IMPORT_ENTITY_TYPES);
  return GOLDEN_BUNDLE_PIPELINE_ENTITY_TYPES.filter((entity) => !wizardSet.has(entity));
}
