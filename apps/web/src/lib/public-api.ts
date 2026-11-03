import { ErrorCode } from "@fsm/types";

import { ApiError, type ApiErrorPayload } from "@/src/lib/api";
import { assertSafePublicApiRequestPath } from "@/src/lib/public-api-path-security";

/** Browser public requests stay same-origin through the Next.js rewrite. */
export function resolvePublicApiBase(): string {
  return "";
}

async function parseError(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return {
      error: "NOT_IMPLEMENTED" as ErrorCode,
      message: "Request failed"
    };
  }
}

async function publicApiFetch<TResponse>(path: string, options: RequestInit = {}): Promise<TResponse> {
  try {
    assertSafePublicApiRequestPath(path);
  } catch {
    throw new ApiError(400, {
      error: ErrorCode.VALIDATION_ERROR,
      message: "Invalid public API path"
    });
  }

  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${resolvePublicApiBase()}${path}`, {
    ...options,
    credentials: "include",
    headers
  });

  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}

export const publicApi = {
  get: <TResponse>(path: string) => publicApiFetch<TResponse>(path),
  post: <TResponse>(path: string, body: unknown, options?: { headers?: Record<string, string> }) => {
    const init: RequestInit = {
      method: "POST",
      body: JSON.stringify(body)
    };

    if (options?.headers) {
      init.headers = options.headers;
    }

    return publicApiFetch<TResponse>(path, init);
  }
};
