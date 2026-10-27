import { ApiError, type ApiErrorPayload } from "@/src/lib/api";
import { resolvePublicApiBase } from "@/src/lib/public-api";

/** FS-179: portal token lives in the URL fragment (never sent to the server), then in sessionStorage only. */
export const CUSTOMER_PORTAL_TOKEN_HEADER = "x-customer-portal-token";
const STORAGE_KEY = "renvani.customer-portal.token";

let memoryToken: string | null = null;

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
