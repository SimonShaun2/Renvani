import { redirect } from "next/navigation";

import { AuthShell } from "@/src/components/auth/AuthShell";
import { CreateWorkspaceStep } from "@/src/components/onboarding/workspace/CreateWorkspaceStep";
import { WORKSPACE_SETUP_NEXT_ROUTE } from "@/src/components/onboarding/workspace/workspace-setup.config";
import "@/src/components/onboarding/workspace/workspace-step.css";
import { isClerkEnabled } from "@/src/lib/clerk/config";

/** Post-sign-up step (Clerk only): create + activate the Clerk org, wait for provisioning, then import. */
export default function CreateWorkspacePage() {
  if (!isClerkEnabled()) {
    redirect(WORKSPACE_SETUP_NEXT_ROUTE);
  }

  return (
    <AuthShell>
      <CreateWorkspaceStep />
    </AuthShell>
  );
}
