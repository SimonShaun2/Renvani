import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAcceptanceFixture,
  buildTradeFixture,
  normalizeRunId,
  validateAcceptanceFixture
} from "./fs231-two-trade-fixtures.mjs";

test("builds one deterministic HVAC and plumbing fixture", () => {
  const first = buildAcceptanceFixture("qa-20261101");
  const second = buildAcceptanceFixture("qa-20261101");
  assert.deepEqual(first, second);
  assert.deepEqual(first.trades.map(({ trade }) => trade), ["hvac", "plumbing"]);
  assert.equal(validateAcceptanceFixture(first), true);
});

test("uses synthetic contacts and defaults all messaging consent off", () => {
  for (const fixture of buildAcceptanceFixture("qa-20261101").trades) {
    assert.match(fixture.email, /@example\.com$/u);
    assert.match(fixture.inquiry.phone, /^\+1202555013[12]$/u);
    assert.equal(fixture.inquiry.smsConsentAppointments, false);
    assert.equal(fixture.inquiry.smsConsentMarketing, false);
  }
});

test("models out-of-area and idempotency mismatch negatives", () => {
  for (const fixture of buildAcceptanceFixture("qa-20261101").trades) {
    assert.notEqual(fixture.servedZip, fixture.outsideZip);
    assert.equal(fixture.negatives.outsideArea.zip, fixture.outsideZip);
    assert.equal(fixture.negatives.idempotencyReplay.payload, fixture.inquiry);
    assert.notDeepEqual(fixture.negatives.idempotencyMismatch.payload, fixture.inquiry);
    assert.equal(fixture.negatives.idempotencyReplay.header, fixture.negatives.idempotencyMismatch.header);
  }
});

test("declares browser, technician, payment, and retention gates instead of bypassing them", () => {
  assert.deepEqual(
    buildAcceptanceFixture("qa-20261101").blockedGates.map(({ gate }) => gate),
    ["browser", "technician-role", "payment", "retention-send"]
  );
});

test("rejects unsupported trades and unsafe run ids", () => {
  assert.throws(() => buildTradeFixture("electrical", "qa-20261101"), /unsupported trade/u);
  assert.throws(() => normalizeRunId("!!"), /run id/u);
});

test("normalizes a bounded run id", () => {
  assert.equal(normalizeRunId(" QA 2026/11/01 "), "qa-2026-11-01");
});

