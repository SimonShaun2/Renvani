import { z } from "zod";

import { assertStripeLiveKeyAllowed } from "./deployment-environment.js";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Injected by Render (and similar hosts); prefer over service-specific ports when set. */
  PORT: z.coerce.number().int().positive().optional(),
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEBHOOK_PORT: z.coerce.number().int().positive().default(3002),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().optional(),
  DATABASE_IDLE_TIMEOUT_SECONDS: z.coerce.number().int().nonnegative().default(20),
  DATABASE_CONNECT_TIMEOUT_SECONDS: z.coerce.number().int().positive().default(10),
  /** Documented ceiling for aggregate pool budgeting; not enforced at runtime until FS-93 sets service limits. */
  DATABASE_SERVICE_MAX_CONNECTIONS: z.coerce.number().int().positive().optional(),
  DATABASE_TRANSACTION_MAX_RETRIES: z.coerce.number().int().nonnegative().default(3),
  DATABASE_TRANSACTION_RETRY_BASE_MS: z.coerce.number().int().positive().default(25),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  /** Trusted-operations break-glass gate for non-exhausted source-queue replay. */
  SOURCE_QUEUE_REPLAY_ENABLED: z.enum(["true", "false"]).default("false"),
  /** FS-198 — geo/ETA provider id (registry in apps/api). Default needs no key and makes no calls. */
  GEO_PROVIDER: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/).default("straight_line"),
  /** FS-198 — assumed average driving speed for straight-line ETAs (mph); clamped 5–80 at use. */
  ETA_ASSUMED_SPEED_MPH: z.coerce.number().positive().default(30),
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z.string().min(1, "STRIPE_WEBHOOK_SECRET is required"),
  STRIPE_CONNECT_CLIENT_ID: z.string().min(1, "STRIPE_CONNECT_CLIENT_ID is required"),
  /** Card statement prefix when shop name is too long (founder may tune in live mode). */
  STRIPE_RENVANI_STATEMENT_PREFIX: z.string().default("RENVANI"),
  /** Optional — set after founder approves live branding assets (Stripe Dashboard / hosted pages). */
  STRIPE_BRANDING_LOGO_URL: z.string().default(""),
  STRIPE_BRANDING_ICON_URL: z.string().default(""),
  /** Decimal fraction (e.g. 0.05 = 5%) — Flex Connect shop fee only; see stripe-pricing.ts */
  STRIPE_PLATFORM_FEE_PERCENT: z.coerce.number().nonnegative("STRIPE_PLATFORM_FEE_PERCENT must be zero or greater"),
  /** Optional customer-facing platform-fee disclosure (Terms/surcharge copy). Empty = omit in UI. */
  CUSTOMER_PLATFORM_FEE_DISCLOSURE: z.string().default(""),
  /** STACK-13 — legacy alias for Flex price when STRIPE_PLATFORM_BILLING_PRICE_ID_FLEX unset */
  STRIPE_PLATFORM_BILLING_PRICE_ID: z.string().default(""),
  /** STACK-13/14 — Flex $299/mo Stripe Price id (test mode) */
  STRIPE_PLATFORM_BILLING_PRICE_ID_FLEX: z.string().default(""),
  /** STACK-13/14 — Flat $799/mo Stripe Price id (test mode) */
  STRIPE_PLATFORM_BILLING_PRICE_ID_FLAT: z.string().default(""),
  /** Optional (non-core). Empty = AI features disabled (import mapping falls back to presets). */
  OPENAI_API_KEY: z.string().trim().default(""),
  /** Optional (non-core) as a group: all three or none. Empty = SMS and inbound Twilio webhooks disabled. */
  TWILIO_ACCOUNT_SID: z.string().trim().default(""),
  TWILIO_AUTH_TOKEN: z.string().trim().default(""),
  TWILIO_FROM_NUMBER: z.string().trim().default(""),
  /** Optional (non-core). Empty = SendGrid fallback off (Resend, if set, still sends). */
  SENDGRID_API_KEY: z.string().trim().default(""),
  SENDGRID_FROM_EMAIL: z
    .union([z.literal(""), z.string().trim().email("SENDGRID_FROM_EMAIL must be a valid email")])
    .default(""),
  /** MVP email-first (Resend); optional until STACK-08 wires transactional sends */
  RESEND_API_KEY: z.string().default(""),
  RESEND_FROM_EMAIL: z.string().default(""),
  /** Sender for transactional email (Resend). */
  EMAIL_FROM: z.string().default("Renvani <hello@mail.getrenvani.com>"),
  /** Optional absolute https URL of the Renvani logo image for emails; empty renders the HTML text mark. */
  EMAIL_LOGO_URL: z.string().default(""),
  /** Growth marketing intake: internal inbox notified of demo requests / growth checks; empty = skip notifications. */
  MARKETING_NOTIFY_EMAIL: z.string().default(""),
  /** Growth marketing intake: secret salt for hashing client IPs (HMAC-SHA256); empty = store no IP hash. */
  MARKETING_IP_HASH_SALT: z.string().default(""),
  R2_ACCOUNT_ID: z.string().min(1, "R2_ACCOUNT_ID is required"),
  R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID is required"),
  R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY is required"),
  R2_BUCKET_NAME: z.string().min(1, "R2_BUCKET_NAME is required"),
  OBJECT_STORAGE_PROVIDER: z.enum(["r2", "memory"]).default("r2"),
  MEDIA_SIGNED_URL_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive("MEDIA_SIGNED_URL_TTL_SECONDS must be greater than zero")
    .default(900),
  APP_URL: z.string().url("APP_URL must be a valid URL"),
  /**
   * Comma-separated extra web origins (exact match, no wildcards). APP_URL stays primary. Extras are honored only when
   * RENVANI_DEPLOYMENT_TIER=staging (tester tier) for API CORS, Clerk authorized parties and Stripe return URLs.
   */
  APP_URL_ALLOWED: z.string().default(""),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  JWT_REFRESH_SECRET: z.string().min(1, "JWT_REFRESH_SECRET is required"),
  BOOKING_HOLD_TOKEN_SECRET: z.string().min(1, "BOOKING_HOLD_TOKEN_SECRET is required"),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive("ACCESS_TOKEN_TTL_SECONDS must be greater than zero"),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().positive("REFRESH_TOKEN_TTL_SECONDS must be greater than zero"),
  RESET_TOKEN_TTL_SECONDS: z.coerce.number().int().positive("RESET_TOKEN_TTL_SECONDS must be greater than zero"),
  ESTIMATE_EXPIRY_DAYS: z.coerce.number().int().positive("ESTIMATE_EXPIRY_DAYS must be greater than zero").default(30),
  INVOICE_DUE_DAYS: z.coerce.number().int().positive("INVOICE_DUE_DAYS must be greater than zero").default(30),
  NEXT_PUBLIC_API_URL: z.string().url("NEXT_PUBLIC_API_URL must be a valid URL").default("http://localhost:3001"),
  /** Web — Stripe.js / Connect embedded (pk_test_* or pk_live_*; founder approves live). */
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(""),
  RENVANI_INTERNAL_COMPANY_ID: z
    .string()
    .uuid("RENAVANI_INTERNAL_COMPANY_ID must be a valid UUID")
    .default("00000000-0000-4000-8000-000000000053"),
  /** STACK-02 — Clerk secret; empty disables Clerk verify path */
  CLERK_SECRET_KEY: z.string().default(""),
  /** Clerk webhook signing secret (whsec_…) for POST /api/v1/webhooks/clerk (svix). */
  CLERK_WEBHOOK_SECRET: z.string().default(""),
  /**
   * Optional shared secret the web proxy (Vercel) sends as `x-origin-secret` on /api/v1/public/* calls.
   * Unset = off: client IP is request.ip (TRUST_PROXY_HOPS). Set on BOTH Vercel web and Render api.
   */
  ORIGIN_SECRET: z.string().optional(),
  /** Comma-separated web origins allowed as Clerk `azp` and for CORS (e.g. https://staging.renvani.com). */
  CLERK_AUTHORIZED_PARTIES: z.string().default(""),
  /** STACK-04 / FS-133 — optional Sentry DSN for QBO sync issue alerts */
  SENTRY_DSN: z.string().default(""),
  /** FS-133 — Intuit sandbox OAuth (optional until QBO sync is configured). */
  QUICKBOOKS_CLIENT_ID: z.string().default(""),
  QUICKBOOKS_CLIENT_SECRET: z.string().default(""),
  QUICKBOOKS_REDIRECT_URI: z.string().default(""),
  QUICKBOOKS_ENVIRONMENT: z.enum(["sandbox"]).default("sandbox"),
  QUICKBOOKS_TOKEN_ENCRYPTION_KEY: z.string().default(""),
  /**
   * FS-66 — number of trusted reverse-proxy hops in front of the API (Fastify `trustProxy`).
   * 0 (default) = trust none; max 10; request.ip is the socket peer. N > 0 = take the client IP N hops back via X-Forwarded-For.
   */
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
  /** FS-66 — global per-IP API rate limit. Off unless explicitly "true" (enable after TRUST_PROXY_HOPS is verified). */
  GLOBAL_RATE_LIMIT_ENABLED: z.enum(["true", "false"]).optional(),
  GLOBAL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(600),
  GLOBAL_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  /** FS-66 — public slot-hold/confirm limits (fixed window). */
  PUBLIC_SLOT_HOLD_IP_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(6),
  PUBLIC_SLOT_HOLD_COMPANY_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  PUBLIC_SLOT_HOLD_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(600),
  /** FS-195 — dispatch drive-time estimator id (registry in apps/api) + assumed speed (mph, clamped 5–80). */
  DRIVE_TIME_ESTIMATOR: z.string().regex(/^[a-z][a-z0-9_]{0,63}$/).default("straight_line"),
  DRIVE_TIME_ASSUMED_SPEED_MPH: z.coerce.number().positive().default(30)
});

