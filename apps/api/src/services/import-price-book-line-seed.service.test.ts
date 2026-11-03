import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveInvoiceLineCatalogId = vi.fn<typeof import("@fsm/db").resolveInvoiceLineCatalogId>();

vi.mock("@fsm/db", () => ({
  resolveInvoiceLineCatalogId
}));

describe("import-price-book-line-seed.service", () => {
  beforeEach(() => {
    resolveInvoiceLineCatalogId.mockReset();
  });

  it("returns null for blank vendor ids without calling db", async () => {
    const { resolveImportedInvoiceLineCatalogId } = await import("./import-price-book-line-seed.service.js");
    await expect(resolveImportedInvoiceLineCatalogId("company-1", "qbo", "   ")).resolves.toBeNull();
    expect(resolveInvoiceLineCatalogId).not.toHaveBeenCalled();
  });

  it("delegates trimmed vendor ids to db resolver", async () => {
    resolveInvoiceLineCatalogId.mockResolvedValue("catalog-99");
    const { resolveImportedInvoiceLineCatalogId } = await import("./import-price-book-line-seed.service.js");

    await expect(
      resolveImportedInvoiceLineCatalogId("company-1", "qbo", "  ITEM-42 ")
    ).resolves.toBe("catalog-99");

    expect(resolveInvoiceLineCatalogId).toHaveBeenCalledWith("company-1", "qbo", "ITEM-42");
  });
});
