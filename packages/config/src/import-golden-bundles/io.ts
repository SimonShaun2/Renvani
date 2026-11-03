import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { GoldenImportBundleManifest } from "@fsm/types";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixturesRoot = join(packageRoot, "fixtures", "import-golden-bundles");

export function resolveGoldenImportBundleRoot(): string {
  return fixturesRoot;
}

export function resolveGoldenImportBundleDir(sourceSystem: GoldenImportBundleManifest["sourceSystem"]): string {
  return join(fixturesRoot, sourceSystem);
}

export function readGoldenImportBundleFile(
  sourceSystem: GoldenImportBundleManifest["sourceSystem"],
  relativePath: string
): string {
  const absolutePath = join(resolveGoldenImportBundleDir(sourceSystem), relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Golden bundle file missing: ${sourceSystem}/${relativePath}`);
  }
  return readFileSync(absolutePath, "utf8");
}

export function goldenImportBundleFileExists(
  sourceSystem: GoldenImportBundleManifest["sourceSystem"],
  relativePath: string
): boolean {
  return existsSync(join(resolveGoldenImportBundleDir(sourceSystem), relativePath));
}
