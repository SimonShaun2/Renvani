/**
 * STACK-10 / STACK-11 — Neon per-PR CI guards (staging-only; never prod).
 */

const PROD_HOST_PATTERNS = [
  /(?:^|[.-])prod(?:[.-]|$)/i,
  /(?:^|[.-])production(?:[.-]|$)/i,
  /-main-[a-z0-9]+\.neon\.tech$/i
];

const STAGING_HOST_HINTS = [/staging/i, /-pr-/i, /-preview-/i, /-ci-/i];

export type NeonCiValidationResult =
  | { ok: true; mode: "skip" | "staging" }
  | { ok: false; code: string; message: string };

export function isNeonProdDatabaseUrl(databaseUrl: string): boolean {
  const normalized = databaseUrl.trim().toLowerCase();
  if (normalized.length === 0) {
    return false;
  }

  try {
    const parsed = new URL(databaseUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    const combined = `${host}${path}`;

    if (PROD_HOST_PATTERNS.some((pattern) => pattern.test(combined))) {
      return true;
    }

    if (parsed.searchParams.get("branch")?.toLowerCase() === "main") {
      return true;
    }
  } catch {
    return PROD_HOST_PATTERNS.some((pattern) => pattern.test(normalized));
  }

  return false;
}

export function resolveNeonCiDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): string | null {
  const explicit = env.NEON_CI_DATABASE_URL?.trim();
  if (explicit) {
    return explicit;
  }
  const fallback = env.DATABASE_URL?.trim();
  if (!fallback) {
    return null;
  }
  return fallback;
}

/**
 * Validates CI database URL when Neon per-PR CI is enabled.
 * Missing URL → skip (local batch-ci without founder secrets).
 */
export function validateNeonCiDatabaseUrl(
  env: Record<string, string | undefined> = process.env
): NeonCiValidationResult {
  const databaseUrl = resolveNeonCiDatabaseUrl(env);
  if (!databaseUrl) {
    return { ok: true, mode: "skip" };
  }

  if (isNeonProdDatabaseUrl(databaseUrl)) {
    return {
      ok: false,
      code: "NEON_PROD_FORBIDDEN",
      message:
        "Neon per-PR CI must not use production Neon branches or prod hostnames (staging-only policy)."
    };
  }

  const tier = env.RENVANI_DEPLOYMENT_TIER?.trim().toLowerCase();
  if (tier === "production") {
    return {
      ok: false,
      code: "NEON_CI_PRODUCTION_TIER",
      message: "Neon per-PR CI cannot run with RENVANI_DEPLOYMENT_TIER=production."
    };
  }

  try {
    const host = new URL(databaseUrl).hostname;
    const looksStaging =
      host.includes("neon.tech") &&
      STAGING_HOST_HINTS.some((hint) => hint.test(host) || hint.test(databaseUrl));
    if (host.includes("neon.tech") && !looksStaging && tier !== "staging") {
      return {
        ok: false,
        code: "NEON_CI_STAGING_HINT_REQUIRED",
        message:
          "Neon CI URLs must target staging/per-PR branches (hostname hint) or set RENVANI_DEPLOYMENT_TIER=staging."
      };
    }
  } catch {
    return {
      ok: false,
      code: "NEON_CI_INVALID_URL",
      message: "NEON_CI_DATABASE_URL / DATABASE_URL is not a valid URL."
    };
  }

  return { ok: true, mode: "staging" };
}
