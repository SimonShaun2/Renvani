import {
  assertImportBundleObjectKeyBelongsToTenant,
  buildImportBundleObjectKey
} from "@fsm/config/import-bundle-storage";
import type { MigrateFileBatchJobData, MigrateFileBatchObject } from "@fsm/types";

export async function processMigrateFileBatchObject(
  object: MigrateFileBatchObject,
  payload: MigrateFileBatchJobData
): Promise<void> {
  const objectKey =
    object.r2Key ??
    buildImportBundleObjectKey(payload.companyId, payload.importBundleId, object.relativePath);
  assertImportBundleObjectKeyBelongsToTenant(objectKey, payload.companyId, payload.importBundleId);
}
