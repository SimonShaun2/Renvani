/**
 * Page Sections content (Webflow CMS collection "Page Sections").
 *
 * Home and Pricing are fetched server-side from the Webflow Data API v2: the
 * staged endpoint (drafts included) on Vercel preview, the live endpoint
 * elsewhere. Fallback: snapshot (drafts filtered outside preview), then static copy.
 *
 * TODO(copy): HVAC (industries/hvac) still has "[Copy: …]" placeholders from Figma
 * in page-sections.products.json and they are hidden until written:
 *   - hero headline: "[Copy: HVAC headline, line 1] [Copy: headline, line 2]"
 *   - hero subhead: "[Copy: HVAC subhead: tune-ups, diagnostics, agreements and replacements]"
 *   - product-screens items: three "Value" cells "[Copy: value]"
 * Product pages and HVAC are static for now, stored in the same CMS shape
 * (`data/page-sections.products.json`) so they can move into the CMS later.
 *
 * `review-notes` is editorial only: it is dropped during mapping and is never
 * part of `PageSection`, so it cannot be rendered.
 */
import { webflowItemsUrl } from "./webflow-url";
import homePricingSnapshot from "./data/page-sections.home-pricing.json";
import productSnapshot from "./data/page-sections.products.json";

export type PageSection = {
  page: string;
  sectionKey: string;
  eyebrow?: string | undefined;
  headline?: string | undefined;
  subhead?: string | undefined;
  callout?: string | undefined;
  items: string[];
  ctaLabel?: string | undefined;
  ctaHref?: string | undefined;
  data?: unknown;
  sortOrder: number;
  figmaNode?: string | undefined;
};

type CmsItem = { isArchived?: boolean; isDraft?: boolean; fieldData: Record<string, unknown> };

/** Copy rules applied to every rendered CMS/static string. */
export function applyCopyRules(text: string): string {
  // Editorial "[confirm: …]" notes are never shown publicly.
  const out = text.replace(/\s*\[confirm:[^\]]*\]/gi, "");
  return out.trim();
}

/** Detects unfinished "[Copy: …]" placeholders. They are never rendered publicly. */
export function hasCopyPlaceholder(text: string | undefined): boolean {
  return !!text && /\[Copy:[^\]]*\]/i.test(text);
}

export const COMPETITORS = /servicetitan|housecall|jobber|service fusion|fieldedge|workiz/i;

function str(f: Record<string, unknown>, key: string): string | undefined {
  const v = f[key];
  if (typeof v !== "string") return undefined;
  const t = applyCopyRules(v);
  // Fields still holding a "[Copy: …]" placeholder are hidden, not rendered.
  return t && !hasCopyPlaceholder(t) ? t : undefined;
}

