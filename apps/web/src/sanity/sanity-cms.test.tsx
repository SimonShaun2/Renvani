import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.mock("next-sanity", () => ({ createClient: () => ({ fetch: fetchMock }) }));

const parseBodyMock = vi.fn();
vi.mock("next-sanity/webhook", () => ({ parseBody: (...args: unknown[]) => parseBodyMock(...args) }));

const revalidateTag = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (t: string) => revalidateTag(t), revalidatePath: (p: string) => revalidatePath(p) }));

class NotFound extends Error {}
vi.mock("next/navigation", () => ({ notFound: () => { throw new NotFound("NEXT_NOT_FOUND"); } }));

const sessionMock = vi.fn();
vi.mock("@/src/lib/server-session", () => ({ getServerSession: () => sessionMock() }));
vi.mock("@/app/studio/[[...tool]]/Studio", () => ({ Studio: () => <div data-testid="studio" /> }));
vi.mock("next-sanity/studio", () => ({ metadata: {}, viewport: {} }));

import { schemaTypes } from "./schemas";
import { buildCmsSitemap } from "@/src/lib/seo/public-sitemap";
import { cmsJsonLd, cmsMetadata } from "@/src/lib/seo/cms-seo";
import type { CmsDoc } from "./fetch";

const ENV_KEYS = ["NEXT_PUBLIC_SANITY_PROJECT_ID", "NEXT_PUBLIC_SANITY_DATASET", "SANITY_API_READ_TOKEN", "SANITY_REVALIDATE_SECRET", "PUBLIC_SITE_URL"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  fetchMock.mockReset();
  parseBodyMock.mockReset();
  revalidateTag.mockReset();
  revalidatePath.mockReset();
  sessionMock.mockReset();
});
afterEach(() => {
  cleanup();
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

const configure = () => {
  process.env.NEXT_PUBLIC_SANITY_PROJECT_ID = "proj123";
  process.env.NEXT_PUBLIC_SANITY_DATASET = "production";
};

const doc: CmsDoc = {
  title: "Booking tips for HVAC shops",
  slug: "booking-tips",
  seoTitle: "Booking tips for HVAC shops | Renvani",
  metaDescription: "Fill the schedule with fewer calls.",
  publishedAt: "2026-11-01T00:00:00Z",
  body: [{ _type: "block", _key: "a", style: "normal", markDefs: [], children: [{ _type: "span", _key: "b", text: "Answer every request fast.", marks: [] }] }],
  faq: [{ question: "Do I need a website?", answer: "No. Your booking page works on its own." }]
};

describe("Sanity schemas", () => {
  it("post and comparisonPage carry every SEO content field", () => {
    expect(schemaTypes.map((s) => s.name)).toEqual(["post", "comparisonPage"]);
    for (const schema of schemaTypes) {
      const fields = (schema as unknown as { fields: { name: string; type: string; of?: { fields?: { name: string }[] }[] }[] }).fields;
      expect(fields.map((f) => f.name)).toEqual(["title", "slug", "seoTitle", "metaDescription", "ogImage", "publishedAt", "body", "faq"]);
      expect(fields.find((f) => f.name === "body")!.type).toBe("array");
      expect(fields.find((f) => f.name === "faq")!.of![0]!.fields!.map((f) => f.name)).toEqual(["question", "answer"]);
    }
  });
});

describe("CMS routes", () => {
  it("/blog renders an empty state with no CMS env and never fetches", async () => {
    const { default: BlogIndex } = await import("@/app/(marketing)/blog/page");
    const { container } = render(await BlogIndex());
    expect(container.querySelector("[data-empty-state]")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("/blog renders an empty state when the CMS has no posts", async () => {
    configure();
    fetchMock.mockResolvedValue([]);
    const { default: BlogIndex } = await import("@/app/(marketing)/blog/page");
    const { container } = render(await BlogIndex());
    expect(container.querySelector("[data-empty-state]")).toBeTruthy();
    expect(fetchMock.mock.calls[0]![2]).toMatchObject({ next: { revalidate: 60, tags: ["post"] } });
  });

  it.each([["blog", "@/app/(marketing)/blog/[slug]/page"], ["compare", "@/app/(marketing)/compare/[slug]/page"]])("/%s/[slug] 404s with no CMS env or no document", async (_, path) => {
    const { default: Page, generateStaticParams } = await import(/* @vite-ignore */ path);
    expect(generateStaticParams()).toEqual([]);
    await expect(Page({ params: Promise.resolve({ slug: "missing" }) })).rejects.toBeInstanceOf(NotFound);
    configure();
    fetchMock.mockResolvedValue(null);
    await expect(Page({ params: Promise.resolve({ slug: "missing" }) })).rejects.toBeInstanceOf(NotFound);
  });

  it("/blog/[slug] renders the post with Portable Text, FAQ and JSON-LD, tagged by type and slug", async () => {
    configure();
    fetchMock.mockResolvedValue(doc);
    const { default: Page } = await import("@/app/(marketing)/blog/[slug]/page");
    const { container, getByRole } = render(await Page({ params: Promise.resolve({ slug: "booking-tips" }) }));
    expect(getByRole("heading", { level: 1 }).textContent).toBe(doc.title);
    expect(container.textContent).toContain("Answer every request fast.");
    const ld = [...container.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent!)["@type"]);
    expect(ld).toEqual(["Article", "FAQPage"]);
    expect(fetchMock.mock.calls[0]![2]).toMatchObject({ next: { tags: ["post", "post:booking-tips"] } });
  });
});

describe("CMS metadata and JSON-LD", () => {
  it("sets title, description, absolute canonical and OG article fields", () => {
    const md = cmsMetadata("comparisonPage", doc, { PUBLIC_SITE_URL: "https://getrenvani.com" } as unknown as NodeJS.ProcessEnv);
    expect(md.title).toBe(doc.seoTitle);
    expect(md.description).toBe(doc.metaDescription);
    expect(md.alternates?.canonical).toBe("https://getrenvani.com/compare/booking-tips");
    expect(md.openGraph).toMatchObject({ type: "article", url: "https://getrenvani.com/compare/booking-tips" });
  });

  it("falls back to a relative canonical without PUBLIC_SITE_URL", () => {
    expect(cmsMetadata("post", doc, {} as unknown as NodeJS.ProcessEnv).alternates?.canonical).toBe("/blog/booking-tips");
  });

  it("emits Article always and FAQPage only with FAQ items", () => {
    const [article, faq] = cmsJsonLd("post", doc, {} as unknown as NodeJS.ProcessEnv);
    expect(article).toMatchObject({ "@type": "Article", headline: doc.seoTitle, datePublished: doc.publishedAt });
    expect(faq).toMatchObject({ "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Do I need a website?" }] });
    expect(cmsJsonLd("post", { ...doc, faq: [] }, {} as unknown as NodeJS.ProcessEnv)).toHaveLength(1);
  });
});

describe("POST /api/revalidate", () => {
  const req = () => new Request("https://x.test/api/revalidate", { method: "POST", body: "{}" }) as never;

  it("returns 401 on a bad signature and when the secret is unset", async () => {
    const { POST } = await import("@/app/api/revalidate/route");
    expect((await POST(req())).status).toBe(401);
    process.env.SANITY_REVALIDATE_SECRET = "s";
    parseBodyMock.mockResolvedValue({ isValidSignature: false, body: null });
    expect((await POST(req())).status).toBe(401);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("returns 200 and revalidates type + slug tags and paths on a valid signature", async () => {
    const { POST } = await import("@/app/api/revalidate/route");
    process.env.SANITY_REVALIDATE_SECRET = "s";
    parseBodyMock.mockResolvedValue({ isValidSignature: true, body: { _type: "post", slug: { current: "booking-tips" } } });
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(parseBodyMock.mock.calls[0]![1]).toBe("s");
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual(["post", "post:booking-tips"]);
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(["/blog", "/blog/booking-tips"]);
  });
});

describe("Studio gate", () => {
  it.each([
    ["signed out", { status: "signed-out" }, false],
    ["no role", { status: "no-role" }, false],
    ["technician", { status: "ok", session: { role: "technician" } }, false],
    ["dispatcher", { status: "ok", session: { role: "dispatcher" } }, false],
    ["owner", { status: "ok", session: { role: "owner" } }, true],
    ["admin", { status: "ok", session: { role: "admin" } }, true],
    ["office staff", { status: "ok", session: { role: "office" } }, true]
  ])("%s", async (_, session, allowed) => {
    sessionMock.mockResolvedValue(session);
    const { default: StudioPage } = await import("@/app/studio/[[...tool]]/page");
    if (allowed) {
      const { getByTestId } = render(await StudioPage());
      expect(getByTestId("studio")).toBeTruthy();
    } else {
      await expect(StudioPage()).rejects.toBeInstanceOf(NotFound);
    }
  });
});

describe("CMS sitemap entries", () => {
  it("lists /blog plus every published post and comparison slug", async () => {
    const entries = await buildCmsSitemap({ PUBLIC_SITE_URL: "https://getrenvani.com" } as unknown as NodeJS.ProcessEnv, async () => [
      { _type: "post", slug: "booking-tips", _updatedAt: "2026-11-02T00:00:00Z" },
      { _type: "comparisonPage", slug: "switching-guide" }
    ]);
    expect(entries.map((e) => e.url)).toEqual([
      "https://getrenvani.com/blog",
      "https://getrenvani.com/blog/booking-tips",
      "https://getrenvani.com/compare/switching-guide"
    ]);
  });

  it("is empty without PUBLIC_SITE_URL or CMS content", async () => {
    expect(await buildCmsSitemap({} as unknown as NodeJS.ProcessEnv, async () => [{ _type: "post", slug: "x" }])).toEqual([]);
    expect(await buildCmsSitemap({ PUBLIC_SITE_URL: "https://getrenvani.com" } as unknown as NodeJS.ProcessEnv, async () => [])).toEqual([]);
  });
});
