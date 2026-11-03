import { z } from "zod";

import { assertStripeLiveKeyAllowed } from "./deployment-environment.js";
import { envSchema } from "./env.js";

/** Shared database and queue fields contain no payment, messaging, AI, or storage credentials. */
const coreSchema = envSchema.pick({
  NODE_ENV: true,
  DATABASE_URL: true,
  DATABASE_POOL_MAX: true,
  DATABASE_IDLE_TIMEOUT_SECONDS: true,
  DATABASE_CONNECT_TIMEOUT_SECONDS: true,
  DATABASE_SERVICE_MAX_CONNECTIONS: true,
  DATABASE_TRANSACTION_MAX_RETRIES: true,
  DATABASE_TRANSACTION_RETRY_BASE_MS: true,
  REDIS_URL: true
});

const workerSchema = coreSchema.merge(envSchema.pick({
  APP_URL: true,
  SOURCE_QUEUE_REPLAY_ENABLED: true,
  RESEND_API_KEY: true,
  RESEND_FROM_EMAIL: true,
  EMAIL_FROM: true,
  SENDGRID_API_KEY: true,
  SENDGRID_FROM_EMAIL: true,
  TWILIO_FROM_NUMBER: true
}).extend({
  SENDGRID_API_KEY: z.string().default(""),
  SENDGRID_FROM_EMAIL: z.string().default(""),
  TWILIO_FROM_NUMBER: z.string().default("")
}));

const webhookSchema = coreSchema.merge(envSchema.pick({
  NODE_ENV: true,
  PORT: true,
  WEBHOOK_PORT: true,
  APP_URL: true,
  STRIPE_SECRET_KEY: true,
  STRIPE_WEBHOOK_SECRET: true,
  TWILIO_AUTH_TOKEN: true,
  TWILIO_FROM_NUMBER: true
}));

const webServerSchema = envSchema.pick({
  NODE_ENV: true,
  APP_URL: true,
  NEXT_PUBLIC_API_URL: true,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: true,
  CLERK_SECRET_KEY: true,
  ORIGIN_SECRET: true
});

const browserSchema = envSchema.pick({
  NEXT_PUBLIC_API_URL: true,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: true
});

const storageSchema = envSchema.pick({
  OBJECT_STORAGE_PROVIDER: true,
  MEDIA_SIGNED_URL_TTL_SECONDS: true,
  R2_ACCOUNT_ID: true,
  R2_ACCESS_KEY_ID: true,
  R2_SECRET_ACCESS_KEY: true,
  R2_BUCKET_NAME: true
}).extend({
  R2_ACCOUNT_ID: z.string().default(""),
  R2_ACCESS_KEY_ID: z.string().default(""),
  R2_SECRET_ACCESS_KEY: z.string().default(""),
  R2_BUCKET_NAME: z.string().default("")
}).superRefine((value, context) => {
  if (value.OBJECT_STORAGE_PROVIDER !== "r2") return;
  for (const field of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"] as const) {
    if (value[field].trim()) continue;
    context.addIssue({ code: z.ZodIssueCode.custom, path: [field], message: "Required when R2 is enabled" });
  }
});

const paymentSchema = envSchema.pick({
  STRIPE_PLATFORM_FEE_PERCENT: true,
  CUSTOMER_PLATFORM_FEE_DISCLOSURE: true,
  STRIPE_PLATFORM_BILLING_PRICE_ID: true,
  STRIPE_PLATFORM_BILLING_PRICE_ID_FLEX: true,
  STRIPE_PLATFORM_BILLING_PRICE_ID_FLAT: true,
  STRIPE_RENVANI_STATEMENT_PREFIX: true,
  STRIPE_BRANDING_LOGO_URL: true,
  STRIPE_BRANDING_ICON_URL: true
}).extend({
  STRIPE_PLATFORM_FEE_PERCENT: z.coerce.number().nonnegative().default(0)
});

const tokenSchema = envSchema.pick({
  JWT_SECRET: true,
  NEXT_PUBLIC_API_URL: true
});

const aiSchema = envSchema.pick({ OPENAI_API_KEY: true });

