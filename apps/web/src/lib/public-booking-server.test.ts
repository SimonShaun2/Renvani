import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchPublicBookingSettingsBySlug } from "@/src/lib/public-booking-server";

describe("fetchPublicBookingSettingsBySlug", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("fails closed without calling fetch when the slug is unsafe", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchPublicBookingSettingsBySlug("..%2fadmin");

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
