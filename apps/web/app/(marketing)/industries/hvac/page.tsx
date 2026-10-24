import type { Metadata } from "next";

import { MarketingPage } from "@/src/components/marketing/visuals/MarketingPage";

export const revalidate = 300;

export const metadata: Metadata = { title: "HVAC · Renvani" };

export default function HvacPage() {
  return <MarketingPage page="industries/hvac" visual="hvac" />;
}
