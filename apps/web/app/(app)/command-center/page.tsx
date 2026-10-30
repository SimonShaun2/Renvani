import { currentUser } from "@clerk/nextjs/server";

import { greetingFor } from "@/src/components/command-center/command-center.config";
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

export default async function CommandCenterPage() {
  const now = new Date();
  const firstName = await loadFirstName();
  return (
    <CommandCenterView
      greeting={greetingFor(now.getHours())}
      firstName={firstName}
      dateLabel={now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
      monthLabel={now.toLocaleDateString("en-US", { month: "short" })}
    />
  );
}
