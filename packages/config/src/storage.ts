import { storageEnv as env } from "./runtime-env.js";
import { getObjectStorageProvider } from "./object-storage/index.js";
import { R2ObjectStorageProvider } from "./object-storage/r2-provider.js";
import type { SignedObjectUrl } from "./object-storage/types.js";

export function getMediaSignedUrlTtlSeconds(): number {
  return env.MEDIA_SIGNED_URL_TTL_SECONDS;
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<{ url: string; key: string }> {
  const stored = await getObjectStorageProvider().putObject(key, buffer, contentType);
  return {
    url: stored.reference,
    key: stored.objectKey
  };
}

export async function downloadFile(key: string): Promise<Buffer> {
  const provider = getObjectStorageProvider();
  if (!(provider instanceof R2ObjectStorageProvider)) {
    throw new Error("downloadFile is only supported for the R2 object storage provider");
  }

  return provider.downloadObject(key);
}

export async function deleteFile(key: string): Promise<void> {
  await getObjectStorageProvider().deleteObject(key);
}

export async function createSignedDownloadUrl(objectKey: string, expiresInSeconds?: number): Promise<SignedObjectUrl> {
  const ttl = expiresInSeconds ?? getMediaSignedUrlTtlSeconds();
  return getObjectStorageProvider().createSignedDownloadUrl(objectKey, ttl);
}

export async function createSignedUploadUrl(
  objectKey: string,
  contentType: string,
  expiresInSeconds?: number
): Promise<SignedObjectUrl> {
  const ttl = expiresInSeconds ?? getMediaSignedUrlTtlSeconds();
  return getObjectStorageProvider().createSignedUploadUrl(objectKey, contentType, ttl);
}

export function getFileKeyFromUrl(fileUrl: string): string {
  return getObjectStorageProvider().resolveObjectKey(fileUrl);
}

/** FS-79: lightweight bucket reachability check for staging health probes. */
export async function pingObjectStorageBucket(): Promise<void> {
  const provider = getObjectStorageProvider();
  if (!(provider instanceof R2ObjectStorageProvider)) {
    throw new Error("pingObjectStorageBucket is only supported for the R2 object storage provider");
  }

  await provider.pingBucket();
}
