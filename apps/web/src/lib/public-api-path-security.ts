const PUBLIC_API_PREFIX = "/api/v1/public";

const PUBLIC_API_PROXY_METHODS = new Set(["GET", "HEAD", "POST"]);

const ENCODED_DOT_SEGMENT = /^(?:\.|%2e|%2E)$/i;
const ENCODED_DOT_DOT_SEGMENT = /^(?:\.{2}|%2e%2e|%2E%2E|%2e%2E|%2E%2e)$/i;
const DOUBLE_ENCODED_DOT_ARTIFACT = /%25(?:2e|2E)/i;
const MAX_PATH_DECODE_ROUNDS = 4;

function decodePathRounds(value: string): string[] {
  const versions = [value];
  let current = value;

  for (let round = 0; round < MAX_PATH_DECODE_ROUNDS; round += 1) {
    try {
      const next = decodeURIComponent(current);
      if (next === current) {
        break;
      }

      versions.push(next);
      current = next;
    } catch {
      break;
    }
  }

  return versions;
}

export function isPublicApiProxyPath(pathname: string): boolean {
  return pathname === PUBLIC_API_PREFIX || pathname.startsWith(`${PUBLIC_API_PREFIX}/`);
}

export function isAllowedPublicApiProxyMethod(method: string): boolean {
  return PUBLIC_API_PROXY_METHODS.has(method.toUpperCase());
}

/** Reject path metacharacters in a single URL segment (booking slug, token, etc.). */
export function hasUnsafePublicPathSegment(segment: string): boolean {
  const trimmed = segment.trim();

  if (trimmed.length === 0 || trimmed.length > 100) {
    return true;
  }

  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("%")) {
    return true;
  }

  if (trimmed.includes("..")) {
    return true;
  }

  return ENCODED_DOT_DOT_SEGMENT.test(trimmed) || ENCODED_DOT_SEGMENT.test(trimmed);
}

function segmentIsTraversal(segment: string): boolean {
  if (ENCODED_DOT_DOT_SEGMENT.test(segment)) {
    return true;
  }

  if (ENCODED_DOT_SEGMENT.test(segment)) {
    return true;
  }

  let decoded = segment;

  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return true;
  }

  return decoded === ".." || decoded === ".";
}

function haystackHasTraversal(haystack: string): boolean {
  if (DOUBLE_ENCODED_DOT_ARTIFACT.test(haystack)) {
    return true;
  }

  for (const candidate of decodePathRounds(haystack)) {
    if (candidate.includes("\\") || candidate.includes("..")) {
      return true;
    }

    if (/%2e%2e/i.test(candidate)) {
      return true;
    }

    const segments = candidate.split("/").filter(Boolean);

    if (segments.some(segmentIsTraversal)) {
      return true;
    }
  }

  return false;
}

/**
 * Reject path traversal on the Next.js public API proxy prefix (Security follow-up).
 */
export function hasPublicApiPathTraversal(pathname: string): boolean {
  if (!isPublicApiProxyPath(pathname)) {
    return false;
  }

  return haystackHasTraversal(pathname);
}

/** Middleware: also inspect raw request URL (Next may normalize pathname). */
export function hasPublicApiPathTraversalInRequest(requestUrl: string, pathname: string): boolean {
  if (!isPublicApiProxyPath(pathname) && !requestUrl.includes("/api/v1/public")) {
    return false;
  }

  return haystackHasTraversal(pathname) || haystackHasTraversal(requestUrl);
}

export function assertSafePublicApiRequestPath(path: string): void {
  if (!path.startsWith(`${PUBLIC_API_PREFIX}/`)) {
    return;
  }

  if (hasPublicApiPathTraversal(path)) {
    throw new Error("Invalid public API path");
  }
}

export function assertSafePublicBookingSlug(slug: string): void {
  if (hasUnsafePublicPathSegment(slug)) {
    throw new Error("Invalid public booking slug");
  }
}
