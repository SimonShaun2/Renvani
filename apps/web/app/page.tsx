import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MarketingPage } from "@/src/components/marketing/visuals/MarketingPage";
import { MARKETING_META } from "@/src/components/marketing/marketing-copy";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { readServerAuthSession } from "@/src/lib/auth";

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
  const cookieStore = await cookies();
  const session = readServerAuthSession(cookieStore);

  if (session?.role) {
    redirect(getDefaultRouteForRole(session.role));
  }

  return <MarketingPage page="home" visual="home" />;
}
