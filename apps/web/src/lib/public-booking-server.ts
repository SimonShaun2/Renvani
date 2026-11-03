import type { PublicBookingSettingsRecord } from "@/src/hooks/booking.hooks";
import { resolvePublicApiBase } from "@/src/lib/public-api";
import { assertSafePublicBookingSlug } from "@/src/lib/public-api-path-security";

interface PublicBookingResponse {
  booking: PublicBookingSettingsRecord;
}

export async function fetchPublicBookingSettingsBySlug(
  slug: string
): Promise<PublicBookingSettingsRecord | null> {
  try {
    assertSafePublicBookingSlug(slug);
  } catch {
    return null;
  }

  const response = await fetch(
    `${resolvePublicApiBase()}/api/v1/public/booking/${encodeURIComponent(slug)}`,
    {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 60 }
    }
  );

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Public booking settings request failed (${response.status})`);
  }

  const payload = (await response.json()) as PublicBookingResponse;
  return payload.booking;
}
