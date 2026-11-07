import { redirect } from "next/navigation";
import { OWNER_HOME_PATH } from "@/src/lib/owner-home";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { requireServerSession } from "@/src/lib/server-session";

/** Preserve old bookmarks/auth return paths without keeping a competing owner dashboard. */
export default async function DashboardPage() {
  const session = await requireServerSession();
  redirect(session.role === "owner" || session.role === "admin" ? OWNER_HOME_PATH : getDefaultRouteForRole(session.role));
}
