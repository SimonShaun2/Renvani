import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TourPage } from "@/src/components/marketing/site/TourPage";
import { TOUR_STEP_BY_SLUG, TOUR_STEPS, tourMeta } from "@/src/components/marketing/site/tour-config";

export const dynamicParams = false;

/** Step 1 lives at /tour, so only steps 2–6 get their own segment. */
export function generateStaticParams() {
  return TOUR_STEPS.slice(1).map((s) => ({ step: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ step: string }> }): Promise<Metadata> {
  const { step } = await params;
  const s = TOUR_STEP_BY_SLUG[step];
  return s ? tourMeta(s) : {};
}

export default async function Page({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  const s = TOUR_STEP_BY_SLUG[step];
  if (!s || s === TOUR_STEPS[0]) notFound();
  return <TourPage step={s} />;
}
