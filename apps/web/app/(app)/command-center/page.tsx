import { currentUser } from "@clerk/nextjs/server";

import { CommandCenterView } from "@/src/components/command-center/CommandCenterView";
import { isClerkEnabled } from "@/src/lib/clerk/config";

export const dynamic = "force-dynamic";

async function loadFirstName(): Promise<string | null> {
  if (!isClerkEnabled()) return null;
  try {
    return (await currentUser())?.firstName ?? null;
  } catch {
    return null;
  }
}

/** Server loads only the Clerk name; greeting/date are computed in the browser (viewer or shop time zone). */
export default async function CommandCenterPage() {
  return <CommandCenterView firstName={await loadFirstName()} />;
}
