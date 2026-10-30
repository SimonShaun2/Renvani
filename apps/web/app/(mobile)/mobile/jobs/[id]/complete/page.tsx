import { CrewFinishJob } from "@/src/components/mobile/CrewFinishJob";

export default async function MobileJobCompletePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <CrewFinishJob jobId={id} />;
}
