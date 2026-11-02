import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  OutboundUrlBlockedError,
  assertOutboundUrlShape,
  fetchPublicUrl,
  isPublicIpAddress,
  resolvePublicAddress
} from "./outbound-url-guard.js";

describe("isPublicIpAddress", () => {
  it.each([
    "127.0.0.1",
    "127.1.2.3",
    "0.0.0.0",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "::ffff:10.0.0.1",
    "64:ff9b::a9fe:a9fe",
    "not-an-ip"
  ])("blocks %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111", "::ffff:8.8.8.8"])("allows %s", (address) => {
    expect(isPublicIpAddress(address)).toBe(true);
  });
});

describe("assertOutboundUrlShape", () => {
  it.each([
    ["loopback", "http://127.0.0.1/"],
    ["localhost", "http://localhost/"],
    ["sub.localhost", "http://a.localhost/"],
    ["metadata", "http://169.254.169.254/latest/meta-data/"],
    ["metadata host", "http://metadata.google.internal/"],
    ["10/8", "http://10.0.0.5/"],
    ["172.16/12", "https://172.20.1.1/"],
    ["192.168/16", "http://192.168.0.10/"],
    ["ipv6 loopback", "http://[::1]/"],
    ["ipv6 ula", "http://[fd00::1]/"],
    ["ipv6 link-local", "http://[fe80::1]/"],
    ["ipv4-mapped ipv6", "http://[::ffff:127.0.0.1]/"],
    ["ipv4-mapped ipv6 metadata", "http://[::ffff:169.254.169.254]/"],
    ["decimal ip", "http://2130706433/"],
    ["hex ip", "http://0x7f000001/"],
    ["octal ip", "http://0177.0.0.1/"],
    ["short form ip", "http://127.1/"],
    ["decimal metadata", "http://2852039166/"],
    ["userinfo", "http://user:pass@example.com/"],
    ["userinfo trick", "http://example.com@127.0.0.1/"],
    ["file scheme", "file:///etc/passwd"],
    ["gopher scheme", "gopher://example.com/"],
    ["ftp scheme", "ftp://example.com/"],
    ["non-web port", "http://example.com:6379/"]
  ])("blocks %s", (_label, url) => {
    expect(() => assertOutboundUrlShape(url)).toThrow(OutboundUrlBlockedError);
  });

  it("allows a public https URL", () => {
    expect(assertOutboundUrlShape("https://example.com/path").hostname).toBe("example.com");
  });
});

describe("resolvePublicAddress", () => {
  it("rejects when ANY resolved address is private (DNS resolves to private)", async () => {
    const resolver = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.1", family: 4 }
    ];
    await expect(resolvePublicAddress("rebind.example", resolver)).rejects.toBeInstanceOf(OutboundUrlBlockedError);
  });

  it("rejects metadata via DNS", async () => {
    const resolver = async () => [{ address: "169.254.169.254", family: 4 }];
    await expect(resolvePublicAddress("meta.example", resolver)).rejects.toBeInstanceOf(OutboundUrlBlockedError);
  });

  it("returns the address to pin when all are public", async () => {
    const resolver = async () => [{ address: "93.184.216.34", family: 4 }];
    await expect(resolvePublicAddress("ok.example", resolver)).resolves.toEqual({ address: "93.184.216.34", family: 4 });
  });
});

describe("fetchPublicUrl (pinned connection, redirects, limits)", () => {
  let server: http.Server;
  let port = 0;
  const hits: string[] = [];

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      hits.push(`${req.headers.host ?? ""}${req.url ?? ""}`);
      if (req.url === "/to-private-literal") {
        res.writeHead(302, { location: "http://10.0.0.1/" }).end();
      } else if (req.url === "/to-private-dns") {
        res.writeHead(302, { location: `http://evil.test:${port}/` }).end();
      } else if (req.url === "/to-ok") {
        res.writeHead(301, { location: "/ok" }).end();
      } else if (req.url === "/loop") {
        res.writeHead(302, { location: "/loop" }).end();
      } else if (req.url === "/big") {
        res.writeHead(200).end("x".repeat(5000));
      } else {
        res.writeHead(200, { "content-type": "text/html" }).end("<html>ok</html>");
      }
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // "public.test" stands in for a public site; the loopback test server is only allowed for that name.
  const resolver = async (host: string) =>
    host === "evil.test" ? [{ address: "169.254.169.254", family: 4 }] : [{ address: "127.0.0.1", family: 4 }];
  const opts = () => ({
    allowedPorts: [port],
    resolver,
    isAllowedAddress: (address: string) => address === "127.0.0.1" || isPublicIpAddress(address),
    timeoutMs: 3000
  });

  it("fetches a public URL over the pinned address", async () => {
    const res = await fetchPublicUrl(`http://public.test:${port}/ok`, opts());
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain("ok");
    expect(hits.at(-1)).toBe(`public.test:${port}/ok`);
  });

  it("follows a same-site redirect", async () => {
    const res = await fetchPublicUrl(`http://public.test:${port}/to-ok`, opts());
    expect(res.finalUrl).toBe(`http://public.test:${port}/ok`);
  });

  it("blocks redirect to a private IP literal", async () => {
    await expect(fetchPublicUrl(`http://public.test:${port}/to-private-literal`, opts())).rejects.toBeInstanceOf(
      OutboundUrlBlockedError
    );
  });

  it("blocks redirect to a host that resolves to a private address", async () => {
    const before = hits.length;
    await expect(fetchPublicUrl(`http://public.test:${port}/to-private-dns`, opts())).rejects.toBeInstanceOf(
      OutboundUrlBlockedError
    );
    expect(hits.slice(before).some((h) => h.startsWith("evil.test"))).toBe(false);
  });

  it("caps redirects", async () => {
    await expect(fetchPublicUrl(`http://public.test:${port}/loop`, { ...opts(), maxRedirects: 2 })).rejects.toThrow(
      /too many redirects/u
    );
  });

  it("caps response size", async () => {
    await expect(fetchPublicUrl(`http://public.test:${port}/big`, { ...opts(), maxBytes: 1000 })).rejects.toThrow(
      /too large/u
    );
  });

  it("blocks loopback by default (no test seam)", async () => {
    await expect(fetchPublicUrl(`http://127.0.0.1:${port}/ok`, { allowedPorts: [port] })).rejects.toBeInstanceOf(
      OutboundUrlBlockedError
    );
  });
});
