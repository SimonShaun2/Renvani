/**
 * Page Sections content (Webflow CMS collection "Page Sections").
 *
 * Home and Pricing are fetched server-side from the Webflow Data API v2 staged
 * items endpoint (includes drafts) and fall back to the bundled snapshot.
 * Product pages and HVAC are static for now, stored in the same CMS shape
 * (`data/page-sections.products.json`) so they can move into the CMS later.
 *
 * `review-notes` is editorial only: it is dropped during mapping and is never
 * part of `PageSection`, so it cannot be rendered.
 */
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

type CmsItem = { isArchived?: boolean; fieldData: Record<string, unknown> };

const FEE_RULES: Array<[RegExp, string]> = [
  [/Platform fee \(5%, paid by customer\)/gi, "Service Fee (2%, paid by customer)"],
  [/Platform fee \(5%\)/gi, "Service Fee (2%, paid by customer)"]
];

/** Copy rules applied to every rendered CMS/static string. */
export function applyCopyRules(text: string): string {
  let out = text;
  for (const [re, to] of FEE_RULES) out = out.replace(re, to);
  // Editorial "[confirm: …]" notes are never shown publicly.
  out = out.replace(/\s*\[confirm:[^\]]*\]/gi, "");
  return out.trim();
}

/** "[Copy: …]" placeholders stay visible, flagged as TODO. */
export function hasCopyPlaceholder(text: string | undefined): boolean {
  return !!text && /\[Copy:[^\]]*\]/i.test(text);
}

export const COMPETITORS = /servicetitan|housecall|jobber|service fusion|fieldedge|workiz/i;

function str(f: Record<string, unknown>, key: string): string | undefined {
  const v = f[key];
  if (typeof v !== "string") return undefined;
  const t = applyCopyRules(v);
  return t || undefined;
}

function parseData(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  try {
    return JSON.parse(applyCopyRules(raw)) as unknown;
  } catch {
    return undefined;
  }
}

export function mapSection(item: CmsItem): PageSection | null {
  const f = item.fieldData ?? {};
  if (item.isArchived || typeof f.page !== "string" || typeof f["section-key"] !== "string") return null;
  const items = (typeof f.items === "string" ? f.items.split("\n") : [])
    .map(applyCopyRules)
    .filter((line) => line && !COMPETITORS.test(line));
  return {
    page: f.page,
    sectionKey: f["section-key"] as string,
    eyebrow: str(f, "eyebrow"),
    headline: str(f, "headline"),
    subhead: str(f, "subhead"),
    callout: str(f, "callout"),
    items,
    ctaLabel: str(f, "cta-label"),
    ctaHref: str(f, "cta-href"),
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
};

export const FALLBACK_HOME_PRICING: PageSection[] = mapAll(homePricingSnapshot as CmsItem[]);
export const STATIC_PRODUCT_SECTIONS: PageSection[] = mapAll(productSnapshot as CmsItem[]);

export async function getPageSections(
  page: string,
  env: SectionsEnv = process.env as SectionsEnv,
  fetchImpl: typeof fetch = fetch
): Promise<PageSection[]> {
  const fromStatic = STATIC_PRODUCT_SECTIONS.filter((s) => s.page === page);
  if (fromStatic.length) return fromStatic;
  const fallback = FALLBACK_HOME_PRICING.filter((s) => s.page === page);
  const token = env.WEBFLOW_API_TOKEN;
  const collectionId = env.WEBFLOW_PAGE_SECTIONS_COLLECTION_ID;
  if (!token || !collectionId || !env.WEBFLOW_SITE_ID) return fallback;
  try {
    const res = await fetchImpl(`https://api.webflow.com/v2/collections/${encodeURIComponent(collectionId)}/items?limit=100`, {
      headers: { Authorization: `Bearer ${token}`, accept: "application/json" },
      next: { revalidate: 300 }
    } as RequestInit);
    if (!res.ok) return fallback;
    const body = (await res.json()) as { items?: CmsItem[] };
    const sections = mapAll(body.items ?? []).filter((s) => s.page === page);
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

export const DEFAULT_BOOKING_FEE = "+ $1.99 booking fee on online bookings, paid at checkout";

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
