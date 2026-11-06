import type { ProductPageEntry } from "./flagship-registry";
import { ProductDetailPage } from "./DetailPages";

/** Existing names, routes and product options are unchanged; only the detail page presentation changes. */
export function FlagshipPage({ page }: { page: ProductPageEntry }) {
  return <ProductDetailPage page={page} />;
}
