import { CommandCenterView } from "@/src/components/command-center/CommandCenterView";
import { requireServerSession } from "@/src/lib/server-session";

export const dynamic = "force-dynamic";

/** Use the authenticated application identity, never the prototype's sample owner. */
export default async function CommandCenterPage() {
  const session = await requireServerSession();
  return <CommandCenterView firstName={session.user.firstName?.trim() || null} />;
}
