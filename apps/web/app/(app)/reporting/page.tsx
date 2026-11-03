import { redirect } from "next/navigation";

import { ReportingDashboardClient } from "@/src/components/reporting/ReportingDashboardClient";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { requireServerSession } from "@/src/lib/server-session";

export default async function ReportingPage() {
  const session = await requireServerSession();

  if (session.role !== "owner" && session.role !== "admin") {
    redirect(getDefaultRouteForRole(session.role));
  }

  return <ReportingDashboardClient />;
}
