/**
 * Generates manual_csv golden bundle job-history parts (~100k rows).
 * Run from repo root: node packages/config/scripts/generate-manual-csv-jobs-history-parts.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PART_COUNT = 20;
const ROWS_PER_PART = 5000;
const CUSTOMER_ID = "GEN-C-001";
const START_MS = Date.parse("2022-01-15T12:00:00.000Z");
const END_MS = Date.parse("2026-10-01T12:00:00.000Z");

const scriptDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(scriptDir, "..", "fixtures", "import-golden-bundles", "manual_csv", "jobs_history");

mkdirSync(outDir, { recursive: true });

const totalRows = PART_COUNT * ROWS_PER_PART;
if (totalRows !== 100_000) {
  throw new Error(`Expected 100k rows, got ${totalRows}`);
}

for (let partIndex = 0; partIndex < PART_COUNT; partIndex += 1) {
  const lines = ["job_id,customer_id,completed_at,title,status"];
  for (let rowInPart = 0; rowInPart < ROWS_PER_PART; rowInPart += 1) {
    const globalRow = partIndex * ROWS_PER_PART + rowInPart;
    const ratio = globalRow / (totalRows - 1);
    const completedMs = START_MS + ratio * (END_MS - START_MS);
    const completedAt = new Date(completedMs).toISOString().slice(0, 10);
    lines.push(
      `GEN-J-H-${String(globalRow).padStart(6, "0")},${CUSTOMER_ID},${completedAt},History job ${globalRow},completed`
    );
  }
  const fileName = `part-${String(partIndex).padStart(2, "0")}.csv`;
  writeFileSync(join(outDir, fileName), `${lines.join("\n")}\n`, "utf8");
}

console.log(`Wrote ${PART_COUNT} parts (${totalRows} data rows) to ${outDir}`);