/** API providers are validated when their adapters are enabled; core/auth values are mandatory. */
const apiSchema = coreSchema.merge(envSchema.pick({
  ACCESS_TOKEN_TTL_SECONDS: true,
  API_PORT: true,
  APP_URL: true,
  APP_URL_ALLOWED: true,
  BOOKING_HOLD_TOKEN_SECRET: true,
  CLERK_AUTHORIZED_PARTIES: true,
  CLERK_SECRET_KEY: true,
  CLERK_WEBHOOK_SECRET: true,
  EMAIL_FROM: true,
  EMAIL_LOGO_URL: true,
  ESTIMATE_EXPIRY_DAYS: true,
  ETA_ASSUMED_SPEED_MPH: true,
  GEO_PROVIDER: true,
  GLOBAL_RATE_LIMIT_ENABLED: true,
  GLOBAL_RATE_LIMIT_MAX: true,
  GLOBAL_RATE_LIMIT_WINDOW_SECONDS: true,
  INVOICE_DUE_DAYS: true,
  JWT_REFRESH_SECRET: true,
  JWT_SECRET: true,
  MARKETING_IP_HASH_SALT: true,
  MARKETING_NOTIFY_EMAIL: true,
  ORIGIN_SECRET: true,
  PUBLIC_SLOT_HOLD_COMPANY_RATE_LIMIT_MAX: true,
  PUBLIC_SLOT_HOLD_IP_RATE_LIMIT_MAX: true,
  PUBLIC_SLOT_HOLD_RATE_LIMIT_WINDOW_SECONDS: true,
  REFRESH_TOKEN_TTL_SECONDS: true,
  RENVANI_INTERNAL_COMPANY_ID: true,
  RESEND_API_KEY: true,
  RESEND_FROM_EMAIL: true,
  RESET_TOKEN_TTL_SECONDS: true,
  SENDGRID_API_KEY: true,
  SENDGRID_FROM_EMAIL: true,
  SENTRY_DSN: true,
  STRIPE_SECRET_KEY: true,
  TRUST_PROXY_HOPS: true
}).partial()).extend({
  API_PORT: envSchema.shape.API_PORT,
  APP_URL: envSchema.shape.APP_URL,
  JWT_SECRET: envSchema.shape.JWT_SECRET,
  JWT_REFRESH_SECRET: envSchema.shape.JWT_REFRESH_SECRET,
  BOOKING_HOLD_TOKEN_SECRET: envSchema.shape.BOOKING_HOLD_TOKEN_SECRET
});

export const runtimeEnvSchemas = {
  core: coreSchema,
  api: apiSchema,
  worker: workerSchema,
  webhook: webhookSchema,
  "web-server": webServerSchema,
  browser: browserSchema,
  storage: storageSchema,
  payment: paymentSchema,
  token: tokenSchema,
  ai: aiSchema
} as const;

export type RuntimeName = keyof typeof runtimeEnvSchemas;
export type RuntimeEnv<Name extends RuntimeName> = z.infer<(typeof runtimeEnvSchemas)[Name]>;

/** Parse only the selected runtime's fields. Errors contain field names, never supplied values. */
export function parseRuntimeEnv<Name extends RuntimeName>(
  runtime: Name,
  source: Record<string, string | undefined> = process.env
): Readonly<RuntimeEnv<Name>> {
  const result = runtimeEnvSchemas[runtime].safeParse(source);
  if (!result.success) {
    const names = [...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? "environment")))].sort();
    throw new Error(`Invalid ${runtime} environment fields: ${names.join(", ")}`);
  }
  if (runtime !== "browser") assertStripeLiveKeyAllowed(source);
  return Object.freeze(result.data) as Readonly<RuntimeEnv<Name>>;
}

function lazyRuntimeEnv<Name extends RuntimeName>(runtime: Name): Readonly<RuntimeEnv<Name>> {
  return new Proxy({} as RuntimeEnv<Name>, {
    get(_target, key) {
      return parseRuntimeEnv(runtime)[key as keyof RuntimeEnv<Name>];
    },
    has(_target, key) {
      return key in parseRuntimeEnv(runtime);
    },
    ownKeys() {
      return Reflect.ownKeys(parseRuntimeEnv(runtime));
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    }
  });
}

export const coreEnv = lazyRuntimeEnv("core");
export const workerEnv = lazyRuntimeEnv("worker");
export const webhookEnv = lazyRuntimeEnv("webhook");
export const webServerEnv = lazyRuntimeEnv("web-server");
export const browserEnv = lazyRuntimeEnv("browser");
export const apiEnv = lazyRuntimeEnv("api");
export const storageEnv = lazyRuntimeEnv("storage");
export const paymentEnv = lazyRuntimeEnv("payment");
export const tokenEnv = lazyRuntimeEnv("token");
export const aiEnv = lazyRuntimeEnv("ai");

export function resolveWebhookListenPort(config: Pick<RuntimeEnv<"webhook">, "PORT" | "WEBHOOK_PORT">): number {
  return config.PORT ?? config.WEBHOOK_PORT;
}
