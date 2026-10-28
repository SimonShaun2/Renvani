import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MarketingPage } from "@/src/components/marketing/visuals/MarketingPage";
import { MARKETING_META } from "@/src/components/marketing/marketing-copy";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { getServerSession } from "@/src/lib/server-session";

export const metadata: Metadata = {
  title: MARKETING_META.title,
  description: MARKETING_META.description,
  openGraph: {
    title: MARKETING_META.title,
    description: MARKETING_META.description,
    url: "https://getrenvani.com",
    siteName: "Renvani",
    type: "website"
  }
};

export default async function HomePage() {
  const result = await getServerSession();

  if (result.status === "ok") {
    redirect(getDefaultRouteForRole(result.session.role));
  }

  return <MarketingPage page="home" visual="home" />;
}
