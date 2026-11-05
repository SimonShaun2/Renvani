import { FrameSwitch } from "./FigmaNode";
import { IndustryDirectory } from "./IndustryDirectory";
import { IndustryWorkflowPage } from "./IndustryWorkflowPage";
import { INDUSTRY_PAGE_BY_SLUG, type IndustrySlug } from "./industry-registry";
import { INDUSTRY_TREES } from "./industry-visuals";

/** Preserve the original three route frames; use the new responsive directory and shared illustrative trade template. */
export function IndustryFrames({ tree }: { tree: "industries" | IndustrySlug }) {
  if (tree === "industries") return <IndustryDirectory />;
  if (tree === "hvac" || tree === "plumbing" || tree === "electrical") {
    const frames = INDUSTRY_TREES[tree]!;
    return <FrameSwitch desktop={frames.desktop} mobile={frames.mobile} scaleDesktop />;
  }
  const industry = INDUSTRY_PAGE_BY_SLUG[tree];
  if (!industry) throw new Error(`Unregistered marketing industry: ${tree}`);
  return <IndustryWorkflowPage industry={industry} />;
}
