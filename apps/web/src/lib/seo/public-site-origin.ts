/** A configured origin never makes a Vercel preview/development/custom environment indexable. */
export function publicSiteUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  if ((env.VERCEL_ENV && env.VERCEL_ENV !== "production") ||
      (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== "production")) return null;
  const raw = env.PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}
