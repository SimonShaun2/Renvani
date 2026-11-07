import { auth } from "@clerk/nextjs/server";
import { notFound, redirect } from "next/navigation";

import { isClerkEnabled } from "@/src/lib/clerk/config";
import { decideStudioAccessFromClaims } from "@/src/lib/studio-access";
import { Studio } from "./Studio";

export const dynamic = "force-dynamic";
export { metadata, viewport } from "next-sanity/studio";

/**
 * Embedded Sanity Studio, gated on a verified Clerk session (owner/admin/office). Legacy cookies are ignored.
 * Middleware answers wrong-role requests with HTTP 403 and signed-out requests with a sign-in redirect;
 * this server check is defence in depth and never renders the Studio for anyone else.
 */
export default async function StudioPage() {
  if (!isClerkEnabled()) redirect("/login");
  const { userId, sessionClaims } = await auth();
  const access = decideStudioAccessFromClaims(userId, sessionClaims);
  if (access === "sign-in") redirect("/login");
  if (access !== "allow") notFound();
  return <Studio />;
}
