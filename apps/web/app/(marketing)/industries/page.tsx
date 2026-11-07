import { withMarketingSeo } from "@/src/lib/seo/marketing-metadata";
import type { Metadata } from "next";

import { IndustryFrames } from "@/src/components/marketing/site/IndustryPage";
import { INDUSTRIES_OVERVIEW } from "@/src/components/marketing/site/industry-registry";

export const metadata: Metadata = withMarketingSeo("/industries", { title: INDUSTRIES_OVERVIEW.title, description: INDUSTRIES_OVERVIEW.description });

export default function IndustriesPage() {
  return <IndustryFrames tree="industries" />;
}
