import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();
vi.mock("next-sanity", () => ({ createClient: () => ({ fetch: fetchMock }) }));


const revalidateTag = vi.fn();
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag: (t: string) => revalidateTag(t), revalidatePath: (p: string) => revalidatePath(p) }));

class NotFound extends Error {}
class Redirect extends Error {}
vi.mock("next/navigation", () => ({
  notFound: () => { throw new NotFound("NEXT_NOT_FOUND"); },
  redirect: (to: string) => { throw new Redirect(to); }
}));

const authMock = vi.fn();
vi.mock("@clerk/nextjs/server", () => ({ auth: () => authMock() }));
const legacySessionMock = vi.fn();
vi.mock("@/src/lib/server-session", () => ({ getServerSession: () => legacySessionMock() }));
vi.mock("@/app/studio/[[...tool]]/Studio", () => ({ Studio: () => <div data-testid="studio" /> }));
vi.mock("next-sanity/studio", () => ({ metadata: {}, viewport: {} }));

import { schemaTypes } from "./schemas";
import { buildCmsSitemap } from "@/src/lib/seo/public-sitemap";
import { cmsJsonLd, cmsMetadata } from "@/src/lib/seo/cms-seo";
import type { CmsDoc } from "./fetch";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { readSanityEnv } from "./env";
import { signSanityPayload, verifySanitySignature } from "./webhook-signature";

const ENV_KEYS = ["NEXT_PUBLIC_SANITY_PROJECT_ID", "NEXT_PUBLIC_SANITY_DATASET", "SANITY_API_READ_TOKEN", "SANITY_REVALIDATE_SECRET", "PUBLIC_SITE_URL", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] as const;
const saved: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  fetchMock.mockReset();
  revalidateTag.mockReset();
  revalidatePath.mockReset();
  authMock.mockReset();
  legacySessionMock.mockReset();
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
  metaTitle: "Booking tips for HVAC shops | Renvani",
  metaDescription: "Fill the schedule with fewer calls.",
  targetKeyword: "hvac booking",
  excerpt: "How home-service shops book more jobs with fewer phone calls.",
  featuredImage: { url: "https://cdn.sanity.io/images/p/d/hero.jpg", alt: "Technician checking a booking on a tablet" },
  author: "Renvani team",
  publishedAt: "2026-11-01T00:00:00Z",
  updatedAt: "2026-11-03T00:00:00Z",
  body: [
    { _type: "block", _key: "a", style: "normal", markDefs: [], children: [{ _type: "span", _key: "b", text: "Answer every request fast.", marks: [] }] },
    { _type: "block", _key: "h", style: "h2", markDefs: [], children: [{ _type: "span", _key: "h1", text: "Book online", marks: [] }] },
    { _type: "block", _key: "l", style: "normal", listItem: "bullet", level: 1, markDefs: [], children: [{ _type: "span", _key: "l1", text: "Send reminders", marks: [] }] },
    { _type: "inlineImage", _key: "i", url: "https://cdn.sanity.io/images/p/d/inline.jpg", alt: "Schedule view on a phone" }
  ] as NonNullable<CmsDoc["body"]>,
  relatedPosts: [{ title: "Reminder texts that work", slug: "reminder-texts" }],
  cta: { label: "Book a demo", href: "/demo" },
  faq: [{ question: "Do I need a website?", answer: "No. Your booking page works on its own." }]
};

type Field = { name: string; type: string; of?: { type?: string; name?: string; styles?: { value: string }[]; lists?: { value: string }[]; fields?: Field[] }[]; fields?: Field[]; validation?: unknown };
const fieldsOf = (name: string) => (schemaTypes.find((t) => t.name === name) as unknown as { fields: Field[] }).fields;
const isRequired = (f: Field | undefined) => {
  const calls: string[] = [];
  const rule: Record<string, (...a: unknown[]) => unknown> = new Proxy({}, { get: (_, k: string) => () => { calls.push(k); return rule; } });
  (f?.validation as ((r: unknown) => unknown) | undefined)?.(rule);
  return calls.includes("required");
};

