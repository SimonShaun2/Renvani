/** Canonical production origin, used only on a Vercel production deployment when PUBLIC_SITE_URL is not set. */
export const PRODUCTION_SITE_ORIGIN = "https://getrenvani.com";

/**
 * Fail-closed deployment identity. True ONLY when VERCEL_ENV is exactly "production" and VERCEL_TARGET_ENV, if
 * present at all, is also exactly "production". Missing, empty, unknown or conflicting values are not production,
 * whatever PUBLIC_SITE_URL says (a hostname is not deployment identity).
 */
export function isProductionDeployment(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.VERCEL_ENV !== "production") return false;
  if (env.VERCEL_TARGET_ENV !== undefined && env.VERCEL_TARGET_ENV !== "production") return false;
  return true;
}

/**
 * Public origin for canonicals, robots and sitemaps. Null (noindex, no sitemaps) unless isProductionDeployment().
 * PUBLIC_SITE_URL overrides the canonical production origin.
 */
export function publicSiteUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  if (!isProductionDeployment(env)) return null;
  const raw = env.PUBLIC_SITE_URL?.trim() || PRODUCTION_SITE_ORIGIN;
  try {
    const url = new URL(raw);
    if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}
