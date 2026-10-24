import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppShell } from "@/src/components/layout/AppShell";
import { AuthRouteBridge } from "@/src/components/layout/AuthRouteBridge";
import { ObservabilityTenantBridge } from "@/src/components/layout/ObservabilityTenantBridge";
import { readServerAuthSession } from "@/src/lib/auth";

export default async function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const session = readServerAuthSession(cookieStore);

  if (!session) {
    redirect("/login");
  }

  return (
    <AppShell
      companyName={session.company.name}
      role={session.role}
      userName={`${session.user.firstName} ${session.user.lastName}`.trim()}
    >
      <ObservabilityTenantBridge session={session} />
      <AuthRouteBridge session={session}>{children}</AuthRouteBridge>
    </AppShell>
  );
}
