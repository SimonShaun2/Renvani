import { resolveInvoiceLineCatalogId } from "@fsm/db";
import type { ImportSourceSystemId, PriceBookItemPickerSeed, Product, ProductCategory } from "@fsm/types";

import { getProduct, searchProducts } from "./product-catalog.service.js";

function mapCategoryToLineItemType(
  category: ProductCategory
): PriceBookItemPickerSeed["itemType"] {
  if (category === "labor" || category === "material" || category === "fee") {
    return category;
  }

  return "service";
}

export function mapCatalogProductToPriceBookLineSeed(product: Product): PriceBookItemPickerSeed {
  return {
    priceBookItemId: product.id,
    name: product.name,
    description: product.description,
    unitPrice: product.unitPrice,
    isTaxable: product.isTaxable ?? true,
    itemType: mapCategoryToLineItemType(product.category)
  };
}

export async function searchPriceBookItemsForPicker(
  companyId: string,
  q: string
): Promise<PriceBookItemPickerSeed[]> {
  const products = await searchProducts(companyId, q);
  return products.map((product) => mapCatalogProductToPriceBookLineSeed(product));
}

export async function getPriceBookLinePickerSeed(
  companyId: string,
  priceBookItemId: string
): Promise<PriceBookItemPickerSeed> {
  const product = await getProduct(companyId, priceBookItemId);
  return mapCatalogProductToPriceBookLineSeed(product);
}

/**
 * Resolves a migrated price-book row for invoice line commit (FS-MIGRATE-M5).
 * Invoice import processors call this with the vendor item id from the export.
 */
export async function resolveImportedInvoiceLineCatalogId(
  companyId: string,
  sourceSystem: ImportSourceSystemId,
  vendorItemSourceId: string
): Promise<string | null> {
  const trimmed = vendorItemSourceId.trim();
  if (trimmed.length === 0) {
    return null;
  }

  return resolveInvoiceLineCatalogId(companyId, sourceSystem, trimmed);
}
