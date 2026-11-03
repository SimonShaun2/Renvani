import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { canonicalJson, canonicalJsonSha256 } from "./canonical-json.js";

describe("canonicalJson (shared util)", () => {
  it("sorts keys at every depth, drops undefined members and keeps array order", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: undefined, x: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[3,{"x":2,"z":1}]},"b":1}');
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    expect(canonicalJson([2, 1])).not.toBe(canonicalJson([1, 2]));
  });

  it("matches JSON.stringify for already-sorted plain data (stored hashes stay stable)", () => {
    const value = { a: "x", b: [1, "two", true, null], c: { d: 1.5 } };
    expect(canonicalJson(value)).toBe(JSON.stringify(value));
    expect(canonicalJson("s")).toBe('"s"');
    expect(canonicalJson(7)).toBe("7");
  });

  it("matches the previous top-level-sorted findings-review hash input for flat bodies", () => {
    const body = { reason: "dup", action: "dismiss", expectedVersion: 3 };
    const legacy = JSON.stringify(Object.fromEntries(Object.entries(body).sort(([a], [b]) => a.localeCompare(b))));
    expect(canonicalJson(body)).toBe(legacy);
  });

  it("hashes with an optional prefix", () => {
    const sha = (s: string) => createHash("sha256").update(s).digest("hex");
    expect(canonicalJsonSha256({ b: 1, a: 2 })).toBe(sha('{"a":2,"b":1}'));
    expect(canonicalJsonSha256({ a: 2 }, "op")).toBe(sha('op|{"a":2}'));
  });
});
