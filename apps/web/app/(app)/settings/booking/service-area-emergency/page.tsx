"use client";

import { ServiceAreaEmergencySettings } from "@/src/components/settings/service-area/ServiceAreaEmergencySettings";
import { useCompany } from "@/src/hooks/company.hooks";

export default function ServiceAreaEmergencyPage() {
  const company = useCompany();
  return <ServiceAreaEmergencySettings companyName={company.data?.company.name} />;
}
