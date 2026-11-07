import { createClient } from "next-sanity";
import type { PortableTextBlock } from "@portabletext/react";

import { SANITY_API_VERSION, cmsTag, readSanityEnv, type CmsType } from "./env";
import { readCmsResult } from "./read-result";
import { COMPARISON_QUERY, LIST_QUERY, POST_QUERY, SLUGS_QUERY } from "./queries";

export type CmsFaq = { question: string; answer: string };
export type CmsImage = { url?: string | null; alt?: string | null };
export type CmsCta = { label?: string | null; href?: string | null };
export type CmsRelated = { title: string; slug: string; excerpt?: string | null };
export type CmsDoc = {
  title: string;
  slug: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  targetKeyword?: string | null;
  excerpt?: string | null;
  featuredImage?: CmsImage | null;
  author?: string | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
  body?: PortableTextBlock[] | null;
  relatedPosts?: CmsRelated[] | null;
  cta?: CmsCta | null;
  faq?: CmsFaq[] | null;
};
export type CmsListItem = Pick<CmsDoc, "title" | "slug" | "metaDescription" | "excerpt" | "publishedAt">;
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
    return await readCmsResult(
      () => c.fetch<T | null>(query, params, { next: { revalidate: CMS_REVALIDATE_SECONDS, tags } }),
      fallback
    );
  } catch (error) {
    // Do not log provider messages, request URLs, slugs or credentials.
    console.error("[sanity] configured CMS read failed", { code: "CMS_READ_UNAVAILABLE" });
    throw error;
  }
}

export function fetchCmsList(type: CmsType): Promise<CmsListItem[]> {
  return safeFetch<CmsListItem[]>(LIST_QUERY, { type }, [cmsTag(type)], []);
}

export function fetchCmsDoc(type: CmsType, slug: string): Promise<CmsDoc | null> {
  return safeFetch<CmsDoc | null>(type === "post" ? POST_QUERY : COMPARISON_QUERY, { slug }, [cmsTag(type), cmsTag(type, slug)], null);
}

export function fetchCmsSlugs(): Promise<CmsSlug[]> {
  return safeFetch<CmsSlug[]>(SLUGS_QUERY, {}, ["post", "comparisonPage"], []);
}
