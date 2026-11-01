#!/usr/bin/env node

import { pathToFileURL } from "node:url";

const ZIP_BY_TRADE = Object.freeze({
  hvac: Object.freeze({ served: "74103", outside: "99999" }),
  plumbing: Object.freeze({ served: "73102", outside: "99999" })
});

const SERVICE_BY_TRADE = Object.freeze({
  hvac: Object.freeze({ category: "hvac", type: "hvac.ac_repair", detail: "No cooling; synthetic Carrier model and serial" }),
  plumbing: Object.freeze({ category: "plumbing", type: "plumbing.leak_repair", detail: "Active synthetic kitchen fixture leak" })
});

export function normalizeRunId(value) {
  const normalized = String(value ?? "local").trim().toLowerCase().replace(/[^a-z0-9-]/gu, "-");
  if (!/^[a-z0-9][a-z0-9-]{2,31}$/u.test(normalized)) {
    throw new Error("run id must be 3-32 lowercase letters, numbers, or hyphens");
  }
  return normalized;
}

export function buildTradeFixture(trade, runId = "local") {
  if (!(trade in ZIP_BY_TRADE)) {
    throw new Error(`unsupported trade: ${trade}`);
  }

  const id = normalizeRunId(runId);
  const title = trade === "hvac" ? "HVAC" : "Plumbing";
  const service = SERVICE_BY_TRADE[trade];
  const zip = ZIP_BY_TRADE[trade];
  const slug = `fs231-${trade}-${id}`;
  const email = `fs231-${trade}-${id}@example.com`;

  const inquiry = {
    firstName: "Synthetic",
    lastName: `${title} QA`,
    phone: trade === "hvac" ? "+12025550131" : "+12025550132",
    email,
    addressLine1: "231 Test Loop",
    city: trade === "hvac" ? "Tulsa" : "Oklahoma City",
    state: "OK",
    zip: zip.served,
    propertyType: "residential",
    serviceCategory: service.category,
    serviceType: service.type,
    serviceDetail: service.detail,
    urgency: "emergency",
    emergency: true,
    customerNotes: `FS-231 ${title} synthetic acceptance; do not contact`,
    preferredWindow: "first_available",
    isPropertyOwner: true,
    smsConsentAppointments: false,
    smsConsentMarketing: false,
    leadAttribution: { source: "fs231_qa", medium: "synthetic", campaign: id }
  };

  return Object.freeze({
    trade,
    title,
    slug,
    email,
    servedZip: zip.served,
    outsideZip: zip.outside,
    inquiry: Object.freeze(inquiry),
    negatives: Object.freeze({
      outsideArea: Object.freeze({ ...inquiry, zip: zip.outside }),
      idempotencyReplay: Object.freeze({ header: `fs231-${trade}-${id}`, payload: inquiry }),
      idempotencyMismatch: Object.freeze({
        header: `fs231-${trade}-${id}`,
        payload: Object.freeze({ ...inquiry, customerNotes: `${inquiry.customerNotes}; altered payload` })
      })
    })
  });
}

export function buildAcceptanceFixture(runId = "local") {
  const id = normalizeRunId(runId);
  return Object.freeze({
    ticket: "FS-231",
    baseSha: "5baad8775cfa6a5e3c3e163ed6b384a284b12f20",
    runId: id,
    safety: Object.freeze({
      syntheticOnly: true,
      realCustomerCommunications: false,
      liveMoney: false,
      consentDefaultsToFalse: true
    }),
    trades: Object.freeze([buildTradeFixture("hvac", id), buildTradeFixture("plumbing", id)]),
    blockedGates: Object.freeze([
      Object.freeze({ gate: "browser", requires: "an exact-SHA web deployment plus authenticated synthetic session" }),
      Object.freeze({ gate: "technician-role", requires: "a synthetic technician identity assigned to each job" }),
      Object.freeze({ gate: "payment", requires: "positive confirmation that Stripe is in test mode and a test connected account" }),
      Object.freeze({ gate: "retention-send", requires: "explicit synthetic consent and a provider sink that cannot contact a real recipient" })
    ])
  });
}

export function validateAcceptanceFixture(fixture) {
  if (fixture.trades.length !== 2 || new Set(fixture.trades.map((item) => item.trade)).size !== 2) {
    throw new Error("fixture must contain one HVAC and one plumbing journey");
  }
  for (const trade of fixture.trades) {
    if (!trade.email.endsWith("@example.com")) throw new Error("fixture email must use example.com");
    if (trade.inquiry.smsConsentAppointments || trade.inquiry.smsConsentMarketing) {
      throw new Error("fixture consent must default to false");
    }
    if (trade.servedZip === trade.outsideZip) throw new Error("negative ZIP must differ from served ZIP");
  }
  if (!fixture.safety.syntheticOnly || fixture.safety.liveMoney || fixture.safety.realCustomerCommunications) {
    throw new Error("unsafe FS-231 fixture");
  }
  return true;
}

function main(argv) {
  const runIdIndex = argv.indexOf("--run-id");
  const runId = runIdIndex === -1 ? "local" : argv[runIdIndex + 1];
  const fixture = buildAcceptanceFixture(runId);
  validateAcceptanceFixture(fixture);
  process.stdout.write(`${JSON.stringify(fixture, null, argv.includes("--compact") ? 0 : 2)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2));
}

