import { AsyncLocalStorage } from "node:async_hooks";

import { env } from "@fsm/config";
import { resolveDeploymentTier } from "@fsm/config/deployment-environment";

/**
 * APP_URL_ALLOWED: extra web origins for the tester tier.
 * - Exact origin match only (scheme + host + port). Entries with wildcards, paths, queries or non-http(s) schemes are ignored.
 * - https only; plain http is accepted only for localhost / 127.0.0.1.
 * - Non-primary origins are honored only when RENVANI_DEPLOYMENT_TIER=staging; elsewhere only APP_URL is used.
 * - APP_URL is always the primary (default for links and Stripe return URLs).
 */

type EnvSource = Record<string, string | undefined>;

function normalizeOrigin(entry: string): string | null {
  const trimmed = entry.trim();
  if (!trimmed || trimmed.includes("*")) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol === "http:") {
    if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
  } else if (url.protocol !== "https:") {
    return null;
  }
  if (url.username || url.password || url.search || url.hash) return null;
  if (url.pathname !== "/" && url.pathname !== "") return null;
  return url.origin;
}

export function parseAllowedOriginList(raw: string | undefined): string[] {
  const out: string[] = [];
  for (const entry of (raw ?? "").split(",")) {
    const origin = normalizeOrigin(entry);
    if (origin && !out.includes(origin)) out.push(origin);
  }
  return out;
}

export function primaryAppOrigin(appUrl: string = env.APP_URL): string {
  return new URL(appUrl).origin;
}

/** Extra (non-primary) origins honored in this process: empty unless the tier is staging. */
export function extraAppOrigins(
  source: { APP_URL: string; APP_URL_ALLOWED?: string } = env,
  tierEnv: EnvSource = process.env
): string[] {
  if (resolveDeploymentTier(tierEnv) !== "staging") return [];
  const primary = normalizeOrigin(source.APP_URL ?? "");
  return parseAllowedOriginList(source.APP_URL_ALLOWED).filter((origin) => origin !== primary);
}

/** Primary first, then tier-gated extras. */
export function allowedAppOrigins(
  source: { APP_URL: string; APP_URL_ALLOWED?: string } = env,
  tierEnv: EnvSource = process.env
): string[] {
  return [primaryAppOrigin(source.APP_URL), ...extraAppOrigins(source, tierEnv)];
}

/** Base URL for user-facing links: the request origin when it exactly matches an allowed origin, else APP_URL. */
export function resolveAppBaseUrl(
  requestOrigin: string | null | undefined,
  source: { APP_URL: string; APP_URL_ALLOWED?: string } = env,
  tierEnv: EnvSource = process.env
): string {
  const primaryBase = source.APP_URL.replace(/\/$/, "");
  if (!requestOrigin) return primaryBase;
  const candidate = normalizeOrigin(requestOrigin);
  if (!candidate) return primaryBase;
  return extraAppOrigins(source, tierEnv).includes(candidate) ? candidate : primaryBase;
}

const requestOriginStore = new AsyncLocalStorage<{ origin: string | null }>();

/** Run `fn` with the caller's Origin header bound (used by the API onRequest hook). */
export function runWithRequestOrigin<T>(origin: string | null | undefined, fn: () => T): T {
  return requestOriginStore.run({ origin: origin ?? null }, fn);
}

/** APP base URL for the current request (allowed Origin header in staging), falling back to APP_URL. */
export function currentAppBaseUrl(): string {
  return resolveAppBaseUrl(requestOriginStore.getStore()?.origin ?? null);
}
