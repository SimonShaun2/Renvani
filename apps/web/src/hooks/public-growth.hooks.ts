"use client";

import { useMutation } from "@tanstack/react-query";
import { publicApi } from "@/src/lib/public-api";

/** `POST /api/v1/public/booking/:slug/serves-zip` (API #320): in/out only, no ZIP list or counts. */
export function useServesZip(slug: string) {
  return useMutation({
    mutationFn: (zip: string) => publicApi.post<{ served: boolean }>(`/api/v1/public/booking/${slug}/serves-zip`, { zip })
  });
}
