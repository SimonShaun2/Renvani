"use client";

import { TradePicker } from "@/src/components/settings/trade/TradePicker";
import { useCompany } from "@/src/hooks/company.hooks";

export default function CompanySettingsPage() {
  const company = useCompany();
  return <TradePicker companyName={company.data?.company.name} />;
}