describe("Sanity schemas", () => {
  it("post has every SEO article field", () => {
    expect(fieldsOf("post").map((f) => f.name)).toEqual([
      "title", "slug", "metaTitle", "metaDescription", "targetKeyword", "excerpt", "featuredImage", "author",
      "publishedAt", "updatedAt", "body", "relatedPosts", "cta", "faq"
    ]);
  });

  it("featured image and inline body images require alt text", () => {
    const featured = fieldsOf("post").find((f) => f.name === "featuredImage")!;
    expect(featured.type).toBe("image");
    expect(isRequired(featured.fields!.find((f) => f.name === "alt"))).toBe(true);
    const inline = fieldsOf("post").find((f) => f.name === "body")!.of!.find((m) => m.name === "inlineImage")!;
    expect(inline.type).toBe("image");
    expect(isRequired(inline.fields!.find((f) => f.name === "alt"))).toBe(true);
  });

  it("body is Portable Text with H2/H3 and bullet/numbered lists", () => {
    const block = fieldsOf("post").find((f) => f.name === "body")!.of!.find((m) => m.type === "block")!;
    expect(block.styles!.map((x) => x.value)).toEqual(expect.arrayContaining(["normal", "h2", "h3"]));
    expect(block.lists!.map((x) => x.value)).toEqual(["bullet", "number"]);
  });

  it("relatedPosts references posts; cta has label + href; faq is question/answer items", () => {
    const post = fieldsOf("post");
    const related = post.find((f) => f.name === "relatedPosts")!;
    expect(related.of![0]).toMatchObject({ type: "reference", to: [{ type: "post" }] });
    expect(post.find((f) => f.name === "cta")!.fields!.map((f) => f.name)).toEqual(["label", "href"]);
    expect(post.find((f) => f.name === "faq")!.of![0]!.fields!.map((f) => f.name)).toEqual(["question", "answer"]);
    expect(["title", "slug"].every((n) => isRequired(post.find((f) => f.name === n)))).toBe(true);
  });

  it("comparisonPage keeps its SEO fields and no hard-coded product names", () => {
    expect(fieldsOf("comparisonPage").map((f) => f.name)).toEqual(["title", "slug", "metaTitle", "metaDescription", "ogImage", "publishedAt", "body", "faq"]);
    const src = readFileSync(join(__dirname, "schemas/fields.ts"), "utf8") + readFileSync(join(__dirname, "schemas/index.ts"), "utf8");
    expect(src).not.toMatch(/jobber|servicetitan|housecall|service fusion|fieldedge|owner\.com|broccoli/i);
    expect(src).toContain("Service Fee is 5%");
  });
});

describe("Sanity public env", () => {
  it("reads NEXT_PUBLIC_* with literal process.env property access (inlined by Next)", () => {
    const src = readFileSync(join(__dirname, "env.ts"), "utf8");
    expect(src).toContain("process.env.NEXT_PUBLIC_SANITY_PROJECT_ID");
    expect(src).toContain("process.env.NEXT_PUBLIC_SANITY_DATASET");
    expect(src).not.toMatch(/process\.env\[|=\s*process\.env\s*[;)]|\}\s*=\s*process\.env|env\s*:\s*NodeJS\.ProcessEnv/);
    expect(readSanityEnv()).toBeNull();
    configure();
    expect(readSanityEnv()).toEqual({ projectId: "proj123", dataset: "production" });
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
    expect(fetchMock.mock.calls[0]![0]).toMatch(/targetKeyword.*excerpt.*featuredImage.*author.*updatedAt.*relatedPosts.*cta.*faq/s);
    expect(getByRole("heading", { level: 2, name: "Book online" })).toBeTruthy();
    expect(container.querySelector("ul li")?.textContent).toBe("Send reminders");
    expect(container.querySelector("[data-featured-image]")?.getAttribute("alt")).toBe(doc.featuredImage!.alt);
    expect(container.querySelector('img[alt="Schedule view on a phone"]')).toBeTruthy();
    expect(container.textContent).toContain(doc.excerpt!);
    expect(container.textContent).toContain("Renvani team");
    expect(container.querySelector("[data-cms-cta]")?.getAttribute("href")).toBe("/demo");
    expect(container.querySelector('a[href="/blog/reminder-texts"]')).toBeTruthy();
  });
});

