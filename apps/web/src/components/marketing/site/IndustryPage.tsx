import { FrameSwitch } from "./FigmaNode";
import { INDUSTRY_TREES } from "./industry-visuals";

/** Renders an Industries frame via FrameSwitch: the 1440 desktop frame scaled to fit at xl+ (CSS zoom, max 1), the Figma mobile frame below xl. Server component. */
export function IndustryFrames({ tree }: { tree: "industries" | "hvac" | "plumbing" | "electrical" }) {
  const t = INDUSTRY_TREES[tree]!;
  return <FrameSwitch desktop={t.desktop} mobile={t.mobile} scaleDesktop />;
}
