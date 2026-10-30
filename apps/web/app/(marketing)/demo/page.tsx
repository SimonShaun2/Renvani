import type { Metadata } from "next";

import { DemoPage } from "@/src/components/marketing/site/DemoPage";

export const metadata: Metadata = {
  title: "Get a free demo · Renvani",
  description: "See your HVAC, plumbing or electrical business in Renvani. Tell us about your work and we’ll set up a demo."
};

export default function DemoRoute() {
  return <DemoPage />;
}
