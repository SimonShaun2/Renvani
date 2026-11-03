import { describe, expect, it } from "vitest";

import { normalizePhoneE164 } from "./index.js";

describe("normalizePhoneE164 (FS-281)", () => {
  it.each([
    ["(555) 010-0100", "+15550100100"],
    ["555-010-0100", "+15550100100"],
    ["1 555 010 0100", "+15550100100"],
    ["+1 (555) 010-0100", "+15550100100"],
    ["+447700900123", "+447700900123"],
    ["  5550100100 ", "+15550100100"]
  ])("%s -> %s", (input, expected) => expect(normalizePhoneE164(input)).toBe(expected));

  it.each([null, undefined, "", "555-0100", "25550100100", "+1234567", "+1234567890123456", "abc"])(
    "%s -> null (fail closed)",
    (input) => expect(normalizePhoneE164(input as string | null | undefined)).toBeNull()
  );
});
