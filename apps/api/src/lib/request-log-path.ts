/**
 * Request URLs for structured logs must not include secrets (e.g. SSE `access_token` query).
 */
export function requestPathForLog(rawUrl: string): string {
  const questionIndex = rawUrl.indexOf("?");
  if (questionIndex === -1) {
    return rawUrl;
  }

  return rawUrl.slice(0, questionIndex);
}

const BOOKING_MANAGE_TOKEN_PATH = /(\/public\/booking\/manage\/)[^/?#]+/g;

/** FS-153: customer manage links carry a bearer JWT as a path segment. */
export function redactManageTokenInPath(pathname: string): string {
  return pathname.replace(BOOKING_MANAGE_TOKEN_PATH, "$1[REDACTED]");
}

export function redactAccessTokenInUrl(rawUrl: string): string {
  const questionIndex = rawUrl.indexOf("?");
  if (questionIndex === -1) {
    return redactManageTokenInPath(rawUrl);
  }

  const pathname = redactManageTokenInPath(rawUrl.slice(0, questionIndex));
  const query = rawUrl.slice(questionIndex + 1);
  const params = new URLSearchParams(query);

  if (params.has("access_token")) {
    params.set("access_token", "[REDACTED]");
  }

  const redactedQuery = params.toString();
  return redactedQuery.length > 0 ? `${pathname}?${redactedQuery}` : pathname;
}
