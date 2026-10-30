import { FigmaNode } from "./FigmaNode";
import type { TourStep } from "./tour-config";
import { TOUR_TREES } from "./tour-visuals";

/** One workflow-tour step page: desktop frame at md+, the Figma mobile frame below md. Step selector and Previous/Next are real links. */
export function TourPage({ step }: { step: TourStep }) {
  const t = TOUR_TREES[step.slug];
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
