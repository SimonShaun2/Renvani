import { FigmaNode } from "./FigmaNode";
import type { ProductPageEntry } from "./flagship-registry";
import { FLAGSHIP_TREES } from "./flagship-visuals";

/**
 * Product pages (Growth 175:3 … Scheduling & Dispatch 175:2008 and their mobile frames 175:150 … 175:2154),
 * rendered from each frame's own layer data: desktop tree at md+, the Figma mobile frame below md. Server component.
 */
export function FlagshipPage({ page }: { page: ProductPageEntry }) {
  const t = FLAGSHIP_TREES[page.slug];
  if (!t) return null;
  return (
    <>
      <div className="hidden md:block">
        <FigmaNode node={t.desktop} className="w-full" />
      </div>
      <div className="md:hidden">
        <FigmaNode node={t.mobile} className="w-full" />
      </div>
    </>
  );
}
