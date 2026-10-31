import { describe, expect, it, vi } from "vitest";

import { rateLimitMessage, resolveSiteInquiryMode, submitSiteInquiry, validateSiteInquiry } from "./site-inquiry";

const input = { name: "Dana Smith", phone: "(918) 555-0142", email: "", message: "", service: "AC repair", zip: "74103" };
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers })) as unknown as typeof fetch;

describe("site inquiry (contract #268)", () => {
  it("falls back to booking-submit unless the API flag is on", () => {
    expect(resolveSiteInquiryMode({} as NodeJS.ProcessEnv)).toBe("booking-submit");
    expect(resolveSiteInquiryMode({ SITE_INQUIRY_API_ENABLED: "true" } as unknown as NodeJS.ProcessEnv)).toBe("inquiry-api");
  });

  it("validates per field with the contract messages", () => {
    expect(validateSiteInquiry({ name: " ", phone: "123", email: "jordan@" })).toEqual({
      name: "Name is required",
      phone: "Enter a valid 10-digit US phone number",
      email: "Enter a valid email address"
    });
    expect(validateSiteInquiry({ name: "A", phone: "1-918-555-0142", email: "" })).toEqual({});
  });

  it("posts only contract keys with an empty honeypot and returns the reference", async () => {
    const fetchImpl = reply(201, { inquiry: { status: "received", referenceNumber: "BK-1" } });
    expect(await submitSiteInquiry("summit", input, fetchImpl)).toEqual({ kind: "sent", referenceNumber: "BK-1" });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("/api/v1/public/site/summit/inquiry");
    expect(JSON.parse(init.body)).toEqual({ name: "Dana Smith", phone: "(918) 555-0142", zip: "74103", service: "AC repair", website: "" });
  });

  it("maps errors[] by field; non-card fields become the form error", async () => {
    const result = await submitSiteInquiry(
      "summit",
      input,
      reply(400, { message: "Please fix the highlighted fields.", errors: [
        { field: "phone", message: "Enter a valid 10-digit US phone number" },
        { field: "zip", message: "We don't currently serve this ZIP code" }
      ] })
    );
    expect(result).toEqual({
      kind: "invalid",
      fieldErrors: { phone: "Enter a valid 10-digit US phone number" },
      formError: "We don't currently serve this ZIP code"
    });
  });

  it("handles 429 Retry-After and 404 shop not found", async () => {
    expect(await submitSiteInquiry("s", input, reply(429, {}, { "Retry-After": "90" }))).toEqual({ kind: "rate_limited", retryAfterSeconds: 90 });
    expect(rateLimitMessage(90)).toBe("Too many inquiries. Please try again in 2 minutes.");
    expect(await submitSiteInquiry("s", input, reply(404, { message: "Shop not found" }))).toEqual({ kind: "not_found" });
  });
});
