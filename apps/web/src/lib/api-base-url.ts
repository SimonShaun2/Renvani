import { publicEnv } from "@fsm/config";

/**
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` when written as a literal member access in app
 * code. `@fsm/config`'s `publicEnv` parses the whole `process.env` object, which is empty in the
 * browser bundle, so it always fell back to its schema default `http://localhost:3001`.
 */
export function resolveApiBaseUrl(inlined: string | undefined, fallback: string): string {
  const value = inlined?.trim() || fallback;
  return value.replace(/\/$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, publicEnv.NEXT_PUBLIC_API_URL);
