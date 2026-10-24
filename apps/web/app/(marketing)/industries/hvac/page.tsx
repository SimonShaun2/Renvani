import type { Metadata } from "next";

import { VisualSection } from "@/src/components/marketing/visuals/VisualSection";
import { getMarketingContent, getVisual } from "@/src/content/marketing-content";

export const metadata: Metadata = { title: "HVAC · Renvani" };

export default async function HvacPage() {
  const content = await getMarketingContent();
  return <VisualSection content={getVisual(content, "hvac")} as="h1" />;
}
