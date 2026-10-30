/**
 * Request URLs for structured logs must not include secrets (e.g. SSE `access_token` query).
 */
export function requestPathForLog(rawUrl: string): string {
  const questionIndex = rawUrl.indexOf("?");
  if (questionIndex === -1) {
    return redactManageTokenInPath(rawUrl);
  }

  return redactManageTokenInPath(rawUrl.slice(0, questionIndex));
}

/** Public routes whose next path segment is a bearer token (manage JWT, VIP join token). */
const TOKEN_PATH_PREFIXES = ["/public/booking/manage/", "/public/vip/join/"] as const;

const TOKEN_PATH_PATTERNS = TOKEN_PATH_PREFIXES.map(
  (prefix) => new RegExp(`(${prefix.replace(/[/]/g, "\\/")})[^/?#]+`, "g")
);

/** Redacts the token segment after any TOKEN_PATH_PREFIXES entry (FS-153 manage links, VIP join links). */
export function redactManageTokenInPath(pathname: string): string {
  return TOKEN_PATH_PATTERNS.reduce((path, pattern) => path.replace(pattern, "$1[REDACTED]"), pathname);
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
