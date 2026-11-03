/**
 * Next.js only inlines `process.env.NEXT_PUBLIC_*` when written as a literal member access in app
 * code. Keep browser configuration local so server config cannot enter the client graph.
 */
export function resolveApiBaseUrl(inlined: string | undefined, fallback: string): string {
  const value = inlined?.trim() || fallback;
  return value.replace(/\/$/, "");
}

export const API_BASE_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, "http://localhost:3001");
