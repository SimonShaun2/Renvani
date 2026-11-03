#!/usr/bin/env node
/**
 * FS-76: Check local boot templates against the canonical schema and scoped host keys.
 * Provider-neutral; safe to run locally without credentials.
 */
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const ENV_TS = join(root, "packages/config/src/env-schema.ts");
const ROOT_EXAMPLE = join(root, ".env.example");
const TEMPLATE_DIR = join(root, "docs/env/templates");
const PRODUCTION_DEPLOYMENT = join(root, "docs/planning/PRODUCTION-DEPLOYMENT.md");

/** Host/web-only keys intentionally consumed outside the canonical config schema. */
const DOCUMENTED_EXTERNAL_KEYS = new Set([
  "API_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "WEBFLOW_API_TOKEN",
  "WEBFLOW_SITE_ID",
  "WEBFLOW_PRODUCT_VISUALS_COLLECTION_ID",
  "WEBFLOW_PAGE_SECTIONS_COLLECTION_ID",
  "RENVANI_DEPLOYMENT_TIER"
]);

/** Shared local examples must describe required API, webhook and worker boot inputs. */
const REQUIRED_LOCAL_KEYS = new Set([
  "DATABASE_URL", "REDIS_URL", "APP_URL", "JWT_SECRET", "JWT_REFRESH_SECRET",
  "BOOKING_HOLD_TOKEN_SECRET", "ACCESS_TOKEN_TTL_SECONDS", "REFRESH_TOKEN_TTL_SECONDS",
  "RESET_TOKEN_TTL_SECONDS", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
  "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER", "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL", "STRIPE_PLATFORM_FEE_PERCENT", "NEXT_PUBLIC_API_URL"
]);

/** Keys referenced in historical PRODUCTION-DEPLOYMENT.md (informational). */
const KNOWN_STALE_DEPLOYMENT_KEYS = new Set([
  "CORS_ORIGINS",
  "JWT_EXPIRES_IN",
  "SENDGRID_FROM_NAME",
  // Documented in PRODUCTION-DEPLOYMENT.md but not in canonical config schema (FS-93 reconciliation)
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_BOOKING_BASE_URL",
  "NEXT_PUBLIC_JWT_STORAGE_KEY",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_VAPID_PUBLIC_KEY",
  "R2_PUBLIC_URL",
  "VAPID_PRIVATE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_SUBJECT",
  "WORKER_CONCURRENCY"
]);

function parseEnvTsKeys(source) {
  const keys = new Set();
  const re = /^\s{2}([A-Z][A-Z0-9_]*):\s/;
  for (const line of source.split("\n")) {
    const match = re.exec(line);
    if (match) {
      keys.add(match[1]);
    }
  }
  return keys;
}

function parseDotEnvKeys(source) {
  const keys = new Set();
  for (const line of source.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      continue;
    }
    keys.add(trimmed.slice(0, eq).trim());
  }
  return keys;
}

function diff(label, missing, extra) {
  const problems = [];
  if (missing.length > 0) {
    problems.push(`${label}: missing keys: ${missing.join(", ")}`);
  }
  if (extra.length > 0) {
    problems.push(`${label}: unexpected keys: ${extra.join(", ")}`);
  }
  return problems;
}

function main() {
  const schemaKeys = parseEnvTsKeys(readFileSync(ENV_TS, "utf8"));
  const errors = [];
  errors.push(...diff("required local boot keys versus canonical schema", [],
    [...REQUIRED_LOCAL_KEYS].filter((k) => !schemaKeys.has(k)).sort()));

  const rootKeys = parseDotEnvKeys(readFileSync(ROOT_EXAMPLE, "utf8"));
  errors.push(
    ...diff(
      ".env.example",
      [...REQUIRED_LOCAL_KEYS].filter((k) => !rootKeys.has(k)).sort(),
      [...rootKeys].filter((k) => !schemaKeys.has(k) && !DOCUMENTED_EXTERNAL_KEYS.has(k)).sort()
    )
  );

  const localDevPath = join(TEMPLATE_DIR, "local-dev.env.example");
  const localKeys = parseDotEnvKeys(readFileSync(localDevPath, "utf8"));
  const localAllowed = new Set([...schemaKeys, ...DOCUMENTED_EXTERNAL_KEYS]);
  errors.push(
    ...diff(
      "local-dev.env.example",
      [...REQUIRED_LOCAL_KEYS].filter((k) => !localKeys.has(k)).sort(),
      [...localKeys].filter((k) => !localAllowed.has(k)).sort()
    )
  );

  for (const file of readdirSync(TEMPLATE_DIR).filter((f) => f.endsWith(".env.example"))) {
    if (file === "local-dev.env.example" || file === "web.env.example" || file === "migrations.env.example") {
      continue;
    }
    const keys = parseDotEnvKeys(readFileSync(join(TEMPLATE_DIR, file), "utf8"));
    const unexpected = [...keys].filter((k) => !schemaKeys.has(k) && !DOCUMENTED_EXTERNAL_KEYS.has(k));
    if (unexpected.length > 0) {
      errors.push(`${file}: keys not in canonical schema or documented host keys: ${unexpected.sort().join(", ")}`);
    }
  }

  const webKeys = parseDotEnvKeys(readFileSync(join(TEMPLATE_DIR, "web.env.example"), "utf8"));
  const allowedWeb = new Set([
    "NODE_ENV", "RENVANI_DEPLOYMENT_TIER", "NEXT_PUBLIC_API_URL",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
    "API_URL", "APP_URL", "CLERK_SECRET_KEY", "ORIGIN_SECRET"
  ]);
  const badWeb = [...webKeys].filter((k) => !allowedWeb.has(k));
  if (badWeb.length > 0) {
    errors.push(`web.env.example: keys outside scoped Vercel web configuration: ${badWeb.join(", ")}`);
  }

  const deployDoc = readFileSync(PRODUCTION_DEPLOYMENT, "utf8");
  const deployMentions = new Set();
  const mentionRe = /^(?:# )?([A-Z][A-Z0-9_]+)=/gm;
  let m;
  while ((m = mentionRe.exec(deployDoc)) !== null) {
    deployMentions.add(m[1]);
  }
  const staleInDeploy = [...deployMentions].filter(
    (k) => !schemaKeys.has(k) && !DOCUMENTED_EXTERNAL_KEYS.has(k) && KNOWN_STALE_DEPLOYMENT_KEYS.has(k)
  );
  if (staleInDeploy.length > 0) {
    console.warn(
      `[warn] PRODUCTION-DEPLOYMENT.md documents stale keys (tracked for FS-93 reconciliation): ${staleInDeploy.sort().join(", ")}`
    );
  }
  const unknownDeploy = [...deployMentions].filter(
    (k) =>
      !schemaKeys.has(k) &&
      !DOCUMENTED_EXTERNAL_KEYS.has(k) &&
      !KNOWN_STALE_DEPLOYMENT_KEYS.has(k) &&
      k !== "NODE_ENV"
  );
  if (unknownDeploy.length > 0) {
    errors.push(
      `PRODUCTION-DEPLOYMENT.md mentions keys outside the canonical schema (review): ${unknownDeploy.sort().join(", ")}`
    );
  }

  if (errors.length > 0) {
    console.error("check-env-documentation: FAILED\n" + errors.map((e) => `  - ${e}`).join("\n"));
    process.exit(1);
  }

  console.log(
    `check-env-documentation: OK (${schemaKeys.size} schema keys; templates and .env.example aligned)`
  );
}

main();