export type Env = z.infer<typeof envSchema>;
export type PublicEnv = Pick<Env, "NEXT_PUBLIC_API_URL" | "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY">;

/** Render sets `PORT`; local dev uses `API_PORT`. */
export function resolveApiListenPort(config: Env): number {
  return config.PORT ?? config.API_PORT;
}

/** Render sets `PORT`; local dev uses `WEBHOOK_PORT`. */
export function resolveWebhookListenPort(config: Env): number {
  return config.PORT ?? config.WEBHOOK_PORT;
}

const publicEnvSchema = envSchema.pick({
  NEXT_PUBLIC_API_URL: true,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: true
});

function formatValidationErrors(error: z.ZodError): string {
  return error.errors
    .map((issue) => {
      const path = issue.path.join(".");
      return path.length > 0 ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Environment validation failed: ${formatValidationErrors(result.error)}`);
  }
  assertStripeLiveKeyAllowed(process.env);
  assertOptionalIntegrationGroupsComplete(result.data);

  return result.data;
}

const TWILIO_ENV_NAMES = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"] as const;

/**
 * Non-core integrations may be absent, but never half-configured. Names only in errors, never values.
 */
export function assertOptionalIntegrationGroupsComplete(
  config: Pick<Env, (typeof TWILIO_ENV_NAMES)[number] | "SENDGRID_API_KEY" | "SENDGRID_FROM_EMAIL">
): void {
  const twilioSet = TWILIO_ENV_NAMES.filter((name) => config[name] !== "");
  if (twilioSet.length > 0 && twilioSet.length < TWILIO_ENV_NAMES.length) {
    const missing = TWILIO_ENV_NAMES.filter((name) => config[name] === "");
    throw new Error(
      `Environment validation failed: Twilio is partially configured; set all of ${TWILIO_ENV_NAMES.join(", ")} or none (missing: ${missing.join(", ")})`
    );
  }
  if (config.SENDGRID_API_KEY !== "" && config.SENDGRID_FROM_EMAIL === "") {
    throw new Error("Environment validation failed: SENDGRID_FROM_EMAIL is required when SENDGRID_API_KEY is set");
  }
}

export function isOpenAiConfigured(config: Pick<Env, "OPENAI_API_KEY"> = env): boolean {
  return config.OPENAI_API_KEY !== "";
}

export function isTwilioConfigured(
  config: Pick<Env, (typeof TWILIO_ENV_NAMES)[number]> = env
): boolean {
  return TWILIO_ENV_NAMES.every((name) => config[name] !== "");
}

export function isSendgridConfigured(
  config: Pick<Env, "SENDGRID_API_KEY" | "SENDGRID_FROM_EMAIL"> = env
): boolean {
  return config.SENDGRID_API_KEY !== "" && config.SENDGRID_FROM_EMAIL !== "";
}

let cachedEnv: Env | null = null;

export function resetEnvCacheForTests(): void {
  cachedEnv = null;
}

function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = parseEnv();
  return cachedEnv;
}

export const publicEnv = publicEnvSchema.parse(process.env);

export const env = new Proxy({} as Env, {
  get(_target, property) {
    return getEnv()[property as keyof Env];
  },
  has(_target, property) {
    return property in getEnv();
  },
  ownKeys() {
    return Reflect.ownKeys(getEnv());
  },
  getOwnPropertyDescriptor() {
    return {
      enumerable: true,
      configurable: true
    };
  }
});
