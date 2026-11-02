import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupFunction } from "node:net";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";

/**
 * Audit H2 (SSRF): shared guard for server-side fetches of user-supplied URLs.
 * - only http(s), no userinfo, allowed ports only;
 * - IP literals (WHATWG URL already canonicalises decimal/hex/octal IPv4) must be public;
 * - hostnames are resolved and EVERY address must be public; the connection is pinned to the
 *   validated address via a custom `lookup`, so there is no TOCTOU/DNS-rebinding window;
 * - redirects are followed manually (each hop re-validated), capped; timeout and body size are capped.
 */

const BLOCKED_IPV4_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4]
];

const BLOCKED_IPV6_CIDRS: ReadonlyArray<readonly [string, number]> = [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["64:ff9b:1::", 48],
  ["100::", 64],
  ["2001::", 32],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8]
];

const blockList = new BlockList();
for (const [address, prefix] of BLOCKED_IPV4_CIDRS) blockList.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of BLOCKED_IPV6_CIDRS) blockList.addSubnet(address, prefix, "ipv6");

const BLOCKED_HOSTNAME_SUFFIXES = [".localhost", ".local", ".internal", ".localdomain"];
const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata", "metadata.google.internal"]);

export class OutboundUrlBlockedError extends Error {
  constructor(reason: string) {
    super(`Outbound URL blocked: ${reason}`);
    this.name = "OutboundUrlBlockedError";
  }
}

/** Embedded IPv4 in IPv4-mapped (::ffff:a.b.c.d / ::ffff:hhhh:hhhh) or IPv4-compatible IPv6. */
function embeddedIpv4(ipv6: string): string | null {
  const lower = ipv6.toLowerCase();
  const dotted = /^(?:::ffff:(?:0:)?|::)(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(lower);
  if (dotted?.[1]) return dotted[1];
  const hex = /^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/u.exec(lower);
  if (hex?.[1] && hex[2]) {
    const hi = Number.parseInt(hex[1], 16);
    const lo = Number.parseInt(hex[2], 16);
    return `${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`;
  }
  return null;
}

export function isPublicIpAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/gu, "").split("%")[0] ?? "";
  const family = isIP(bare);
  if (family === 4) return !blockList.check(bare, "ipv4");
  if (family === 6) {
    const v4 = embeddedIpv4(bare);
    if (v4 !== null) return isIP(v4) === 4 && !blockList.check(v4, "ipv4");
    if (/^::ffff:/iu.test(bare)) return false;
    return !blockList.check(bare, "ipv6");
  }
  return false;
}

export interface OutboundUrlPolicy {
  allowedPorts?: readonly number[];
}

