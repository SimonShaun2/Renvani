import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const provider = vi.hoisted(() => ({ fetch: vi.fn(), createClient: vi.fn(), notFound: vi.fn() }));
vi.mock("next-sanity", () => ({ createClient: (options: unknown) => {
  provider.createClient(options);
  return { fetch: provider.fetch };
} }));
vi.mock("next/navigation", () => ({ notFound: () => {
  provider.notFound();
  throw new Error("NEXT_NOT_FOUND");
} }));
vi.mock("@/src/components/marketing/cms/CmsArticle", () => ({ CmsArticle: () => null }));

import { fetchCmsDoc, fetchCmsList, fetchCmsSlugs } from "./fetch";
import { CmsReadError } from "./read-result";
import { cmsMetadata } from "@/src/lib/seo/cms-seo";

const keys = ["NEXT_PUBLIC_SANITY_PROJECT_ID", "NEXT_PUBLIC_SANITY_DATASET", "SANITY_API_READ_TOKEN", "VERCEL_ENV", "VERCEL_TARGET_ENV", "PUBLIC_SITE_URL"] as const;
const previous: Partial<Record<(typeof keys)[number], string | undefined>> = {};
const production = { VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://getrenvani.com" } as unknown as NodeJS.ProcessEnv;
const document = { title: "Booking guide", slug: "booking-guide", excerpt: "Useful guidance." };
const configure = () => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = "test-project";
  process.env.NEXT_PUBLIC_SANITY_DATASET = "production";
};

beforeEach(() => {
  for (const key of keys) { previous[key] = process.env[key]; delete process.env[key]; }
  provider.fetch.mockReset(); provider.createClient.mockReset(); provider.notFound.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  for (const key of keys) {
    if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key];
  }
  vi.restoreAllMocks();
});

describe("CMS reliability and indexability", () => {
  it("does not request an unconfigured CMS", async () => {
    expect(await fetchCmsList("post")).toEqual([]);
    expect(await fetchCmsDoc("post", "missing")).toBeNull();
    expect(await fetchCmsSlugs()).toEqual([]);
    expect(provider.createClient).not.toHaveBeenCalled();
  });
  it("preserves genuine empty or missing results", async () => {
    configure(); provider.fetch.mockResolvedValue(null);
    expect(await fetchCmsList("post")).toEqual([]);
    expect(await fetchCmsDoc("post", "missing")).toBeNull();
  });
  it("throws a sanitized outage rather than an empty collection or missing article", async () => {
    configure(); provider.fetch.mockRejectedValue(new Error("PRIVATE token=do-not-log"));
    await expect(fetchCmsList("post")).rejects.toBeInstanceOf(CmsReadError);
    await expect(fetchCmsDoc("post", "private-slug")).rejects.toMatchObject({ code: "CMS_READ_UNAVAILABLE" });
    await expect(fetchCmsSlugs()).rejects.toMatchObject({ message: "Published content is temporarily unavailable." });
    expect(console.error).toHaveBeenCalledWith("[sanity] configured CMS read failed", { code: "CMS_READ_UNAVAILABLE" });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toMatch(/PRIVATE|do-not-log|private-slug/);
  });
  it("keeps published perspective and existing cache tags", async () => {
    configure(); provider.fetch.mockResolvedValue(document);
    expect(await fetchCmsDoc("post", "booking-guide")).toEqual(document);
    expect(provider.createClient).toHaveBeenCalledWith(expect.objectContaining({ perspective: "published", useCdn: true }));
    expect(provider.fetch).toHaveBeenCalledWith(expect.any(String), { slug: "booking-guide" }, { next: { revalidate: 60, tags: ["post", "post:booking-guide"] } });
  });
  it.each(["preview", "development", "staging"])("blocks article and comparison indexing in %s", (environment) => {
    for (const type of ["post", "comparisonPage"] as const) {
      expect(cmsMetadata(type, document, { ...production, VERCEL_ENV: environment }).robots).toEqual({ index: false, follow: false });
    }
  });
  it("honors a conflicting custom target", () => {
    expect(cmsMetadata("post", document, { ...production, VERCEL_TARGET_ENV: "qa" }).robots).toEqual({ index: false, follow: false });
  });
  it("permits production and preserves canonical fallback compatibility", () => {
    expect(cmsMetadata("post", document, production)).toMatchObject({ robots: { index: true, follow: true }, alternates: { canonical: "https://getrenvani.com/blog/booking-guide" } });
    expect(cmsMetadata("post", document, {} as NodeJS.ProcessEnv)).toMatchObject({ robots: { index: false, follow: false }, alternates: { canonical: "/blog/booking-guide" } });
  });
  it("guards the blog index without changing its rendered markup", async () => {
    const { generateMetadata } = await import("@/app/(marketing)/blog/page");
    expect(generateMetadata().robots).toEqual({ index: false, follow: false });
    process.env.VERCEL_ENV = "production";
    expect(generateMetadata().alternates?.canonical).toBe("https://getrenvani.com/blog");
  });
  it("does not convert a provider outage into an article notFound call", async () => {
    configure(); provider.fetch.mockRejectedValue(new Error("provider unavailable"));
    const { default: Page } = await import("@/app/(marketing)/blog/[slug]/page");
    await expect(Page({ params: Promise.resolve({ slug: "booking-guide" }) })).rejects.toBeInstanceOf(CmsReadError);
    expect(provider.notFound).not.toHaveBeenCalled();
  });
});
