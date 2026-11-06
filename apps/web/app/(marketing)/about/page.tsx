import type { Metadata } from "next";
import { AboutPage } from "@/src/components/marketing/site/AboutPage";
import { FOUNDER_STORY } from "@/src/components/marketing/site/launch-content";
import { withMarketingSeo } from "@/src/lib/seo/marketing-metadata";

export const metadata: Metadata = withMarketingSeo("/about", {
  title: "Why we built Renvani | Shaun Simon, Founder",
  description: FOUNDER_STORY.lead
});
export default function Page() { return <AboutPage />; }
