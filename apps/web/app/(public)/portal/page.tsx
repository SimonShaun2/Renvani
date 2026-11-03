import type { Metadata } from "next";

import { CustomerPortalClient } from "@/src/components/customer-portal/CustomerPortalClient";

export const metadata: Metadata = { title: "Your account", referrer: "no-referrer", robots: { index: false } };

export default function CustomerPortalPage() {
  return <CustomerPortalClient />;
}
