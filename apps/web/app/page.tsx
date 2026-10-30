import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { HomePage } from "@/src/components/marketing/site/HomePage";
import { MarketingShell } from "@/src/components/marketing/site/MarketingShell";
import { HOME_META } from "@/src/components/marketing/site/site-config";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { readServerAuthSession } from "@/src/lib/auth";

export const metadata: Metadata = {
  title: HOME_META.title,
  description: HOME_META.description,
  openGraph: {
    title: HOME_META.title,
    description: HOME_META.description,
    url: "https://getrenvani.com",
    siteName: "Renvani",
    type: "website"
  }
};

export default async function Home() {
  const cookieStore = await cookies();
  const session = readServerAuthSession(cookieStore);

  if (session?.role) {
    redirect(getDefaultRouteForRole(session.role));
  }

  return (
    <MarketingShell>
      <HomePage />
    </MarketingShell>
  );
}
