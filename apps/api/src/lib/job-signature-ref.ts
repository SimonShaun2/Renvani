import { LegacyJobSignatureUrlSchema } from "@fsm/types";

import { createSignedDownloadUrl, getFileKeyFromUrl, getMediaSignedUrlTtlSeconds } from "./storage.js";

/**
 * Job signatures captured from an attachment are stored in the existing
 * `jobs.signature_url` text column as an internal reference to the permanent
 * object key (no schema change). Reads re-sign it into a short-lived URL.
 * Legacy values (full URLs saved before this change) are returned unchanged.
 */
export const JOB_SIGNATURE_OBJECT_REF_PREFIX = "renvani-object:";

export function toJobSignatureObjectRef(objectKey: string): string {
  return `${JOB_SIGNATURE_OBJECT_REF_PREFIX}${objectKey}`;
}

export function isJobSignatureObjectRef(value: string | null | undefined): value is string {
  return typeof value === "string" && value.startsWith(JOB_SIGNATURE_OBJECT_REF_PREFIX);
}

/** Object key for an attachment's stored file reference, or null when unresolvable / outside the tenant. */
export function resolveTenantAttachmentObjectKey(companyId: string, fileUrl: string): string | null {
  try {
    const objectKey = getFileKeyFromUrl(fileUrl);
    return objectKey.startsWith(`attachments/${companyId}/`) ? objectKey : null;
  } catch {
    return null;
  }
}

/** Freshly signed URL for a stored signature value. Fails closed (null), never returns a raw key. */
export async function resolveJobSignatureUrl(
  companyId: string,
  stored: string | null | undefined
): Promise<string | null> {
  if (!stored) {
    return null;
  }
  if (!isJobSignatureObjectRef(stored)) {
    return LegacyJobSignatureUrlSchema.safeParse(stored).success ? stored : null;
  }
  const objectKey = stored.slice(JOB_SIGNATURE_OBJECT_REF_PREFIX.length);
  if (!objectKey.startsWith(`attachments/${companyId}/`)) {
    return null;
  }
  try {
    const signed = await createSignedDownloadUrl(objectKey, getMediaSignedUrlTtlSeconds());
    return signed.url;
  } catch {
    return null;
  }
}

/** Returns a copy of the job with `signatureUrl` re-signed for API responses. */
export async function withSignedJobSignature<T extends { companyId: string; signatureUrl: string | null }>(
  job: T
): Promise<T> {
  return { ...job, signatureUrl: await resolveJobSignatureUrl(job.companyId, job.signatureUrl) };
}
