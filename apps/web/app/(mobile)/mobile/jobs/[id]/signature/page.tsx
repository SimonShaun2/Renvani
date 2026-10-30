import { CrewSignature } from "@/src/components/mobile/CrewSignature";

/** Figma 303:87 "Crew / Technician signature (/crew/jobs/:id/signature)" mapped to the existing /mobile/jobs/[id] tree. */
export default async function MobileJobSignaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CrewSignature jobId={id} />;
}