/** Synchronous checks (scheme, userinfo, port, hostname, IP literal). Returns the parsed URL. */
export function assertOutboundUrlShape(raw: string | URL, policy: OutboundUrlPolicy = {}): URL {
  let url: URL;
  try {
    url = new URL(raw.toString());
  } catch {
    throw new OutboundUrlBlockedError("invalid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new OutboundUrlBlockedError("scheme");
  if (url.username !== "" || url.password !== "") throw new OutboundUrlBlockedError("userinfo");
  const port = url.port === "" ? (url.protocol === "https:" ? 443 : 80) : Number(url.port);
  if (!(policy.allowedPorts ?? [80, 443]).includes(port)) throw new OutboundUrlBlockedError("port");
  const host = url.hostname.toLowerCase().replace(/\.$/u, "");
  if (host.length === 0 || BLOCKED_HOSTNAMES.has(host) || BLOCKED_HOSTNAME_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new OutboundUrlBlockedError("hostname");
  }
  const literal = host.replace(/^\[|\]$/gu, "");
  if (isIP(literal) !== 0 && !isPublicIpAddress(literal)) throw new OutboundUrlBlockedError("address");
  return url;
}

export type OutboundResolver = (hostname: string) => Promise<Array<{ address: string; family: number }>>;

const defaultResolver: OutboundResolver = (hostname) => dnsLookup(hostname, { all: true, verbatim: true });

/** Resolve and require every address to be public; returns the first (the one we pin to). */
export async function resolvePublicAddress(
  hostname: string,
  resolver: OutboundResolver = defaultResolver,
  isAllowedAddress: (address: string) => boolean = isPublicIpAddress
): Promise<{ address: string; family: number }> {
  const literal = hostname.replace(/^\[|\]$/gu, "");
  const literalFamily = isIP(literal);
  const records = literalFamily !== 0 ? [{ address: literal, family: literalFamily }] : await resolver(hostname);
  if (records.length === 0) throw new OutboundUrlBlockedError("unresolvable");
  for (const record of records) {
    if (!isAllowedAddress(record.address)) throw new OutboundUrlBlockedError("resolves to a non-public address");
  }
  return records[0] as { address: string; family: number };
}

export interface FetchPublicUrlOptions extends OutboundUrlPolicy {
  timeoutMs?: number;
  maxRedirects?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  /** Test seams. */
  resolver?: OutboundResolver;
  isAllowedAddress?: (address: string) => boolean;
}

export interface FetchPublicUrlResult {
  statusCode: number;
  body: string;
  finalUrl: string;
}

function requestOnce(
  url: URL,
  pinned: { address: string; family: number },
  options: Required<Pick<FetchPublicUrlOptions, "timeoutMs" | "maxBytes">> & { headers: Record<string, string> }
): Promise<{ statusCode: number; location: string | null; body: string }> {
  const pinnedLookup = ((_host: string, opts: unknown, cb: unknown) => {
    const callback = (typeof opts === "function" ? opts : cb) as (...args: unknown[]) => void;
    const all = typeof opts === "object" && opts !== null && (opts as { all?: boolean }).all === true;
    if (all) callback(null, [{ address: pinned.address, family: pinned.family }]);
    else callback(null, pinned.address, pinned.family);
  }) as LookupFunction;
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = transport.request(
      url,
      { method: "GET", headers: options.headers, lookup: pinnedLookup, timeout: options.timeoutMs },
      (res) => {
        const statusCode = res.statusCode ?? 0;
        const location = typeof res.headers.location === "string" ? res.headers.location : null;
        if (statusCode >= 300 && statusCode < 400 && location) {
          res.resume();
          resolve({ statusCode, location, body: "" });
          return;
        }
        const chunks: Buffer[] = [];
        let tooLarge = false;
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > options.maxBytes) {
            tooLarge = true;
            res.destroy();
            req.destroy();
            reject(new OutboundUrlBlockedError("response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => !tooLarge && resolve({ statusCode, location: null, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      }
    );
    req.on("timeout", () => req.destroy(new OutboundUrlBlockedError("timeout")));
    req.on("error", (error) => reject(error));
    req.end();
  });
}

/** GET a user-supplied URL safely (see module comment). Throws OutboundUrlBlockedError on policy violations. */
export async function fetchPublicUrl(raw: string | URL, options: FetchPublicUrlOptions = {}): Promise<FetchPublicUrlResult> {
  const maxRedirects = options.maxRedirects ?? 3;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const headers = options.headers ?? {};
  let current = assertOutboundUrlShape(raw, options);
  const deadline = Date.now() + timeoutMs;

  for (let hop = 0; ; hop += 1) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new OutboundUrlBlockedError("timeout");
    const pinned = await resolvePublicAddress(current.hostname, options.resolver, options.isAllowedAddress);
    const response = await requestOnce(current, pinned, { timeoutMs: remaining, maxBytes, headers });
    if (response.location === null) {
      return { statusCode: response.statusCode, body: response.body, finalUrl: current.toString() };
    }
    if (hop >= maxRedirects) throw new OutboundUrlBlockedError("too many redirects");
    current = assertOutboundUrlShape(new URL(response.location, current), options);
  }
}
