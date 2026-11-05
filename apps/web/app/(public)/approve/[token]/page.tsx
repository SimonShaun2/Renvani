"use client";

import { useParams } from "next/navigation";
import { PublicEstimateFlow } from "@/src/components/estimates/PublicEstimateFlow";

export default function PublicEstimatePage() {
  const params = useParams<{ token: string }>();
  // A different approval link must not inherit the previous link's acknowledgement.
  return <PublicEstimateFlow key={params.token} token={params.token} />;
}
