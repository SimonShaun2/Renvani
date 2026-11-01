"use client";

import { useParams } from "next/navigation";

import { RecurringSeriesClient } from "@/src/components/recurring-series/RecurringSeriesClient";

export default function RecurringSeriesPage() {
  const params = useParams<{ seriesId: string }>();

  return <RecurringSeriesClient seriesId={params.seriesId} />;
}
