import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { requiredServiceTemplateErrors } from "./check-env-documentation.mjs";

const templates = join(import.meta.dirname, "..", "docs", "env", "templates");

for (const [file, requiredKey] of [
  ["worker.env.example", "APP_URL"],
  ["api.env.example", "STRIPE_SECRET_KEY"],
  ["webhook.env.example", "STRIPE_WEBHOOK_SECRET"]
]) {
  test(`${file} fails closed without ${requiredKey}`, () => {
    const source = readFileSync(join(templates, file), "utf8");
    assert.deepEqual(requiredServiceTemplateErrors(file, source), []);
    const withoutKey = source.replace(new RegExp(`^${requiredKey}=.*\\r?\\n?`, "m"), "");
    assert.notEqual(withoutKey, source);
    assert.deepEqual(requiredServiceTemplateErrors(file, withoutKey), [
      `${file}: missing keys: ${requiredKey}`
    ]);
  });
}
