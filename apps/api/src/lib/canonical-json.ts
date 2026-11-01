import { createHash } from "node:crypto";

/**
 * Deterministic JSON: object keys sorted by code point at every depth, `undefined` object members dropped,
 * arrays kept in order. Same output as JSON.stringify for already-sorted plain data, so it is safe to use
 * for idempotency/request hashes and content hashes. Shared by every service that hashes a request body.
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** sha256 hex of canonicalJson(value), optionally namespaced by a prefix (`${prefix}|${json}`). */
export function canonicalJsonSha256(value: unknown, prefix?: string): string {
  const json = canonicalJson(value);
  return createHash("sha256").update(prefix === undefined ? json : `${prefix}|${json}`).digest("hex");
}
