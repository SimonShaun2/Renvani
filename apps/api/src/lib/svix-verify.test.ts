import { describe, expect, it } from "vitest";

import { signSvixPayload, verifySvixSignature } from "./svix-verify.js";

const SECRET = `whsec_${Buffer.from("k").toString("base64")}`;

describe("verifySvixSignature", () => {
  it("accepts a valid signature among several and rejects tampering", () => {
    const sig = signSvixPayload(SECRET, "id1", "1000", "{}");
    const headers = { id: "id1", timestamp: "1000", signature: `v1,bogus v1,${sig}` };
    expect(verifySvixSignature(SECRET, headers, "{}", 1000)).toBe(true);
    expect(verifySvixSignature(SECRET, headers, "{\"x\":1}", 1000)).toBe(false);
    expect(verifySvixSignature(SECRET, headers, "{}", 2000)).toBe(false);
    expect(verifySvixSignature("", headers, "{}", 1000)).toBe(false);
  });
});
