import { z } from "zod";

export const FS_MIGRATE_IMPORT_PIPELINE_CONTRACT_ID = "fsm.fs-migrate.import-pipeline.v1";

const uuidSchema = z.string().uuid();

export const tenantScopedImportJobBaseSchema = z.object({
  companyId: uuidSchema,
  importSessionId: uuidSchema
});

export type TenantScopedImportJobBase = z.infer<typeof tenantScopedImportJobBaseSchema>;

export function assertImportJobTenantScope(
  payload: TenantScopedImportJobBase,
  expectedCompanyId: string
): void {
  if (payload.companyId !== expectedCompanyId) {
    throw new Error("Import job payload companyId does not match expected tenant scope");
  }
}

export function assertImportBundleIdMatchesSession(
  job: { companyId: string; importBundleId?: string | undefined },
  bundle: { companyId: string; id: string }
): void {
  if (job.companyId !== bundle.companyId) {
    throw new Error("Import bundle companyId does not match job tenant scope");
  }

  if (job.importBundleId !== undefined && job.importBundleId !== bundle.id) {
    throw new Error("Import job importBundleId does not match onboarding bundle");
  }
}
