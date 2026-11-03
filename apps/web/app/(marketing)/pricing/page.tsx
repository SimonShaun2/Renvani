import type { Metadata } from "next";

import { PricingFrames } from "@/src/components/marketing/site/PricingPage";

export const metadata: Metadata = {
  title: "Pricing · Renvani",
  description: "One platform, two ways to pay: Flex $399/month plus a 2% customer-paid Service Fee, or Flat $999/month with no fee."
};

export default function PricingPage() {
  return <PricingFrames />;
}
