import { getMarketingContent, getVisual, type ProductVisualContent } from "@/src/content/marketing-content";
import { getPageSections, hasVisibleContent, pricingFromSection } from "@/src/content/page-sections";

import { PricingSection } from "./PricingSection";
import { ProductVisual } from "./ProductVisual";
import { SectionBlock } from "./SectionBlock";

/** Renders a page's CMS sections, with the product visual after the hero. */
export async function MarketingPage({ page, visual }: { page: string; visual?: ProductVisualContent["slug"] }) {
  const [allSections, content] = await Promise.all([getPageSections(page), getMarketingContent()]);
  const sections = allSections.filter(hasVisibleContent);
  return (
    <>
      {sections.map((section, i) => {
        const pricing = pricingFromSection(section);
        return (
          <div key={`${section.sectionKey}-${i}`}>
            {pricing ? (
              <PricingSection pricing={pricing} heading={section.headline} subhead={section.subhead} />
            ) : (
              <SectionBlock section={section} as={i === 0 ? "h1" : "h2"} />
            )}
            {i === 0 && visual ? (
              <div className="mx-auto max-w-6xl px-4">
                <ProductVisual content={getVisual(content, visual)} />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}
