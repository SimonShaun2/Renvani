import { publicEnv } from "@fsm/config";
import type { ErrorCode } from "@fsm/types";

import { clearBrowserAuthSession, getAuthToken } from "./auth";
import { getClerkSessionToken } from "./clerk/token-bridge";

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

async function apiFetch<TResponse>(path: string, options: RequestInit = {}): Promise<TResponse> {
  // Prefer the Clerk session token when signed in with Clerk; fall back to the legacy in-repo JWT.
  const token = (await getClerkSessionToken()) ?? getAuthToken();
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
    clearBrowserAuthSession();

    if (typeof window !== "undefined") {
      window.location.assign("/login");
    }
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
