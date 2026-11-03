import { z } from "zod";

const langfuseEnvSchema = z
  .object({
    LANGFUSE_PUBLIC_KEY: z.string().min(1),
    LANGFUSE_SECRET_KEY: z.string().min(1),
    LANGFUSE_BASE_URL: z.string().url().default("https://cloud.langfuse.com")
  })
  .strict();

export type LangfuseEnvConfig = z.infer<typeof langfuseEnvSchema>;

export type LangfuseEnvResolution =
  | { enabled: false; reason: "missing_credentials" | "invalid_configuration" }
  | { enabled: true; config: LangfuseEnvConfig };

function pickLangfuseEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    LANGFUSE_PUBLIC_KEY: env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: env.LANGFUSE_SECRET_KEY,
    LANGFUSE_BASE_URL: env.LANGFUSE_BASE_URL
  };
}

/**
 * Optional Langfuse credentials — never part of required startup env.
 * Enabled only when both public and secret keys are non-empty and valid.
 */
export function resolveLangfuseEnv(
  env: Record<string, string | undefined> = process.env
): LangfuseEnvResolution {
  const publicKey = env.LANGFUSE_PUBLIC_KEY?.trim() ?? "";
  const secretKey = env.LANGFUSE_SECRET_KEY?.trim() ?? "";

  if (publicKey.length === 0 && secretKey.length === 0) {
    return { enabled: false, reason: "missing_credentials" };
  }

  if (publicKey.length === 0 || secretKey.length === 0) {
    return { enabled: false, reason: "invalid_configuration" };
  }

  const parsed = langfuseEnvSchema.safeParse(pickLangfuseEnv(env));
  if (!parsed.success) {
    return { enabled: false, reason: "invalid_configuration" };
  }

  return { enabled: true, config: parsed.data };
}

export function isLangfuseConfigured(
  env: Record<string, string | undefined> = process.env
): boolean {
  return resolveLangfuseEnv(env).enabled;
}
