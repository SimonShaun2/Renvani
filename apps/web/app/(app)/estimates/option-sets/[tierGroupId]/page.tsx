"use client";

import { useParams } from "next/navigation";

import { EstimateOptionSetClient } from "@/src/components/estimate-option-sets/EstimateOptionSetClient";

export default function EstimateOptionSetPage() {
  const params = useParams<{ tierGroupId: string }>();

  return <EstimateOptionSetClient tierGroupId={params.tierGroupId} />;
}
