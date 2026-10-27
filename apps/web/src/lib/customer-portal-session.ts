import { ApiError, type ApiErrorPayload } from "@/src/lib/api";
import { resolvePublicApiBase } from "@/src/lib/public-api";

/** FS-179: portal token lives in the URL fragment (never sent to the server), then in sessionStorage only. */
export const CUSTOMER_PORTAL_TOKEN_HEADER = "x-customer-portal-token";
const STORAGE_KEY = "renvani.customer-portal.token";

let memoryToken: string | null = null;
let scopeToken: string | null = null;
let scopeId = "none";

function newScopeId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Non-secret cache scope for the current portal credential. A new random id is
 * minted whenever the token changes, so cached portal data never crosses customers.
 */
export function customerPortalScope(token: string | null): string {
  if (!token) return "none";
  if (token !== scopeToken) {
    scopeToken = token;
    scopeId = newScopeId();
  }
  return scopeId;
}

/** Read `#token=` from the fragment, strip it from the URL, and keep it in memory + sessionStorage. */
export function captureCustomerPortalToken(): string | null {
  if (typeof window === "undefined") return memoryToken;
  const hash = window.location.hash.replace(/^#/, "");
  const fromHash = new URLSearchParams(hash).get("token");
  if (fromHash) {
    memoryToken = fromHash;
    try {
      window.sessionStorage.setItem(STORAGE_KEY, fromHash);
    } catch {
      // storage unavailable: memory only
    }
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
    return fromHash;
  }
  if (memoryToken) return memoryToken;
  try {
    memoryToken = window.sessionStorage.getItem(STORAGE_KEY);
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export function clearCustomerPortalToken(): void {
  memoryToken = null;
  scopeToken = null;
  scopeId = "none";
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function customerPortalGet<T>(path: string, token: string): Promise<T> {
  const response = await fetch(`${resolvePublicApiBase()}/api/v1/public/customer-portal${path}`, {
    headers: { [CUSTOMER_PORTAL_TOKEN_HEADER]: token },
    credentials: "omit",
    cache: "no-store"
  });
  if (!response.ok) {
    let payload: ApiErrorPayload;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = { error: "NOT_IMPLEMENTED", message: "Request failed" };
    }
    throw new ApiError(response.status, payload);
  }
  return (await response.json()) as T;
}

export function isPortalLinkExpired(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 401 || error.status === 403);
}
