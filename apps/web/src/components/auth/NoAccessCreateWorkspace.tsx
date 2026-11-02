"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";

import { WORKSPACE_SETUP_ROUTE } from "@/src/components/onboarding/workspace/workspace-setup.config";

/** Offers the workspace step only to signed-in Clerk users with no active organization. */
export function NoAccessCreateWorkspace() {
  const { isLoaded, isSignedIn, orgId } = useAuth();
  if (!isLoaded || !isSignedIn || orgId) return null;
  return (
    <Link href={WORKSPACE_SETUP_ROUTE} className="inline-flex min-h-[44px] items-center rounded-full bg-black px-5 text-white">
      Create workspace
    </Link>
  );
}
