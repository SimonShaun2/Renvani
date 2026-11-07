import { notFound } from "next/navigation";

import { getServerSession } from "@/src/lib/server-session";
import { canOpenStudio } from "@/src/lib/studio-access";
import { Studio } from "./Studio";

export const dynamic = "force-dynamic";
export { metadata, viewport } from "next-sanity/studio";

/** Embedded Sanity Studio. Gated to signed-in owner/admin/office staff; everyone else gets a 404. */
export default async function StudioPage() {
  if (!canOpenStudio(await getServerSession())) notFound();
  return <Studio />;
}
