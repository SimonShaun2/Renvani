import type { Metadata } from "next";

import { DemoPage } from "@/src/components/marketing/site/DemoPage";
import { demoPlanInterest } from "@/src/components/marketing/site/pricing-config";

export const metadata: Metadata = {
  title: "Get a free demo · Renvani",
  description: "See your HVAC, plumbing or electrical business in Renvani. Tell us about your work and we’ll set up a demo."
};

export default async function DemoRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <DemoPage plan={demoPlanInterest(sp.plan)} />;
}
