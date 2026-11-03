import "server-only";

/** Server-only direct API origin for SSR fetches; client code must use same-origin rewrites. */
export function resolvePublicApiServerBase(source: Record<string, string | undefined> = process.env): string {
  const base = source.API_URL ?? source.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  return base.replace(/\/$/, "");
}
