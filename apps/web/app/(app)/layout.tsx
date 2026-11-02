import type { ReactNode } from "react";

import { AppShell } from "@/src/components/layout/AppShell";
import { AuthRouteBridge } from "@/src/components/layout/AuthRouteBridge";
import { requireServerSession } from "@/src/lib/server-session";

export default async function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const session = await requireServerSession();

  return (
    <AppShell
      companyName={session.company.name}
      role={session.role}
      userName={`${session.user.firstName} ${session.user.lastName}`.trim()}
    >
      <AuthRouteBridge session={session}>{children}</AuthRouteBridge>
    </AppShell>
  );
}
