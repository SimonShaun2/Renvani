import { describe, expect, it } from "vitest";

import { clientKey, createFixedWindowLimiter } from "@/src/lib/inquiry-rate-limit";

import { generateServiceCopy, openAiCopyProvider, toPlainText, type ServiceCopyProvider } from "./copy-providers";
import {
  hoursChip,
  nearbyServicePages,
  serviceEyebrow,
  listServiceAreaPages, resolveServiceAreaPage, serviceAreaPath, slugifyService
} from "./service-area-pages";

const settings = {
  offeredServices: [{ label: "AC Tune-up", priceHint: "from $129" }, { label: "Water heater" }],
  serviceAreaZipCodes: ["78704", "78745", "bad"]
};
const env = (vars: Record<string, string>) => vars as unknown as NodeJS.ProcessEnv;
const input = { companyName: "Summit", service: "AC Tune-up", area: "78704", priceHint: "from $129" };

describe("service x area pages", () => {
  it("generates services x valid ZIPs", () => {
    const pages = listServiceAreaPages(settings);
    expect(pages).toHaveLength(4);
    expect(serviceAreaPath("summit", pages[0]!)).toBe("/site/summit/ac-tune-up/78704");
  });

  it("404s (null) for services or areas the shop does not offer", () => {
    expect(resolveServiceAreaPage(settings, "ac-tune-up", "78704")?.service.title).toBe("AC Tune-up");
    expect(resolveServiceAreaPage(settings, "ac-tune-up", "10001")).toBeNull();
    expect(resolveServiceAreaPage(settings, "roofing", "78704")).toBeNull();
    expect(slugifyService("Move-in / Move-out!")).toBe("move-in-move-out");
  });
});

describe("copy providers", () => {
  it("uses the template fixture when no OpenAI key is set", async () => {
    const copy = await generateServiceCopy(input, env({}));
    expect(copy.provider).toBe("template");
    expect(copy.headline).toBe("AC Tune-up in 78704");
    expect(copy.intro).toBe(
      "Need ac tune-up in 78704? Summit sends a licensed tech to homes across 78704 with clear, upfront pricing. Pick a time online and get your confirmation by email."
    );
  });

  it("keeps the OpenAI adapter disabled without both key and approval", () => {
    expect(openAiCopyProvider.enabled(env({ OPENAI_API_KEY: "x" }))).toBe(false);
    expect(openAiCopyProvider.enabled(env({ SERVICE_PAGE_AI_COPY_APPROVED: "true" }))).toBe(false);
    expect(openAiCopyProvider.enabled(env({ OPENAI_API_KEY: "x", SERVICE_PAGE_AI_COPY_APPROVED: "true" }))).toBe(true);
  });

  it("falls back to the template when a provider fails", async () => {
    const broken: ServiceCopyProvider = { key: "broken", enabled: () => true, generate: async () => null };
    expect((await generateServiceCopy(input, env({}), [broken])).provider).toBe("template");
  });

  it("strips markup from generated text", () => {
    expect(toPlainText("<script>x</script>Hi\u2028there <b>you</b>")).toBe("xHi there you");
  });
});

describe("inquiry rate limit", () => {
  it("allows the limit then blocks with Retry-After, per key, and resets", () => {
    const limiter = createFixedWindowLimiter(2, 1000);
    expect(limiter.check("a", 0).ok).toBe(true);
    expect(limiter.check("a", 1).ok).toBe(true);
    expect(limiter.check("a", 2)).toEqual({ ok: false, retryAfterSeconds: 1 });
    expect(limiter.check("b", 2).ok).toBe(true);
    expect(limiter.check("a", 1001).ok).toBe(true);
  });

  it("keys by the edge-set IP, never a spoofable left-most forwarded value", () => {
    expect(clientKey(new Headers({ "x-vercel-forwarded-for": "9.9.9.9", "x-forwarded-for": "1.1.1.1, 9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientKey(new Headers({ "x-real-ip": "8.8.8.8", "x-forwarded-for": "1.1.1.1" }))).toBe("8.8.8.8");
    expect(clientKey(new Headers({ "x-forwarded-for": "6.6.6.6, 10.0.0.1" }))).toBe("10.0.0.1");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});

describe("155:79 page helpers", () => {
  it("lists other services in the same ZIP as nearby", () => {
    expect(nearbyServicePages(settings, { serviceSlug: "ac-tune-up", area: "78704" }).map((p) => p.serviceSlug)).toEqual([
      "water-heater"
    ]);
  });

  it("builds the eyebrow from the first service-area name when present", () => {
    expect(serviceEyebrow("Summit", { serviceAreaNames: ["Austin", "Round Rock"] })).toBe("Summit · Austin");
    expect(serviceEyebrow("Summit", {})).toBe("Summit");
  });

  it("collapses booking days into an hours chip", () => {
    const base = { availableHoursStart: 7, availableHoursEnd: 18 };
    expect(hoursChip({ ...base, availableDays: ["mon", "tue", "wed", "thu", "fri"] })).toBe("Mon–Fri 7am–6pm");
    expect(hoursChip({ ...base, availableDays: ["mon", "wed", "thu", "sat"] })).toBe("Mon, Wed–Thu, Sat 7am–6pm");
    expect(hoursChip({ ...base, availableDays: [] })).toBeNull();
  });
});
