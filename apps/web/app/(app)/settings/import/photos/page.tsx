import { redirect } from "next/navigation";

import { MigratePhotoLinkPreviewClient } from "@/src/components/migrate-photo/MigratePhotoLinkPreviewClient";
import { getDefaultRouteForRole } from "@/src/lib/route-access";
import { requireServerSession } from "@/src/lib/server-session";

export const metadata = {
  title: "Photo import link preview"
};

interface PhotosImportPageProps {
  searchParams: Promise<{ bundleId?: string }>;
}

export default async function PhotosImportPage({ searchParams }: PhotosImportPageProps) {
  const session = await requireServerSession();
  const params = await searchParams;

  if (session.role !== "owner" && session.role !== "admin") {
    redirect(getDefaultRouteForRole(session.role));
  }

  const bundleId = params.bundleId;
  if (!bundleId) {
    return (
      <div className="p-6 text-sm text-neutral-700">
        Open this page with <code className="rounded bg-neutral-100 px-1">?bundleId=&lt;import-bundle-uuid&gt;</code> from
        the migrate onboarding wizard.
      </div>
    );
  }

  return <MigratePhotoLinkPreviewClient bundleId={bundleId} />;
}
