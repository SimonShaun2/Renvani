import { z } from "zod";

import { assertStripeLiveKeyAllowed } from "./deployment-environment.js";

import { envSchema, type Env } from "./env-schema.js";
export { envSchema } from "./env-schema.js";
export type { Env } from "./env-schema.js";

export type PublicEnv = Pick<Env, "NEXT_PUBLIC_API_URL" | "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY">;

/** Render sets `PORT`; local dev uses `API_PORT`. */
export function resolveApiListenPort(config: Pick<Env, "PORT" | "API_PORT">): number {
  return config.PORT ?? config.API_PORT;
}

/** Render sets `PORT`; local dev uses `WEBHOOK_PORT`. */
export function resolveWebhookListenPort(config: Pick<Env, "PORT" | "WEBHOOK_PORT">): number {
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

  return result.data;
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
