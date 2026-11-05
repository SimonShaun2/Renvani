import { IndustryDirectory } from "./IndustryDirectory";
import { IndustryWorkflowPage } from "./IndustryWorkflowPage";
import { INDUSTRY_PAGE_BY_SLUG, type IndustrySlug } from "./industry-registry";

export function IndustryFrames({ tree }: { tree: "industries" | IndustrySlug }) {
  if (tree === "industries") return <IndustryDirectory />;
  const industry = INDUSTRY_PAGE_BY_SLUG[tree];
  if (!industry) throw new Error(`Unregistered marketing industry: ${tree}`);
  return <IndustryWorkflowPage industry={industry} />;
}
