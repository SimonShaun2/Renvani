/** Public Sanity project settings. Unset → CMS disabled (empty states, no fetches). */
export const SANITY_API_VERSION = "2025-01-01";

export type SanityEnv = { projectId: string; dataset: string };

/**
 * Literal `process.env.NEXT_PUBLIC_*` reads so Next.js inlines them into the client Studio bundle.
 * Do not alias, destructure or index process.env here.
 */
export function readSanityEnv(): SanityEnv | null {
  return validateSanityEnv(process.env.NEXT_PUBLIC_SANITY_PROJECT_ID, process.env.NEXT_PUBLIC_SANITY_DATASET);
}

export function validateSanityEnv(rawProjectId: string | undefined, rawDataset: string | undefined): SanityEnv | null {
  const projectId = rawProjectId?.trim();
  const dataset = rawDataset?.trim();
  if (!projectId || !dataset || !/^[a-z0-9-]+$/.test(projectId) || !/^[a-z0-9_-]+$/.test(dataset)) return null;
  return { projectId, dataset };
}

/** CMS document types served on the public site, with their route prefix. */
export const CMS_TYPES = { post: "/blog", comparisonPage: "/compare" } as const;
export type CmsType = keyof typeof CMS_TYPES;

export const cmsTag = (type: CmsType, slug?: string) => (slug ? `${type}:${slug}` : type);
