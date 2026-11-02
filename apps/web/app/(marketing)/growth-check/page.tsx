import type { Metadata } from "next";

import { GrowthCheckPage } from "@/src/components/marketing/site/GrowthCheckPage";

export const metadata: Metadata = {
  title: "Growth Check · Renvani",
  description: "Get a free Growth Check for your home-service website, with next steps for winning more direct jobs."
};

export default async function GrowthCheckRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const website = typeof sp.website === "string" ? sp.website.slice(0, 2048) : "";
  return <GrowthCheckPage website={website} />;
}
