import { FigmaNode } from "./FigmaNode";
import { ScaleToFrame } from "./ScaleToFrame";
import type { ProductPageEntry } from "./flagship-registry";
import { FLAGSHIP_TREES } from "./flagship-visuals";

/**
 * Product pages (Growth 175:3 … Scheduling & Dispatch 175:2008 and their mobile frames 175:150 … 175:2154),
 * rendered from each frame's own layer data: desktop tree at lg+ (1440 frame scaled to fit the viewport, never above 1), the Figma mobile frame below lg.
 * No tablet frames exist; 768–1023 uses the mobile frame (the desktop frame scaled to 768 would make 14px text ~7px).
 */
export function FlagshipPage({ page }: { page: ProductPageEntry }) {
  const t = FLAGSHIP_TREES[page.slug];
  if (!t) return null;
  return (
    <>
      <div className="hidden lg:block">
        <ScaleToFrame>
          <FigmaNode node={t.desktop} className="w-full" />
        </ScaleToFrame>
      </div>
      <div className="lg:hidden">
        <FigmaNode node={t.mobile} className="w-full" />
      </div>
    </>
  );
}
