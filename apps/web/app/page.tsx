import { MarketingStructuredData } from "@/src/components/marketing/site/MarketingStructuredData";
import { withMarketingSeo } from "@/src/lib/seo/marketing-metadata";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HomePage } from "@/src/components/marketing/site/HomePage";
import { MarketingShell } from "@/src/components/marketing/site/MarketingShell";
import { LAUNCH_HOME } from "@/src/components/marketing/site/launch-content";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { getServerSession } from "@/src/lib/server-session";

export const metadata: Metadata = withMarketingSeo("/", {
  title: LAUNCH_HOME.title,
  description: LAUNCH_HOME.description,
  openGraph: {
    title: LAUNCH_HOME.title,
    description: LAUNCH_HOME.description,
    url: "https://getrenvani.com",
    siteName: "Renvani",
    type: "website"
  }
});

export default async function Home() {
  const result = await getServerSession();

  if (result.status === "ok") {
    redirect(getDefaultRouteForRole(result.session.role));
  }

  return (
    <MarketingShell>
      <MarketingStructuredData />
      <HomePage />
    </MarketingShell>
  );
}
