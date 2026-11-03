import { FrameSwitch } from "./FigmaNode";
import type { ProductPageEntry } from "./flagship-registry";
import { FLAGSHIP_TREES } from "./flagship-visuals";

/**
 * Product pages (Growth 175:3 … Scheduling & Dispatch 175:2008 and their mobile frames 175:150 … 175:2154),
 * rendered from each frame's own layer data via FrameSwitch (1440 desktop frame scaled to fit at xl+, the Figma mobile frame below xl). Server component.
 */
export function FlagshipPage({ page }: { page: ProductPageEntry }) {
  const t = FLAGSHIP_TREES[page.slug];
  if (!t) return null;
  return <FrameSwitch desktop={t.desktop} mobile={t.mobile} scaleDesktop />;
}
