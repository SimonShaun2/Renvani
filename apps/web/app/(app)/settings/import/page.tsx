import { redirect } from "next/navigation";

import { CSVImportWizardClient } from "@/src/components/csv-import/CSVImportWizardClient";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { requireServerSession } from "@/src/lib/server-session";

export default async function SettingsDataImportPage() {
  const session = await requireServerSession();

  if (session.role !== "owner" && session.role !== "admin") {
    redirect(getDefaultRouteForRole(session.role));
  }

  return <CSVImportWizardClient presentation="settings" />;
}
