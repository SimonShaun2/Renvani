import type { Metadata } from "next";

import { MarketingPage } from "@/src/components/marketing/visuals/MarketingPage";

export const revalidate = 300;

export const metadata: Metadata = { title: "Pricing · Renvani" };

export default function PricingPage() {
  return <MarketingPage page="pricing" />;
}
