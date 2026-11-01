"use client";

import { ServiceAreaEmergencySettings } from "@/src/components/settings/service-area/ServiceAreaEmergencySettings";
import { canEditHomeServices } from "@/src/components/settings/service-area/service-area.utils";
import { useCompany } from "@/src/hooks/company.hooks";
import { getStoredSession } from "@/src/lib/auth";
import { useAuthStore } from "@/src/stores/auth.store";

export default function ServiceAreaEmergencyPage() {
  const company = useCompany();
  const authRole = useAuthStore((state) => state.user?.role ?? null);
  const role = authRole ?? getStoredSession()?.role ?? null;
  return <ServiceAreaEmergencySettings companyName={company.data?.company.name} canEdit={canEditHomeServices(role)} />;
}
