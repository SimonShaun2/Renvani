import { describe, expect, it } from "vitest";

import { parseQuickBooksIifToTable } from "@fsm/import-engine";
import { QBD_DESKTOP_IMPORT_CONTRACT } from "@fsm/types";

import { GOLDEN_IMPORT_BUNDLE_MANIFESTS } from "./import-golden-bundles/index.js";
import { readGoldenImportBundleFile } from "./import-golden-bundles/io.js";
import { inferImportSourcePresetFromHeaders, type ImportSourcePresetId } from "./import-source-presets.js";

describe("FS-137 QBD desktop import contract", () => {
  it("matches golden bundle desktop preset inference for CSV and IIF", () => {
    expect(QBD_DESKTOP_IMPORT_CONTRACT.sourceSystem).toBe("qbd");

    const manifest = GOLDEN_IMPORT_BUNDLE_MANIFESTS.find((entry) => entry.sourceSystem === "qbd");
    expect(manifest).toBeDefined();

    const expectations: Array<{
      relativePath: string;
      entityHint: "customers" | "products" | "invoices";
      presetId: ImportSourcePresetId;
    }> = [
      { relativePath: "items.csv", entityHint: "products", presetId: "quickbooks_desktop_items" },
      { relativePath: "invoices.csv", entityHint: "invoices", presetId: "quickbooks_desktop_invoices" },
      { relativePath: "payments.csv", entityHint: "invoices", presetId: "quickbooks_desktop_payments" }
    ];

    for (const entry of expectations) {
      const content = readGoldenImportBundleFile("qbd", entry.relativePath);
      const headerLine = content.split(/\r?\n/u)[0] ?? "";
      const headers = headerLine.split(",").map((cell) => cell.trim());
      const presetId = inferImportSourcePresetFromHeaders(headers, entry.entityHint);
      expect(presetId).toBe(entry.presetId);
    }

    const iifContent = readGoldenImportBundleFile("qbd", "customers.iif");
    const iifTable = parseQuickBooksIifToTable(iifContent, "CUST");
    const iifPreset = inferImportSourcePresetFromHeaders(iifTable?.headers ?? [], "customers");
    expect(iifPreset).toBe(QBD_DESKTOP_IMPORT_CONTRACT.presetIds.customers);
  });
});
