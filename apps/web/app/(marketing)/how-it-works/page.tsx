import type { Metadata } from "next";

import { HowItWorksPage } from "@/src/components/marketing/site/PlatformPages";
import { HOW_PAGE } from "@/src/components/marketing/site/platform-config";

export const metadata: Metadata = { title: HOW_PAGE.meta.title, description: HOW_PAGE.meta.description };

export default function Page() {
  return <HowItWorksPage />;
}