function parseData(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    const text = applyCopyRules(raw);
    if (hasCopyPlaceholder(text)) return undefined;
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

export const DEFAULT_BOOKING_FEE = "+ $1.99 booking fee on online bookings, paid at checkout";

export const DEFAULT_CTA_HREF = "/demo";

/** Allows only site-relative paths ("/x", not "//x") and https: URLs; anything else becomes /demo. */
export function safeHref(href: string | undefined): string | undefined {
  if (href === undefined) return undefined;
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//") && !h.startsWith("/\\")) return h;
  try {
    if (new URL(h).protocol === "https:") return h;
  } catch {
    /* not an absolute URL */
  }
  return DEFAULT_CTA_HREF;
}

/** True when a section has anything left to show after placeholders are hidden. */
export function hasVisibleContent(s: PageSection): boolean {
  return !!(s.eyebrow || s.headline || s.subhead || s.callout || s.items.some((l) => l.includes(" — ")) || s.data);
}

export function mapSection(item: CmsItem): PageSection | null {
  const f = item.fieldData ?? {};
  if (item.isArchived || typeof f.page !== "string" || typeof f["section-key"] !== "string") return null;
  const items = (typeof f.items === "string" ? f.items.split("\n") : [])
    .map(applyCopyRules)
    .filter((line) => line && !COMPETITORS.test(line) && !hasCopyPlaceholder(line));
  return {
    page: f.page,
    sectionKey: f["section-key"] as string,
    eyebrow: str(f, "eyebrow"),
    headline: str(f, "headline"),
    subhead: str(f, "subhead"),
    callout: str(f, "callout"),
    items,
    ctaLabel: str(f, "cta-label"),
    ctaHref: safeHref(str(f, "cta-href")),
    data: parseData(f["data-json"]),
    sortOrder: Number(f["sort-order"] ?? 0),
    figmaNode: str(f, "figma-node")
  };
}

function mapAll(items: CmsItem[]): PageSection[] {
  return items
    .map(mapSection)
    .filter((s): s is PageSection => s !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export type SectionsEnv = {
  WEBFLOW_API_TOKEN?: string;
  WEBFLOW_SITE_ID?: string;
  WEBFLOW_PAGE_SECTIONS_COLLECTION_ID?: string;
  VERCEL_ENV?: string | undefined;
};


/** Full CMS snapshot, drafts included. Used as the fallback on preview only. */
export const FALLBACK_HOME_PRICING: PageSection[] = mapAll(homePricingSnapshot as CmsItem[]);
/** Published-only snapshot: drafts are filtered out for non-preview environments. */
export const PUBLISHED_HOME_PRICING: PageSection[] = mapAll((homePricingSnapshot as CmsItem[]).filter((i) => i.isDraft !== true));

const STATIC_PLANS = {
  flex: { name: "Flex", monthly: 399, annual: 3990 },
  flat: { name: "Flat", monthly: 999, annual: 9990 },
  founding: { name: "Founding", monthly: 199, annual: 1990 },
  startup: { name: "Startup", monthly: 99, annual: 990 }
};

/** Static copy used when no published content is available. */
export const STATIC_HOME_PRICING: PageSection[] = [
  {
    page: "home", sectionKey: "hero", items: [], sortOrder: 1,
    headline: "Run your home service business with agents that do the work",
    subhead: "Booking, follow-up, invoicing and reviews, handled. You approve what matters.",
    ctaLabel: "Book a demo", ctaHref: DEFAULT_CTA_HREF
  },
  {
    page: "home", sectionKey: "pricing", items: [], sortOrder: 2,
    headline: "Simple pricing. Everything included.",
    data: { plans: STATIC_PLANS, defaultBilling: "annual", annualLabel: "Annual (2 months free)", bookingFee: DEFAULT_BOOKING_FEE }
  },
  {
    page: "pricing", sectionKey: "plans", items: [], sortOrder: 1,
    headline: "Simple pricing. Everything included.",
    data: { plans: STATIC_PLANS, defaultBilling: "annual", annualLabel: "Annual (2 months free)", bookingFee: DEFAULT_BOOKING_FEE }
  }
];

/** Fallback for a page: drafts only on preview, else published snapshot, else static copy. */
export function fallbackSections(page: string, env: { VERCEL_ENV?: string | undefined }): PageSection[] {
  const pick = (list: PageSection[]) => list.filter((s) => s.page === page);
  if (env.VERCEL_ENV === "preview") {
    const preview = pick(FALLBACK_HOME_PRICING);
    if (preview.length) return preview;
  }
  const published = pick(PUBLISHED_HOME_PRICING);
  return published.length ? published : pick(STATIC_HOME_PRICING);
}
export const STATIC_PRODUCT_SECTIONS: PageSection[] = mapAll(productSnapshot as CmsItem[]);

export async function getPageSections(
  page: string,
  env: SectionsEnv = process.env as SectionsEnv,
  fetchImpl: typeof fetch = fetch
): Promise<PageSection[]> {
  const fromStatic = STATIC_PRODUCT_SECTIONS.filter((s) => s.page === page);
  if (fromStatic.length) return fromStatic;
  const fallback = fallbackSections(page, env);
  const token = env.WEBFLOW_API_TOKEN;
  const collectionId = env.WEBFLOW_PAGE_SECTIONS_COLLECTION_ID;
  if (!token || !collectionId || !env.WEBFLOW_SITE_ID) return fallback;
  try {
    const res = await fetchImpl(webflowItemsUrl(collectionId, env), {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      next: { revalidate: 300 }
    } as RequestInit);
    if (!res.ok) return fallback;
    const body = (await res.json()) as { items?: CmsItem[] };
    const items = (body.items ?? []).filter((i) => env.VERCEL_ENV === "preview" || i.isDraft !== true);
    const sections = mapAll(items).filter((s) => s.page === page);
    return sections.length ? sections : fallback;
  } catch {
    return fallback;
  }
}

export type CmsPlan = {
  id: string;
  name: string;
  badge?: string | undefined;
  monthly: number;
  annual: number;
  annualPerMonth?: number | undefined;
  fee?: string | undefined;
  href?: string | undefined;
};

export type PricingData = {
  plans: CmsPlan[];
  defaultBilling: "monthly" | "annual";
  annualLabel: string;
  saveBadge?: string | undefined;
  bookingFee?: string | undefined;
};


/** Plans and the annual toggle come from a section's data-json. */
export function pricingFromSection(section: PageSection | undefined): PricingData | null {
  const d = section?.data as Record<string, unknown> | undefined;
  const plans = d?.plans as Record<string, Omit<CmsPlan, "id">> | undefined;
  if (!plans) return null;
  return {
    plans: Object.entries(plans).map(([id, p]) => ({ id, ...p })),
    defaultBilling: d?.defaultBilling === "monthly" ? "monthly" : "annual",
    annualLabel: typeof d?.annualLabel === "string" ? d.annualLabel : "Annual (2 months free)",
    saveBadge: typeof d?.saveBadge === "string" ? d.saveBadge : undefined,
    bookingFee: typeof d?.bookingFee === "string" ? d.bookingFee : undefined
  };
}

export { webflowItemsUrl };
