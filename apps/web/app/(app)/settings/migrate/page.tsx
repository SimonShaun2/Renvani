import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { MigrateOnboardingWizardClient } from "@/src/components/migrate-onboarding/MigrateOnboardingWizardClient";
import { readServerAuthSession } from "@/src/lib/auth";
import { getDefaultRouteForRole } from "@/src/lib/route-access";

export default async function SettingsMigratePage() {
  const cookieStore = await cookies();
  const session = readServerAuthSession(cookieStore);

  if (!session) {
    redirect("/login");
  }

  if (session.role !== "owner" && session.role !== "admin") {
    redirect(getDefaultRouteForRole(session.role));
  }

  return <MigrateOnboardingWizardClient />;
}
