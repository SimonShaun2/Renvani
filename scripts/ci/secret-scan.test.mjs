import assert from "node:assert/strict";
import { test } from "node:test";

import { scanText } from "./secret-scan.mjs";

test("synthetic canary proves scanner is active without logging values", () => {
  const canary = "FS76_SCANNER_CANARY_" + "ABCDEFGH" + "JKLMNPQR";
  assert.deepEqual(scanText(canary), ["synthetic_canary"]);
});

test("scanner recognizes provider secrets and private-key envelopes", () => {
  const stripe = "sk_live_" + "A".repeat(24);
  const pem = "-----BEGIN PRIVATE KEY-----\n" + "A".repeat(100) + "\n-----END PRIVATE KEY-----";
  assert.deepEqual(scanText(stripe), ["provider_secret"]);
  assert.deepEqual(scanText(pem), ["private_key"]);
});

test("names and test placeholders do not trigger a finding", () => {
  assert.deepEqual(scanText("STRIPE_SECRET_KEY=sk_test_placeholder"), []);
});
