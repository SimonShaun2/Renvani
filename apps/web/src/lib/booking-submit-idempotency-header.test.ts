import { afterEach, describe, expect, it, vi } from "vitest";

import { publicApi } from "@/src/lib/public-api";

describe("public booking submit Idempotency-Key header (FS-38)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards Idempotency-Key on POST submit", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        bookingRequest: { id: "br-1", referenceNumber: "BK-1", status: "pending" },
        confirmation: { referenceNumber: "BK-1", status: "pending", companyName: "Acme", scheduledStart: null, scheduledEnd: null }
      })
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {} as Window);

    await publicApi.post(
      "/api/v1/public/booking/acme-hvac/submit?src=google",
      { firstName: "Jamie" },
      { headers: { "Idempotency-Key": "idem-key-12345678" } }
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = new Headers(init.headers);

    expect(headers.get("Idempotency-Key")).toBe("idem-key-12345678");
  });
});
