import type { ImportBundleFileDescriptor, ImportBundleProgress } from "@fsm/types";

import { buildImportBundleFileDescriptor } from "./bundle-file-descriptor.js";

export function countMappedImportBundleFiles(files: ImportBundleFileDescriptor[]): number {
  return files.filter((file) => file.role !== "unknown").length;
}

export function computeImportBundleProgress(input: {
  files: ImportBundleFileDescriptor[];
  chunksCommitted?: number;
  chunksTotal?: number | null;
}): ImportBundleProgress {
  const filesTotal = input.files.length;
  const filesMapped = countMappedImportBundleFiles(input.files);

  return {
    filesTotal,
    filesMapped,
    chunksCommitted: input.chunksCommitted ?? 0,
    chunksTotal: input.chunksTotal ?? null
  };
}

export function buildImportBundleFileDescriptors(
  files: Array<{
    fileName: string;
    mimeType: string;
    byteSize: number;
    importSessionId?: string | null;
  }>
): ImportBundleFileDescriptor[] {
  return files.map((file) => buildImportBundleFileDescriptor(file));
}
