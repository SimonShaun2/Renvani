import { CrewSignature } from "@/src/components/mobile/CrewSignature";

/** Legacy entry (`/mobile/signature?jobId=`), used by JobStatusTransitions. Same screen as /mobile/jobs/[id]/signature. */
export default async function MobileSignaturePage({ searchParams }: { searchParams: Promise<{ jobId?: string | string[] }> }) {
  const { jobId } = await searchParams;
  const id = Array.isArray(jobId) ? jobId[0] : jobId;
  return <CrewSignature jobId={id ?? null} />;
}
