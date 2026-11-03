import type { ReactNode } from "react";
import { notFound } from "next/navigation";

import { AuthRouteBridge } from "@/src/components/layout/AuthRouteBridge";
import { MobileAppShell } from "@/src/components/mobile/MobileAppShell";
import { requireServerSession } from "@/src/lib/server-session";

export default async function MobileLayout({ children }: { children: ReactNode }) {
  const session = await requireServerSession();

  // Crew screens are for technicians; owners can open them too (e.g. capturing a signature on site).
  if (session.role !== "technician" && session.role !== "owner") {
    notFound();
  }

  return (
    <AuthRouteBridge session={session}>
      <MobileAppShell session={session}>{children}</MobileAppShell>
    </AuthRouteBridge>
  );
}
