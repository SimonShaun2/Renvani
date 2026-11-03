const IMPORT_BUNDLE_SEGMENT = "imports";

/**
 * FS-MIGRATE / FS-85: tenant-scoped R2 keys for onboarding media bundles.
 * Pattern: `{companyId}/imports/{bundleId}/…`
 */
export function buildImportBundleObjectKeyPrefix(companyId: string, importBundleId: string): string {
  return `${companyId}/${IMPORT_BUNDLE_SEGMENT}/${importBundleId}/`;
}

export function buildImportBundleObjectKey(
  companyId: string,
  importBundleId: string,
  relativePath: string
): string {
  const sanitizedRelativePath = sanitizeImportBundleRelativePath(relativePath);
  return `${buildImportBundleObjectKeyPrefix(companyId, importBundleId)}${sanitizedRelativePath}`;
}

export function assertImportBundleObjectKeyBelongsToTenant(
  objectKey: string,
  companyId: string,
  importBundleId?: string
): void {
  const tenantImportsPrefix = `${companyId}/${IMPORT_BUNDLE_SEGMENT}/`;
  if (!objectKey.startsWith(tenantImportsPrefix)) {
    throw new Error("Import bundle object key is outside tenant scope");
  }

  if (importBundleId !== undefined) {
    const bundlePrefix = buildImportBundleObjectKeyPrefix(companyId, importBundleId);
    if (!objectKey.startsWith(bundlePrefix)) {
      throw new Error("Import bundle object key is outside bundle scope");
    }
  }
}

export function sanitizeImportBundleRelativePath(relativePath: string): string {
  const normalized = relativePath.replaceAll("\\", "/").trim();
  if (normalized.length === 0) {
    throw new Error("Import bundle relative path is required");
  }

  const segments = normalized
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== ".");

  if (segments.length === 0) {
    throw new Error("Import bundle relative path is required");
  }

  for (const segment of segments) {
    if (segment === "..") {
      throw new Error("Import bundle relative path must not contain parent directory segments");
    }
  }

  return segments.join("/");
}
