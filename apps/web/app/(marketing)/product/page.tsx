import type { Metadata } from "next";

import { ProductsPage } from "@/src/components/marketing/site/PlatformPages";
import { PRODUCTS_PAGE } from "@/src/components/marketing/site/platform-config";

export const metadata: Metadata = { title: PRODUCTS_PAGE.meta.title, description: PRODUCTS_PAGE.meta.description };

export default function Page() {
  return <ProductsPage />;
}
