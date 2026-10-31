import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import { redirect } from "next/navigation";

import { CreateWorkspaceStep } from "@/src/components/onboarding/workspace/CreateWorkspaceStep";
import { WORKSPACE_SETUP_NEXT_ROUTE } from "@/src/components/onboarding/workspace/workspace-setup.config";
import "@/src/components/onboarding/workspace/workspace-step.css";
import { isClerkEnabled } from "@/src/lib/clerk/config";

const sans = Geist({ subsets: ["latin"], variable: "--ws-font-sans" });
const mono = Geist_Mono({ subsets: ["latin"], weight: ["500"], variable: "--ws-font-mono" });
const serif = Newsreader({ subsets: ["latin"], style: ["italic"], weight: ["500"], variable: "--ws-font-serif" });

/** Post-sign-up step (Clerk only). Figma 158:4946. Desktop layout; no sidebar, wordmark-only top bar. */
export default function CreateWorkspacePage() {
  if (!isClerkEnabled()) {
    redirect(WORKSPACE_SETUP_NEXT_ROUTE);
  }

  return (
    <div className={`ws-page ${sans.variable} ${mono.variable} ${serif.variable}`}>
      <header className="ws-topbar">
        <p className="ws-wordmark">Renvani</p>
      </header>
      <main className="ws-main">
        <CreateWorkspaceStep />
      </main>
    </div>
  );
}
