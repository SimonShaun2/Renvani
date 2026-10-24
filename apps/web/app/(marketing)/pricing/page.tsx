import type { Metadata } from "next";

import { PricingSection } from "@/src/components/marketing/visuals/PricingSection";
import { getMarketingContent } from "@/src/content/marketing-content";

export const metadata: Metadata = { title: "Pricing · Renvani" };

export default async function PricingPage() {
  const content = await getMarketingContent();
  return <PricingSection plans={content.plans} pricing={content.pricing} />;
}
