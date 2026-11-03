import { storageEnv as env } from "../runtime-env.js";
import { MemoryObjectStorageProvider } from "./memory-provider.js";
import { R2ObjectStorageProvider } from "./r2-provider.js";
import type { ObjectStorageProvider } from "./types.js";

let cachedProvider: ObjectStorageProvider | null = null;
let testProviderOverride: ObjectStorageProvider | null = null;

export function setObjectStorageProviderForTests(provider: ObjectStorageProvider | null): void {
  testProviderOverride = provider;
  cachedProvider = null;
}

export function getObjectStorageProvider(): ObjectStorageProvider {
  if (testProviderOverride) {
    return testProviderOverride;
  }

  if (cachedProvider) {
    return cachedProvider;
  }

  cachedProvider =
    env.OBJECT_STORAGE_PROVIDER === "memory" ? new MemoryObjectStorageProvider() : new R2ObjectStorageProvider();

  return cachedProvider;
}

export type { ObjectStorageProvider, SignedObjectUrl, StoredObjectReference } from "./types.js";
export { MemoryObjectStorageProvider } from "./memory-provider.js";
