import { FigmaNode } from "./FigmaNode";
import { ScaleToFrame } from "./ScaleToFrame";
import type { TourStep } from "./tour-config";
import { TOUR_TREES } from "./tour-visuals";

/** One workflow-tour step page: desktop frame at md+, the Figma mobile frame below md. Step selector and Previous/Next are real links. */
export function TourPage({ step }: { step: TourStep }) {
  const t = TOUR_TREES[step.slug];
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
