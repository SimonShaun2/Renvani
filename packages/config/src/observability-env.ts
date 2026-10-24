import { z } from "zod";

const sentryEnvSchema = z
  .object({
    SENTRY_DSN: z.string().url(),
    SENTRY_ENVIRONMENT: z.string().min(1).optional(),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0)
  })
  .strict();

const postHogServerEnvSchema = z
  .object({
    POSTHOG_API_KEY: z.string().min(1),
    POSTHOG_HOST: z.string().url().default("https://us.i.posthog.com")
  })
  .strict();

export type SentryEnvConfig = z.infer<typeof sentryEnvSchema>;
export type PostHogServerEnvConfig = z.infer<typeof postHogServerEnvSchema>;

export type SentryEnvResolution =
  | { enabled: false; reason: "missing_credentials" | "invalid_configuration" }
  | { enabled: true; config: SentryEnvConfig };

export type PostHogServerEnvResolution =
  | { enabled: false; reason: "missing_credentials" | "invalid_configuration" }
  | { enabled: true; config: PostHogServerEnvConfig };

export function resolveSentryNodeEnv(
  env: Record<string, string | undefined> = process.env
): SentryEnvResolution {
  const dsn = env.SENTRY_DSN?.trim() ?? "";
  if (dsn.length === 0) {
    return { enabled: false, reason: "missing_credentials" };
  }

  const parsed = sentryEnvSchema.safeParse({
    SENTRY_DSN: dsn,
    SENTRY_ENVIRONMENT: env.SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV?.trim() || "development",
    SENTRY_TRACES_SAMPLE_RATE: env.SENTRY_TRACES_SAMPLE_RATE
  });

  if (!parsed.success) {
    return { enabled: false, reason: "invalid_configuration" };
  }

  return { enabled: true, config: parsed.data };
}

export function resolvePostHogServerEnv(
  env: Record<string, string | undefined> = process.env
): PostHogServerEnvResolution {
  const apiKey = env.POSTHOG_API_KEY?.trim() ?? "";
  if (apiKey.length === 0) {
    return { enabled: false, reason: "missing_credentials" };
  }

  const parsed = postHogServerEnvSchema.safeParse({
    POSTHOG_API_KEY: apiKey,
    POSTHOG_HOST: env.POSTHOG_HOST?.trim() || undefined
  });

  if (!parsed.success) {
    return { enabled: false, reason: "invalid_configuration" };
  }

  return { enabled: true, config: parsed.data };
}

export function resolvePostHogWebEnv(
  env: Record<string, string | undefined> = process.env
): { enabled: false } | { enabled: true; apiKey: string; host: string } {
  const apiKey = env.NEXT_PUBLIC_POSTHOG_KEY?.trim() ?? "";
  if (apiKey.length === 0) {
    return { enabled: false };
  }

  const host = env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
  try {
    z.string().url().parse(host);
  } catch {
    return { enabled: false };
  }

  return { enabled: true, apiKey, host };
}

export function resolveSentryWebEnv(
  env: Record<string, string | undefined> = process.env
): { enabled: false } | { enabled: true; dsn: string; environment: string } {
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN?.trim() ?? "";
  if (dsn.length === 0) {
    return { enabled: false };
  }

  try {
    z.string().url().parse(dsn);
  } catch {
    return { enabled: false };
  }

  const environment =
    env.NEXT_PUBLIC_SENTRY_ENVIRONMENT?.trim() || env.NODE_ENV?.trim() || "development";

  return { enabled: true, dsn, environment };
}
