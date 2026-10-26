import { publicEnv } from "@fsm/config";
import type { ErrorCode } from "@fsm/types";

import { clearBrowserAuthSession, getAuthToken } from "./auth";
import { CLERK_NO_ACCESS_ROUTE } from "./clerk/route-decision";
import { getClerkSessionToken, signOutClerkSession } from "./clerk/token-bridge";

const API_BASE = publicEnv.NEXT_PUBLIC_API_URL;

export interface ApiErrorPayload {
  error: ErrorCode | "NOT_IMPLEMENTED";
  message: string;
  requestId?: string;
  fields?: Record<string, string> | null;
}

export class ApiError extends Error {
  readonly status: number;
  readonly payload: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function parseError(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return {
      error: "NOT_IMPLEMENTED",
      message: "Request failed"
    };
  }
}

/**
 * Bearer token precedence (explicit): a live Clerk session token wins over the legacy in-repo JWT.
 * Clerk is only registered when NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set and the user signed in
 * with Clerk; otherwise the legacy JWT is used. Never both at once.
 */
export async function resolveBearerToken(): Promise<{ token: string | null; source: "clerk" | "legacy" | null }> {
  const clerk = await getClerkSessionToken();
  if (clerk) return { token: clerk, source: "clerk" };
  const legacy = getAuthToken();
  return legacy ? { token: legacy, source: "legacy" } : { token: null, source: null };
}

/** Login URL used after an API 401. Exported for tests. */
export const UNAUTHORIZED_REDIRECT = "/login";

/**
 * On API 401: clear the legacy session and, for Clerk sessions, sign out of Clerk too.
 * Otherwise middleware would see the Clerk user on /login, send it back to the app,
 * and the same 401 would repeat forever.
 */
export async function handleUnauthorized(source: "clerk" | "legacy" | null): Promise<void> {
  clearBrowserAuthSession();
  if (source === "clerk") {
    if (await signOutClerkSession(UNAUTHORIZED_REDIRECT)) return;
    // signOut failed: the Clerk session still exists, so /login would bounce back. Use the no-access page.
    if (typeof window !== "undefined") window.location.assign(CLERK_NO_ACCESS_ROUTE);
    return;
  }
  if (typeof window !== "undefined") {
    window.location.assign(UNAUTHORIZED_REDIRECT);
  }
}

async function apiFetch<TResponse>(path: string, options: RequestInit = {}): Promise<TResponse> {
  const { token, source } = await resolveBearerToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers
  });

  if (response.status === 401) {
    await handleUnauthorized(source);
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export const api = {
  get: <TResponse>(path: string) => apiFetch<TResponse>(path),
  post: <TResponse>(path: string, body: unknown) =>
    apiFetch<TResponse>(path, {
      method: "POST",
      body: JSON.stringify(body)
    }),
  patch: <TResponse>(path: string, body: unknown) =>
    apiFetch<TResponse>(path, {
      method: "PATCH",
      body: JSON.stringify(body)
    }),
  put: <TResponse>(path: string, body: unknown) =>
    apiFetch<TResponse>(path, {
      method: "PUT",
      body: JSON.stringify(body)
    }),
  delete: <TResponse>(path: string) =>
    apiFetch<TResponse>(path, {
      method: "DELETE"
    })
};
