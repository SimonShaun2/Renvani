import { FrameSwitch } from "./FigmaNode";
import type { TourStep } from "./tour-config";
import { TOUR_TREES } from "./tour-visuals";

/** One workflow-tour step page: desktop frame (scaled) at xl+, the Figma mobile frame below xl, like the other marketing pages. Step selector and Previous/Next are real links. */
export function TourPage({ step }: { step: TourStep }) {
  const t = TOUR_TREES[step.slug];
  if (!t) return null;
  return <FrameSwitch desktop={t.desktop} mobile={t.mobile} scaleDesktop />;
}