describe("CMS metadata and JSON-LD", () => {
  it("sets title, description, absolute canonical and OG article fields", () => {
    const md = cmsMetadata("comparisonPage", doc, { VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://getrenvani.com" } as unknown as NodeJS.ProcessEnv);
    expect(md.title).toBe(doc.metaTitle);
    expect(md.description).toBe(doc.metaDescription);
    expect(md.alternates?.canonical).toBe("https://getrenvani.com/compare/booking-tips");
    expect(md.openGraph).toMatchObject({ type: "article", url: "https://getrenvani.com/compare/booking-tips" });
  });

  it("falls back to a relative canonical without PUBLIC_SITE_URL", () => {
    expect(cmsMetadata("post", doc, {} as unknown as NodeJS.ProcessEnv).alternates?.canonical).toBe("/blog/booking-tips");
  });

  it("emits Article always and FAQPage only with FAQ items", () => {
    const [article, faq] = cmsJsonLd("post", doc, {} as unknown as NodeJS.ProcessEnv);
    expect(article).toMatchObject({
      "@type": "Article",
      headline: doc.metaTitle,
      datePublished: doc.publishedAt,
      dateModified: doc.updatedAt,
      image: [doc.featuredImage!.url],
      author: { "@type": "Person", name: "Renvani team" },
      keywords: "hvac booking"
    });
    expect(faq).toMatchObject({ "@type": "FAQPage", mainEntity: [{ "@type": "Question", name: "Do I need a website?" }] });
    expect(cmsJsonLd("post", { ...doc, faq: [] }, {} as unknown as NodeJS.ProcessEnv)).toHaveLength(1);
    expect(cmsJsonLd("post", { ...doc, faq: null }, {} as unknown as NodeJS.ProcessEnv).map((x) => x["@type"])).toEqual(["Article"]);
    expect(cmsJsonLd("post", { ...doc, faq: [{ question: "", answer: "" }] }, {} as unknown as NodeJS.ProcessEnv)).toHaveLength(1);
  });
});

describe("POST /api/revalidate (raw-body HMAC, constant time, before JSON)", () => {
  const SECRET = "test-webhook-secret";
  const body = JSON.stringify({ _type: "post", slug: { current: "booking-tips" } });
  const req = (raw: string, signature?: string | null) =>
    new Request("https://x.test/api/revalidate", { method: "POST", body: raw, headers: signature ? { "sanity-webhook-signature": signature } : {} }) as never;
  const load = async () => (await import("@/app/api/revalidate/route")).POST;

  it("accepts a valid Sanity signature and revalidates type + slug tags and paths", async () => {
    process.env.SANITY_REVALIDATE_SECRET = SECRET;
    const res = await (await load())(req(body, signSanityPayload(body, SECRET)));
    expect(res.status).toBe(200);
    expect(revalidateTag.mock.calls.map((c) => c[0])).toEqual(["post", "post:booking-tips"]);
    expect(revalidatePath.mock.calls.map((c) => c[0])).toEqual(["/blog", "/blog/booking-tips"]);
  });

  it.each([
    ["missing", null],
    ["malformed", "v1=abc"],
    ["wrong length", "t=1700000000000,v1=short"],
    ["signed with another secret", signSanityPayload(body, "other-secret")],
    ["signed over a different body", signSanityPayload("{}", SECRET)]
  ])("rejects a %s signature with 401 and never revalidates", async (_, sig) => {
    process.env.SANITY_REVALIDATE_SECRET = SECRET;
    const POST = await load();
    const parse = vi.spyOn(JSON, "parse");
    const res = await POST(req(body, sig));
    expect(res.status).toBe(401);
    expect(parse.mock.calls.filter((c) => c[0] === body)).toHaveLength(0);
    parse.mockRestore();
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([["unset", undefined], ["empty", ""], ["blank", "   "]])("fails closed when the secret is %s", async (_, secret) => {
    if (secret !== undefined) process.env.SANITY_REVALIDATE_SECRET = secret;
    expect((await (await load())(req(body, signSanityPayload(body, "x")))).status).toBe(401);
    expect(verifySanitySignature(body, signSanityPayload(body, "x"), secret)).not.toBe("valid");
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON with a valid signature", async () => {
    process.env.SANITY_REVALIDATE_SECRET = SECRET;
    const raw = "{not json";
    expect((await (await load())(req(raw, signSanityPayload(raw, SECRET)))).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it.each([
    ["inherited type key", { _type: "toString" }],
    ["unknown type", { _type: "page" }],
    ["dot-segment slug", { _type: "post", slug: "../admin" }],
    ["non-string slug", { _type: "post", slug: { current: 42 } }],
    ["overlong slug", { _type: "post", slug: "a".repeat(97) }]
  ])("rejects a signed payload with %s (400)", async (_, payload) => {
    process.env.SANITY_REVALIDATE_SECRET = SECRET;
    const raw = JSON.stringify(payload);
    expect((await (await load())(req(raw, signSanityPayload(raw, SECRET)))).status).toBe(400);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});

describe("Studio page gate (verified Clerk auth only)", () => {
  const load = async () => (await import("@/app/studio/[[...tool]]/page")).default;
  beforeEach(() => { process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_fake"; });

  it.each([["owner"], ["admin"], ["office"]])("renders the Studio for a verified Clerk %s", async (role) => {
    authMock.mockResolvedValue({ userId: "user_1", sessionClaims: { metadata: { role } } });
    const { getByTestId } = render(await (await load())());
    expect(getByTestId("studio")).toBeTruthy();
  });

  it("sends a request with no auth at all to sign in", async () => {
    authMock.mockResolvedValue({ userId: null, sessionClaims: null });
    await expect((await load())()).rejects.toBeInstanceOf(Redirect);
  });

  it("ignores a legacy (unverified) owner session entirely", async () => {
    legacySessionMock.mockResolvedValue({ status: "ok", source: "legacy", session: { role: "owner" } });
    authMock.mockResolvedValue({ userId: null, sessionClaims: null });
    await expect((await load())()).rejects.toBeInstanceOf(Redirect);
    expect(legacySessionMock).not.toHaveBeenCalled();
  });

  it.each([["technician"], ["dispatcher"], [undefined]])("never renders the Studio for a signed-in %s", async (role) => {
    authMock.mockResolvedValue({ userId: "user_1", sessionClaims: role ? { metadata: { role } } : {} });
    await expect((await load())()).rejects.toBeInstanceOf(NotFound);
  });

  it("ignores a top-level role claim (metadata.role only)", async () => {
    authMock.mockResolvedValue({ userId: "user_1", sessionClaims: { role: "owner" } });
    await expect((await load())()).rejects.toBeInstanceOf(NotFound);
  });

  it("denies when Clerk is not configured", async () => {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    await expect((await load())()).rejects.toBeInstanceOf(Redirect);
    expect(authMock).not.toHaveBeenCalled();
  });
});

describe("CMS sitemap entries", () => {
  it("lists /blog plus every published post and comparison slug", async () => {
    const entries = await buildCmsSitemap({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://getrenvani.com" } as unknown as NodeJS.ProcessEnv, async () => [
      { _type: "post", slug: "booking-tips", _updatedAt: "2026-11-02T00:00:00Z" },
      { _type: "comparisonPage", slug: "switching-guide" }
    ]);
    expect(entries.map((e) => e.url)).toEqual([
      "https://getrenvani.com/blog",
      "https://getrenvani.com/blog/booking-tips",
      "https://getrenvani.com/compare/switching-guide"
    ]);
  });

  it("is empty without PUBLIC_SITE_URL and only /blog without CMS content", async () => {
    expect(await buildCmsSitemap({} as unknown as NodeJS.ProcessEnv, async () => [{ _type: "post", slug: "x" }])).toEqual([]);
    expect((await buildCmsSitemap({ VERCEL_ENV: "production", PUBLIC_SITE_URL: "https://getrenvani.com" } as unknown as NodeJS.ProcessEnv, async () => [])).map((e) => e.url)).toEqual(["https://getrenvani.com/blog"]);
  });
});
