import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MarketingPage } from "@/src/components/marketing/visuals/MarketingPage";

export const revalidate = 300;

const PRODUCTS = {
  growth: "Growth",
  revenue: "Revenue",
  operations: "Operations",
  retention: "Retention",
  "command-center": "Command Center"
} as const;
type Slug = keyof typeof PRODUCTS;

export function generateStaticParams() {
  return Object.keys(PRODUCTS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${PRODUCTS[slug as Slug] ?? "Product"} · Renvani` };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(slug in PRODUCTS)) notFound();
  return <MarketingPage page={slug} visual={slug as Slug} />;
}
