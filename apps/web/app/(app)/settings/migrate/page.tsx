import { redirect } from "next/navigation";

import { MigrateOnboardingWizardClient } from "@/src/components/migrate-onboarding/MigrateOnboardingWizardClient";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { requireServerSession } from "@/src/lib/server-session";

export default async function SettingsMigratePage() {
  const session = await requireServerSession();

  if (session.role !== "owner" && session.role !== "admin") {
    redirect(getDefaultRouteForRole(session.role));
  }

  return <MigrateOnboardingWizardClient />;
}
