import { z } from "zod";

/**
 * Provider-neutral deployment tier. Distinct from NODE_ENV (Node runtime mode).
 * FS-75 / FS-93: staging hosts may run NODE_ENV=production with tier=staging.
 */
export const deploymentTierSchema = z.enum(["development", "staging", "production"]);

export type DeploymentTier = z.infer<typeof deploymentTierSchema>;

export const DEPLOYMENT_TIER_ENV = "RENVANI_DEPLOYMENT_TIER";

const integrationProfileSchema = z.enum(["non_live", "live"]);

export type IntegrationProfile = z.infer<typeof integrationProfileSchema>;

export type DeploymentBoundaryViolation = {
  code: string;
  message: string;
  field?: string;
};

export type DeploymentBoundaryResult =
  | { ok: true; tier: DeploymentTier; integrationProfile: IntegrationProfile }
  | { ok: false; tier: DeploymentTier; integrationProfile: IntegrationProfile; violations: DeploymentBoundaryViolation[] };

export function resolveDeploymentTier(
  env: Record<string, string | undefined> = process.env
): DeploymentTier {
  const raw = env[DEPLOYMENT_TIER_ENV];
  if (raw === undefined || raw.trim() === "") {
    return "development";
  }

  const parsed = deploymentTierSchema.safeParse(raw.trim());
  if (!parsed.success) {
    throw new Error(
      `Invalid ${DEPLOYMENT_TIER_ENV}: expected development, staging, or production`
    );
  }

  return parsed.data;
}

export function integrationProfileForTier(tier: DeploymentTier): IntegrationProfile {
  return tier === "production" ? "live" : "non_live";
}

function isStripeTestSecretKey(value: string): boolean {
  return value.startsWith("sk_test_");
}

function isStripeLiveSecretKey(value: string): boolean {
  return value.startsWith("sk_live_");
}

/**
 * Boot guard (all services that load packages/config env): a Stripe LIVE secret key is only allowed
 * when the deployment tier is production. Unset/blank tier resolves to "development" and an invalid
 * tier throws, so ambiguity fails closed. The key itself is never included in the error.
 */
export function assertStripeLiveKeyAllowed(env: Record<string, string | undefined> = process.env): void {
  const stripeSecret = env.STRIPE_SECRET_KEY?.trim();
  if (!stripeSecret || !isStripeLiveSecretKey(stripeSecret)) {
    return;
  }
  const tier = resolveDeploymentTier(env);
  if (integrationProfileForTier(tier) !== "live") {
    throw new Error(
      `Refusing to start: STRIPE_SECRET_KEY is a live key but ${DEPLOYMENT_TIER_ENV} is "${tier}" (live keys require production).`
    );
  }
}

/**
 * Validates staging/development integration boundaries without contacting vendors.
 * Production tier requires live Stripe keys when STRIPE_SECRET_KEY is set.
 */
export function validateDeploymentBoundaries(
  env: Record<string, string | undefined> = process.env
): DeploymentBoundaryResult {
  const tier = resolveDeploymentTier(env);
  const integrationProfile = integrationProfileForTier(tier);
  const violations: DeploymentBoundaryViolation[] = [];

  const stripeSecret = env.STRIPE_SECRET_KEY?.trim();
  if (stripeSecret) {
    if (integrationProfile === "non_live") {
      if (!isStripeTestSecretKey(stripeSecret)) {
        violations.push({
          code: "STRIPE_NON_LIVE_REQUIRED",
          field: "STRIPE_SECRET_KEY",
          message:
            "Non-production tiers must use Stripe test secret keys (sk_test_ prefix)."
        });
      }
    } else if (!isStripeLiveSecretKey(stripeSecret)) {
      violations.push({
        code: "STRIPE_LIVE_REQUIRED",
        field: "STRIPE_SECRET_KEY",
        message:
          "Production tier requires Stripe live secret keys (sk_live_ prefix) when STRIPE_SECRET_KEY is set."
      });
    }
  } else if (tier === "staging") {
    violations.push({
      code: "STRIPE_SECRET_REQUIRED_STAGING",
      field: "STRIPE_SECRET_KEY",
      message: "Staging boundary checks require STRIPE_SECRET_KEY to be set (test mode)."
    });
  }

  if (tier === "staging" || tier === "production") {
    for (const field of ["JWT_SECRET", "JWT_REFRESH_SECRET", "DATABASE_URL", "REDIS_URL"] as const) {
      const value = env[field]?.trim();
      if (!value) {
        violations.push({
          code: "REQUIRED_FIELD_MISSING",
          field,
          message: `${field} is required for ${tier} tier boundary validation.`
        });
      }
    }
  }

  if (tier === "staging") {
    const bucket = env.R2_BUCKET_NAME?.trim().toLowerCase() ?? "";
    if (bucket.length > 0 && (bucket.includes("production") || bucket.endsWith("-prod"))) {
      violations.push({
        code: "STAGING_BUCKET_NAME",
        field: "R2_BUCKET_NAME",
        message: "Staging object storage must not use production bucket naming."
      });
    }
  }

  if (violations.length > 0) {
    return { ok: false, tier, integrationProfile, violations };
  }

  return { ok: true, tier, integrationProfile };
}

export function parseEnvFile(contents: string): Record<string, string> {
  const result: Record<string, string> = {};

  for (const line of contents.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }

    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    result[key] = value;
  }

  return result;
}
