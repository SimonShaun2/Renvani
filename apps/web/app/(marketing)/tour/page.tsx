import { withMarketingSeo } from "@/src/lib/seo/marketing-metadata";
import type { Metadata } from "next";

import { TourPage } from "@/src/components/marketing/site/TourPage";
import { TOUR_STEPS, tourMeta } from "@/src/components/marketing/site/tour-config";

const step = TOUR_STEPS[0]!;
export const metadata: Metadata = withMarketingSeo("/tour", tourMeta(step));

export default function Page() {
  return <TourPage step={step} />;
}
