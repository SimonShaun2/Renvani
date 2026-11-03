import { JobsListClient } from "@/src/components/jobs/JobsListClient";
import { parseNewJobQuery } from "@/src/components/jobs/newJob.config";

interface JobsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const newJob = parseNewJobQuery(await searchParams);
  return <JobsListClient newJob={newJob} />;
}
