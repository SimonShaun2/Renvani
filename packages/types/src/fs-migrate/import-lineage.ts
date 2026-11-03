import { IMPORT_SOURCE_SYSTEM_IDS, type ImportSourceSystemId } from "../import-price-book.js";
import type { MigrateSourceSystemId } from "../migrate-onboarding/v1/schemas.js";

/** Maps onboarding wizard preset ids to lineage `source_system` column values (ADR-FS-MIGRATE §1). */
export const MIGRATE_ONBOARDING_TO_LINEAGE_SOURCE_SYSTEM: Record<
  MigrateSourceSystemId,
  ImportSourceSystemId
> = {
  service_fusion: "service_fusion",
  jobber: "jobber",
  servicetitan: "service_titan",
  housecall_pro: "housecall_pro",
  qbo: "qbo",
  qbd: "qbd",
  manual_csv: "manual_csv"
};

export function toLineageSourceSystem(sourceSystem: MigrateSourceSystemId): ImportSourceSystemId {
  return MIGRATE_ONBOARDING_TO_LINEAGE_SOURCE_SYSTEM[sourceSystem];
}

export function isRegisteredLineageSourceSystem(value: string): value is ImportSourceSystemId {
  return (IMPORT_SOURCE_SYSTEM_IDS as readonly string[]).includes(value);
}

/** Tenant-scoped uniqueness key for imported rows (ADR §1). */
export function buildImportLineageUniqueKey(
  companyId: string,
  sourceSystem: string,
  sourceId: string,
  entityType: string
): string {
  return `${companyId}:${sourceSystem}:${sourceId}:${entityType}`;
}
