import { z } from "zod";

/**
 * Server-only env boundary for ORIGIN_SECRET (AGENTS.md: validate env with Zod).
 * Unset or empty means "don't forward". A set value must be header-safe: visible ASCII, no spaces, tabs or newlines.
 * The value is never included in errors or logs.
 */
const OriginSecretSchema = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value === "" ? undefined : value))
  .refine((value) => value === undefined || /^[\x21-\x7e]{1,4096}$/.test(value), {
    message: "ORIGIN_SECRET must be 1-4096 visible ASCII characters (no spaces or newlines)"
  });

export type OriginSecretResult = { ok: true; secret: string | undefined } | { ok: false; error: string };

export function readOriginSecret(env: Record<string, string | undefined> = process.env): OriginSecretResult {
  const parsed = OriginSecretSchema.safeParse(env.ORIGIN_SECRET);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "ORIGIN_SECRET is invalid" };
  return { ok: true, secret: parsed.data };
}
