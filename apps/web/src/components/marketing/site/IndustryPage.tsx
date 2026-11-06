import { IndustryDirectory } from "./IndustryDirectory";
import { IndustryDetailPage } from "./DetailPages";
import { INDUSTRY_PAGE_BY_SLUG, type IndustrySlug } from "./industry-registry";

/** The existing directory and every existing trade destination remain intact. */
export function IndustryFrames({ tree }: { tree: "industries" | IndustrySlug }) {
  if (tree === "industries") return <IndustryDirectory />;
  const industry = INDUSTRY_PAGE_BY_SLUG[tree];
  if (!industry) throw new Error(`Unregistered marketing industry: ${tree}`);
  return <IndustryDetailPage industry={industry} />;
}
