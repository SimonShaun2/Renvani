import type { Metadata } from "next";

import { VisualSection } from "@/src/components/marketing/visuals/VisualSection";
import { getMarketingContent } from "@/src/content/marketing-content";

export const metadata: Metadata = { title: "Product · Renvani" };

const ORDER = ["home", "growth", "revenue", "operations", "retention", "command-center"] as const;

export default async function ProductTourPage() {
  const content = await getMarketingContent();
  return (
    <>
      {ORDER.map((slug, i) => {
        const visual = content.visuals.find((v) => v.slug === slug);
        return visual ? <VisualSection key={slug} content={visual} as={i === 0 ? "h1" : "h2"} /> : null;
      })}
    </>
  );
}
