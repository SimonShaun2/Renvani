import { FigmaNode } from "./FigmaNode";
import { INDUSTRY_TREES } from "./industry-visuals";
import { ScaleToFrame } from "./ScaleToFrame";

/** Renders an Industries frame: the 1440 desktop frame scaled to fit at lg+ (CSS zoom, max 1), the Figma mobile frame below lg. Server component. */
export function IndustryFrames({ tree }: { tree: "industries" | "hvac" | "plumbing" | "electrical" }) {
  const t = INDUSTRY_TREES[tree]!;
  return (
    <>
      <div className={t.mobile ? "hidden lg:block" : undefined}>
        <ScaleToFrame>
          <FigmaNode node={t.desktop} className="w-full" />
        </ScaleToFrame>
      </div>
      {t.mobile ? (
        <div className="lg:hidden">
          <FigmaNode node={t.mobile} className="w-full" />
        </div>
      ) : null}
    </>
  );
}
