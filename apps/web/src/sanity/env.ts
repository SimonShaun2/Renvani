/** Public Sanity project settings. Unset → CMS disabled (empty states, no fetches). */
export const SANITY_API_VERSION = "2025-01-01";

export type SanityEnv = { projectId: string; dataset: string };

export function readSanityEnv(env: NodeJS.ProcessEnv = process.env): SanityEnv | null {
  const projectId = env.NEXT_PUBLIC_SANITY_PROJECT_ID?.trim();
  const dataset = env.NEXT_PUBLIC_SANITY_DATASET?.trim();
  if (!projectId || !dataset || !/^[a-z0-9-]+$/.test(projectId) || !/^[a-z0-9_-]+$/.test(dataset)) return null;
  return { projectId, dataset };
}

/** CMS document types served on the public site, with their route prefix. */
export const CMS_TYPES = { post: "/blog", comparisonPage: "/compare" } as const;
export type CmsType = keyof typeof CMS_TYPES;

export const cmsTag = (type: CmsType, slug?: string) => (slug ? `${type}:${slug}` : type);
