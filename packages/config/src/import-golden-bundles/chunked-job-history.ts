import type { GoldenBundleChunkedJobHistorySpec } from "@fsm/types";

export function formatGoldenBundleChunkPartFileName(
  spec: GoldenBundleChunkedJobHistorySpec,
  partIndex: number
): string {
  if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= spec.partCount) {
    throw new Error(`partIndex out of range: ${partIndex}`);
  }
  const padded = String(partIndex).padStart(2, "0");
  if (!spec.partFileNameFormat.includes("%02d")) {
    throw new Error(`partFileNameFormat must include %02d: ${spec.partFileNameFormat}`);
  }
  const fileName = spec.partFileNameFormat.replace("%02d", padded);
  return `${spec.relativeDir}/${fileName}`;
}

export function listGoldenBundleChunkPartRelativePaths(
  spec: GoldenBundleChunkedJobHistorySpec
): string[] {
  return Array.from({ length: spec.partCount }, (_, partIndex) =>
    formatGoldenBundleChunkPartFileName(spec, partIndex)
  );
}

export function expectedGoldenBundleWorkerChunkCount(spec: GoldenBundleChunkedJobHistorySpec): number {
  return Math.ceil(spec.totalDataRows / spec.workerRowChunkSize);
}
