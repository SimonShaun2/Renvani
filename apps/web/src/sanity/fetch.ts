import { createClient } from "next-sanity";
import type { PortableTextBlock } from "@portabletext/react";

import { SANITY_API_VERSION, cmsTag, readSanityEnv, type CmsType } from "./env";
import { DOC_QUERY, LIST_QUERY, SLUGS_QUERY } from "./queries";

export type CmsFaq = { question: string; answer: string };
export type CmsDoc = {
  title: string;
  slug: string;
  seoTitle?: string | null;
  metaDescription?: string | null;
  ogImageUrl?: string | null;
  publishedAt?: string | null;
  body?: PortableTextBlock[] | null;
  faq?: CmsFaq[] | null;
};
export type CmsListItem = Pick<CmsDoc, "title" | "slug" | "metaDescription" | "publishedAt">;
export type CmsSlug = { _type: CmsType; slug: string; _updatedAt?: string };

/** ISR fallback; publishes go live sooner via /api/revalidate tags. */
export const CMS_REVALIDATE_SECONDS = 60;

/** Server-only: the read token is never sent to the browser. Returns null when the CMS is not configured. */
function client() {
  const env = readSanityEnv();
  if (!env) return null;
  const token = process.env.SANITY_API_READ_TOKEN?.trim() || undefined;
  return createClient({ ...env, apiVersion: SANITY_API_VERSION, useCdn: !token, perspective: "published", ...(token ? { token } : {}) });
}

async function safeFetch<T>(query: string, params: Record<string, string>, tags: string[], fallback: T): Promise<T> {
  const c = client();
  if (!c) return fallback;
  try {
    const result = await c.fetch<T | null>(query, params, { next: { revalidate: CMS_REVALIDATE_SECONDS, tags } });
    return result ?? fallback;
  } catch (error) {
    console.error("[sanity] fetch failed", { tags, error: error instanceof Error ? error.message : String(error) });
    return fallback;
  }
}

export function fetchCmsList(type: CmsType): Promise<CmsListItem[]> {
  return safeFetch<CmsListItem[]>(LIST_QUERY, { type }, [cmsTag(type)], []);
}

export function fetchCmsDoc(type: CmsType, slug: string): Promise<CmsDoc | null> {
  return safeFetch<CmsDoc | null>(DOC_QUERY, { type, slug }, [cmsTag(type), cmsTag(type, slug)], null);
}

export function fetchCmsSlugs(): Promise<CmsSlug[]> {
  return safeFetch<CmsSlug[]>(SLUGS_QUERY, {}, ["post", "comparisonPage"], []);
}
