import request from "supertest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ErrorCode,
  SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT,
  SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION
} from "@fsm/types";

import { closeTestApp } from "../../test-support/close-test-app.js";
import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});

vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});

const attachImportedPaymentMethodMock = vi.fn();

vi.mock("../../lib/stripe-saved-card-import.adapter.js", () => ({
  assertStripeTestModeForCardMigration: vi.fn(),
  RENVANI_STRIPE_PAN_IMPORT_DOCS_URL: "https://docs.stripe.com/test",
  attachImportedPaymentMethodToCustomer: attachImportedPaymentMethodMock
}));

const sendRenderedTemplateEmailMock = vi.fn();

vi.mock("../../lib/outbound-email.js", () => ({
  sendRenderedTemplateEmail: sendRenderedTemplateEmailMock,
  deliverTransactionalEmail: vi.fn(),
  getTransactionalEmailFromAddress: vi.fn()
}));

type BuildAppModule = typeof import("../../app.js");
type FakeDbModule = typeof import("../../test-support/fake-db.js");
type TokensModule = typeof import("../../lib/tokens.js");
type AppInstance = Awaited<ReturnType<BuildAppModule["buildApp"]>>;

let buildAppModule: BuildAppModule;
let fakeDb: FakeDbModule;
let tokens: TokensModule;
let app: AppInstance;

beforeAll(async () => {
  buildAppModule = await import("../../app.js");
  fakeDb = await import("../../test-support/fake-db.js");
  tokens = await import("../../lib/tokens.js");
});

beforeEach(async () => {
  fakeDb.resetTestState();
  attachImportedPaymentMethodMock.mockReset();
  sendRenderedTemplateEmailMock.mockReset();
  attachImportedPaymentMethodMock.mockResolvedValue({ paymentMethodLabel: "VISA ending in 4242" });
  app = await buildAppModule.buildApp();
  await app.ready();
});

afterEach(async () => {
  await closeTestApp(app);
});

function createAuthContext(role: "owner" | "admin" = "owner") {
  const company = fakeDb.seedCompany({
    name: "Card Migrate Co",
    slug: `card-migrate-${String(Math.random()).slice(2, 8)}`,
    timezone: "America/Chicago",
    stripeAccountId: "acct_test_connect"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: `${role}@card-migrate.test`,
    firstName: "Owner",
    lastName: "User",
    role
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });

  return { company, user, authorization: `Bearer ${accessToken}` };
}

function createInternalAdminContext() {
  const company = fakeDb.seedCompany({
    id: fakeDb.RENAVANI_INTERNAL_TEST_COMPANY_ID,
    name: "Renvani Internal",
    slug: "renvani-internal",
    timezone: "America/Chicago"
  });
  const user = fakeDb.seedUser({
    companyId: company.id,
    email: "internal@renvani.test",
    firstName: "Internal",
    lastName: "Admin",
    role: "admin"
  });
  const accessToken = tokens.generateAccessToken({
    userId: user.id,
    companyId: company.id,
    role: user.role
  });
  return { company, authorization: `Bearer ${accessToken}` };
}

describe("saved card migration (FS-138)", () => {
  it("starts migration, confirms Stripe import, maps payment methods, and exposes wizard status", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id, wizardStep: 3 });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "Pat",
      lastName: "Lee",
      email: "pat@example.com"
    });

    const start = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration`)
      .set("Authorization", authorization)
      .send({ priorProcessorName: "Legacy Processor" });

    expect(start.status).toBe(201);
    expect(start.body.status).toBe("awaiting_stripe_import");
    expect(start.body.stripePanImportInstructionsUrl).toContain("https://");

    const confirm = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/confirm-stripe-import`)
      .set("Authorization", authorization)
      .send({ stripeImportReference: "stripe_import_job_test_1" });

    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe("mapping");

    const apply = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/apply-mappings`)
      .set("Authorization", authorization)
      .send({
        ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
        rows: [
          {
            stripeCustomerId: "cus_test_1",
            stripePaymentMethodId: "pm_test_1",
            renvaniCustomerId: customer.id
          }
        ]
      });

    expect(apply.status).toBe(200);
    expect(apply.body.status).toBe("completed");
    expect(apply.body.mappingSummary.matched).toBe(1);
    expect(attachImportedPaymentMethodMock).toHaveBeenCalled();

    const status = await request(app.server)
      .get(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration`)
      .set("Authorization", authorization);

    expect(status.status).toBe(200);
    expect(status.body.migration.status).toBe("completed");

    const updatedBundle = fakeDb.getTestState().importBundles.find((row) => row.id === bundle.id);
    expect(updatedBundle?.stepState).toMatchObject({
      savedCardMigration: { status: "completed" }
    });
  });

  it("sends Resend fallback email for unmatched customers", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const customer = fakeDb.seedCustomer({
      companyId: company.id,
      firstName: "No",
      lastName: "Card",
      email: "nocard@example.com"
    });
    attachImportedPaymentMethodMock.mockRejectedValueOnce(new Error("raw stripe failure"));

    await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration`)
      .set("Authorization", authorization)
      .send({ priorProcessorName: "Legacy Processor" });

    await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/confirm-stripe-import`)
      .set("Authorization", authorization)
      .send({ stripeImportReference: "stripe_import_job_test_2" });

    await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/apply-mappings`)
      .set("Authorization", authorization)
      .send({
        ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
        rows: [
          {
            stripeCustomerId: "cus_orphan",
            stripePaymentMethodId: "pm_orphan",
            renvaniCustomerId: customer.id
          }
        ]
      });

    const fallback = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/send-fallback-email`)
      .set("Authorization", authorization)
      .send({ renvaniCustomerId: customer.id });

    expect(fallback.status).toBe(200);
    expect(sendRenderedTemplateEmailMock).toHaveBeenCalled();
    expect(fallback.body.fallbackEmailSentAt).toBeTruthy();
    const emailArgs = sendRenderedTemplateEmailMock.mock.calls[0]?.[2] as { paymentPortalUrl: string };
    expect(emailArgs.paymentPortalUrl).toMatch(/\/site\/card-migrate-/);
    expect(emailArgs.paymentPortalUrl).not.toMatch(/\/pay$/);

    const duplicate = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/send-fallback-email`)
      .set("Authorization", authorization)
      .send({ renvaniCustomerId: customer.id });
    expect(duplicate.status).toBe(409);
    expect(sendRenderedTemplateEmailMock).toHaveBeenCalledTimes(1);
  });

  it("lists migrations for internal admin", async () => {
    const tenant = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: tenant.company.id });
    fakeDb.seedSavedCardMigration({
      companyId: tenant.company.id,
      importBundleId: bundle.id,
      priorProcessorName: "Jobber",
      status: "mapping"
    });

    const internal = createInternalAdminContext();
    const response = await request(app.server)
      .get(`/api/v1/internal/admin/saved-card-migrations?companyId=${tenant.company.id}`)
      .set("Authorization", internal.authorization);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].priorProcessorName).toBe("Jobber");
  });

  it("rejects internal admin routes for tenant companies", async () => {
    const { authorization } = createAuthContext("admin");
    const response = await request(app.server)
      .get("/api/v1/internal/admin/saved-card-migrations")
      .set("Authorization", authorization);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe(ErrorCode.FORBIDDEN);
  });

  async function startAndConfirm(authorization: string, bundleId: string) {
    await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundleId}/saved-card-migration`)
      .set("Authorization", authorization)
      .send({ priorProcessorName: "Legacy Processor" });
    return request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundleId}/saved-card-migration/confirm-stripe-import`)
      .set("Authorization", authorization)
      .send({ stripeImportReference: "stripe_import_job_x" });
  }

  function applyMappings(authorization: string, bundleId: string, body: Record<string, unknown>) {
    return request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundleId}/saved-card-migration/apply-mappings`)
      .set("Authorization", authorization)
      .send(body);
  }

  it("rejects fallback email for a customer that is not unmatched or failed", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "B", email: "ok@example.com" });
    await startAndConfirm(authorization, bundle.id);
    await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
      rows: [{ stripeCustomerId: "cus_ok", stripePaymentMethodId: "pm_ok", renvaniCustomerId: customer.id }]
    });
    const response = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/send-fallback-email`)
      .set("Authorization", authorization)
      .send({ renvaniCustomerId: customer.id });
    expect(response.status).toBe(400);
    expect(sendRenderedTemplateEmailMock).not.toHaveBeenCalled();
  });

  it("rate limits send-fallback-email and apply-mappings per company", async () => {
    const rateLimit = await import("../../lib/public-booking-rate-limit.js");
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    for (let i = 0; i < rateLimit.SAVED_CARD_FALLBACK_EMAIL_RATE_LIMIT; i += 1) {
      await rateLimit.checkSavedCardFallbackEmailRateLimit(company.id);
    }
    for (let i = 0; i < rateLimit.SAVED_CARD_APPLY_MAPPINGS_RATE_LIMIT; i += 1) {
      await rateLimit.checkSavedCardApplyMappingsRateLimit(company.id);
    }
    const fallback = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/send-fallback-email`)
      .set("Authorization", authorization)
      .send({ renvaniCustomerId: "00000000-0000-4000-8000-000000000001" });
    expect(fallback.status).toBe(429);
    const apply = await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
      rows: [{ stripeCustomerId: "cus_1", stripePaymentMethodId: "pm_1" }]
    });
    expect(apply.status).toBe(429);
    rateLimit.resetPublicBookingRateLimitStateForTests();
  });

  it("caps apply-mappings at 200 rows and requires the owner consent acknowledgment", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    await startAndConfirm(authorization, bundle.id);
    const rows = Array.from({ length: 201 }, (_, i) => ({ stripeCustomerId: `cus_${i}`, stripePaymentMethodId: `pm_${i}` }));
    const tooMany = await applyMappings(authorization, bundle.id, { ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION, rows });
    expect(tooMany.status).toBe(400);
    const noAck = await applyMappings(authorization, bundle.id, { rows: rows.slice(0, 1) });
    expect(noAck.status).toBe(400);
    const falseAck = await applyMappings(authorization, bundle.id, { ownerOffSessionConsentAcknowledged: false, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION, rows: rows.slice(0, 1) });
    expect(falseAck.status).toBe(400);
    expect(attachImportedPaymentMethodMock).not.toHaveBeenCalled();
  });

  it("records the consent acknowledgment and skips already-applied rows on retry", async () => {
    const { company, user, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "I", lastName: "D", email: "idem@example.com" });
    await startAndConfirm(authorization, bundle.id);
    const body = {
      ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
      rows: [
        { stripeCustomerId: "cus_idem", stripePaymentMethodId: "pm_idem", renvaniCustomerId: customer.id },
        { stripeCustomerId: "cus_none", stripePaymentMethodId: "pm_none", email: "nobody@example.com" }
      ]
    };
    const first = await applyMappings(authorization, bundle.id, body);
    expect(first.status).toBe(200);
    expect(first.body.status).toBe("fallback_required");
    const second = await applyMappings(authorization, bundle.id, body);
    expect(second.status).toBe(200);
    expect(attachImportedPaymentMethodMock).toHaveBeenCalledTimes(1);
    expect(second.body.mappingSummary).toMatchObject({ matched: 1, unmatched: 1, total: 2 });
    const row = fakeDb.getTestState().savedCardMigrations.find((r) => r.companyId === company.id);
    expect(row?.offSessionConsentAcknowledgedAt).toBeInstanceOf(Date);
    expect(row?.offSessionConsentAcknowledgedById).toBe(user.id);
    expect(row?.offSessionConsentTextVersion).toBe(SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION);
    expect(typeof row?.offSessionConsentBatchId).toBe("string");
  });

  it("persists the consent record before attaching, even if attach crashes mid-loop", async () => {
    const { company, user, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const a = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "A", email: "a@example.com" });
    const b = fakeDb.seedCustomer({ companyId: company.id, firstName: "B", lastName: "B", email: "b@example.com" });
    await startAndConfirm(authorization, bundle.id);
    const state = fakeDb.getTestState();
    const seen: unknown[] = [];
    attachImportedPaymentMethodMock.mockImplementation(async () => {
      const row = state.savedCardMigrations.find((r) => r.companyId === company.id);
      seen.push({ ...row });
      if (seen.length === 2) {
        // Simulate a process crash (not a Stripe error) on the second attach.
        throw Object.assign(new Error("crash"), { simulateCrash: true });
      }
      return { paymentMethodLabel: "VISA ending in 4242" };
    });
    await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
      rows: [
        { stripeCustomerId: "cus_a", stripePaymentMethodId: "pm_a", renvaniCustomerId: a.id },
        { stripeCustomerId: "cus_b", stripePaymentMethodId: "pm_b", renvaniCustomerId: b.id }
      ]
    });
    expect(seen.length).toBe(2);
    for (const snapshot of seen as Array<Record<string, unknown>>) {
      expect(snapshot.offSessionConsentAcknowledgedAt).toBeInstanceOf(Date);
      expect(snapshot.offSessionConsentAcknowledgedById).toBe(user.id);
      expect(snapshot.offSessionConsentTextVersion).toBe(SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION);
      expect(typeof snapshot.offSessionConsentBatchId).toBe("string");
    }
  });

  it("persists each attached card's consent stamp to the DB before the next attach runs", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const a = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "A", email: "a@example.com" });
    const b = fakeDb.seedCustomer({ companyId: company.id, firstName: "B", lastName: "B", email: "b@example.com" });
    await startAndConfirm(authorization, bundle.id);
    const state = fakeDb.getTestState();
    let dbMappingsAtSecondAttach: Array<Record<string, unknown>> | null = null;
    let calls = 0;
    attachImportedPaymentMethodMock.mockImplementation(async () => {
      calls += 1;
      if (calls === 2) {
        const row = state.savedCardMigrations.find((r) => r.companyId === company.id);
        dbMappingsAtSecondAttach = structuredClone((row?.customerMappings ?? []) as Array<Record<string, unknown>>);
        throw new Error("crash");
      }
      return { paymentMethodLabel: "VISA ending in 4242" };
    });
    await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
      rows: [
        { stripeCustomerId: "cus_a", stripePaymentMethodId: "pm_a", renvaniCustomerId: a.id },
        { stripeCustomerId: "cus_b", stripePaymentMethodId: "pm_b", renvaniCustomerId: b.id }
      ]
    });
    expect(calls).toBe(2);
    const persistedA = dbMappingsAtSecondAttach!.find((m) => m.stripePaymentMethodId === "pm_a");
    expect(persistedA).toMatchObject({
      status: "attached",
      offSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION
    });
    expect(typeof persistedA!.offSessionConsentBatchId).toBe("string");
  });

  it("falls back to APP_URL in the fallback email when the company has no slug", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "N", lastName: "S", email: "noslug@example.com" });
    attachImportedPaymentMethodMock.mockRejectedValueOnce(new Error("raw stripe failure"));
    await startAndConfirm(authorization, bundle.id);
    await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
      rows: [{ stripeCustomerId: "cus_ns", stripePaymentMethodId: "pm_ns", renvaniCustomerId: customer.id }]
    });
    const companyRow = fakeDb.getTestState().companies.find((c) => c.id === company.id) as unknown as Record<string, unknown>;
    companyRow.slug = null;
    const res = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/send-fallback-email`)
      .set("Authorization", authorization)
      .send({ renvaniCustomerId: customer.id });
    expect(res.status).toBe(200);
    const emailArgs = sendRenderedTemplateEmailMock.mock.calls[0]?.[2] as { paymentPortalUrl: string };
    expect(emailArgs.paymentPortalUrl).not.toContain("/site/");
    expect(emailArgs.paymentPortalUrl).toBe(process.env.APP_URL?.replace(/\/$/, "") ?? emailArgs.paymentPortalUrl);
  });

  it("uses Legal's draft consent text with a version label", () => {
    expect(SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT).toMatch(/^By applying these mappings, you confirm/);
    expect(SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION).toBe("v1-draft");
  });

  it("rejects confirm-stripe-import once completed and emits stripe_import_confirmed", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const confirm = await startAndConfirm(authorization, bundle.id);
    expect(confirm.status).toBe(200);
    const events = fakeDb.getTestState().activityEvents.filter((e) => e.companyId === company.id);
    expect(events.map((e) => e.eventType)).toContain("payment_method_migration.stripe_import_confirmed");
    expect(events.map((e) => e.eventType)).not.toContain("payment_method_migration.mappings_applied");

    const migration = fakeDb.getTestState().savedCardMigrations.find((r) => r.companyId === company.id);
    if (migration) migration.status = "completed";
    const again = await request(app.server)
      .post(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration/confirm-stripe-import`)
      .set("Authorization", authorization)
      .send({ stripeImportReference: "stripe_import_job_y" });
    expect(again.status).toBe(409);
  });

  it("never overwrites an existing customers.stripe_customer_id", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "E", lastName: "X", email: "ex@example.com" });
    const stored = fakeDb.getTestState().customers.find((c) => c.id === customer.id) as unknown as Record<string, unknown>;
    stored.stripeCustomerId = "cus_existing";
    await startAndConfirm(authorization, bundle.id);
    const apply = await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
      rows: [{ stripeCustomerId: "cus_attacker", stripePaymentMethodId: "pm_x", renvaniCustomerId: customer.id }]
    });
    expect(apply.status).toBe(200);
    expect(apply.body.customerMappings[0]).toMatchObject({ status: "failed", errorMessage: "stripe_customer_conflict" });
    expect(stored.stripeCustomerId).toBe("cus_existing");
    expect(attachImportedPaymentMethodMock).not.toHaveBeenCalled();
  });

  it("maps raw Stripe errors to safe codes", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "S", lastName: "E", email: "se@example.com" });
    attachImportedPaymentMethodMock.mockRejectedValueOnce(
      Object.assign(new Error("No such payment_method: 'pm_secret_detail' for acct_123"), {
        type: "StripeInvalidRequestError",
        code: "resource_missing"
      })
    );
    await startAndConfirm(authorization, bundle.id);
    const apply = await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
      rows: [{ stripeCustomerId: "cus_se", stripePaymentMethodId: "pm_se", renvaniCustomerId: customer.id }]
    });
    expect(apply.body.customerMappings[0].errorMessage).toBe("stripe_resource_missing");
    expect(JSON.stringify(apply.body)).not.toContain("pm_secret_detail");
  });

  it("GET returns the consent text and version to show the owner", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const res = await request(app.server)
      .get(`/api/v1/migrate/onboarding/sessions/${bundle.id}/saved-card-migration`)
      .set("Authorization", authorization);
    expect(res.status).toBe(200);
    expect(res.body.migration).toBeNull();
    expect(res.body.consent).toEqual({
      text: SAVED_CARD_OFF_SESSION_CONSENT_ACK_TEXT,
      version: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION
    });
  });

  it("rejects apply-mappings with a missing or mismatched consent version", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "V", lastName: "R", email: "ver@example.com" });
    await startAndConfirm(authorization, bundle.id);
    const rows = [{ stripeCustomerId: "cus_ver", stripePaymentMethodId: "pm_ver", renvaniCustomerId: customer.id }];
    const missing = await applyMappings(authorization, bundle.id, { ownerOffSessionConsentAcknowledged: true, rows });
    expect(missing.status).toBe(400);
    const mismatch = await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true,
      ownerOffSessionConsentVersion: "v0-old",
      rows
    });
    expect(mismatch.status).toBe(400);
    expect(attachImportedPaymentMethodMock).not.toHaveBeenCalled();
    const ok = await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true,
      ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
      rows
    });
    expect(ok.status).toBe(200);
    expect(attachImportedPaymentMethodMock).toHaveBeenCalledTimes(1);
  });

  it("stamps consent per attached card so a second batch keeps the first batch's stamp", async () => {
    const { company, user, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const a = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "A", email: "a@example.com" });
    const b = fakeDb.seedCustomer({ companyId: company.id, firstName: "B", lastName: "B", email: "b@example.com" });
    await startAndConfirm(authorization, bundle.id);
    const ack = { ownerOffSessionConsentAcknowledged: true, ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION };
    const first = await applyMappings(authorization, bundle.id, {
      ...ack,
      rows: [
        { stripeCustomerId: "cus_a", stripePaymentMethodId: "pm_a", renvaniCustomerId: a.id },
        { stripeCustomerId: "cus_x", stripePaymentMethodId: "pm_x", email: "nobody@example.com" }
      ]
    });
    expect(first.status).toBe(200);
    const firstA = first.body.customerMappings.find((m: { stripePaymentMethodId: string }) => m.stripePaymentMethodId === "pm_a");
    expect(firstA.offSessionConsentVersion).toBe(SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION);
    expect(firstA.offSessionConsentAcknowledgedById).toBe(user.id);
    const firstBatchId = firstA.offSessionConsentBatchId as string;
    expect(typeof firstBatchId).toBe("string");

    const second = await applyMappings(authorization, bundle.id, {
      ...ack,
      rows: [{ stripeCustomerId: "cus_b", stripePaymentMethodId: "pm_b", renvaniCustomerId: b.id }]
    });
    expect(second.status).toBe(200);
    const byPm = new Map(
      second.body.customerMappings.map((m: { stripePaymentMethodId: string; offSessionConsentBatchId?: string }) => [m.stripePaymentMethodId, m])
    ) as Map<string, { offSessionConsentBatchId?: string }>;
    expect(byPm.get("pm_a")?.offSessionConsentBatchId).toBe(firstBatchId);
    const secondBatchId = byPm.get("pm_b")?.offSessionConsentBatchId;
    expect(typeof secondBatchId).toBe("string");
    expect(secondBatchId).not.toBe(firstBatchId);
    const row = fakeDb.getTestState().savedCardMigrations.find((r) => r.companyId === company.id);
    expect(row?.offSessionConsentBatchId).toBe(secondBatchId);
  });

  describe("confirm-stripe-import saves Stripe import rows as pending mappings (#224)", () => {
    const base = (bundleId: string) => `/api/v1/migrate/onboarding/sessions/${bundleId}/saved-card-migration`;

    async function realStartThenConfirm(authorization: string, bundleId: string, importedPaymentMethods: unknown[]) {
      const start = await request(app.server)
        .post(base(bundleId))
        .set("Authorization", authorization)
        .send({ priorProcessorName: "Legacy Processor" });
      expect(start.status).toBe(201);
      expect(start.body.customerMappings).toEqual([]);
      return request(app.server)
        .post(`${base(bundleId)}/confirm-stripe-import`)
        .set("Authorization", authorization)
        .send({ stripeImportReference: "stripe_import_job_pending", importedPaymentMethods });
    }

    it("start -> confirm yields pending rows that apply-mappings then attaches", async () => {
      const { company, authorization } = createAuthContext("owner");
      const bundle = fakeDb.seedImportBundle({ companyId: company.id });
      const byId = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "One", email: "a@example.com" });
      const byEmail = fakeDb.seedCustomer({ companyId: company.id, firstName: "B", lastName: "Two", email: "b@example.com" });

      const confirm = await realStartThenConfirm(authorization, bundle.id, [
        { stripeCustomerId: "cus_imp1", stripePaymentMethodId: "pm_imp1", renvaniCustomerId: byId.id },
        { stripeCustomerId: "cus_imp2", stripePaymentMethodId: "pm_imp2", email: "B@Example.com" },
        { stripeCustomerId: "cus_imp3", stripePaymentMethodId: "pm_imp3", email: "nobody@example.com" }
      ]);
      expect(confirm.status).toBe(200);
      expect(confirm.body.status).toBe("mapping");
      const pending = confirm.body.customerMappings.filter(
        (m: { status: string; matchMethod: string }) => m.status === "pending" && m.matchMethod !== "unmatched"
      );
      expect(pending).toHaveLength(2);
      expect(confirm.body.customerMappings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stripePaymentMethodId: "pm_imp1", renvaniCustomerId: byId.id, matchMethod: "renvani_customer_id", status: "pending" }),
          expect.objectContaining({ stripePaymentMethodId: "pm_imp2", renvaniCustomerId: byEmail.id, matchMethod: "email", status: "pending" }),
          expect.objectContaining({ stripePaymentMethodId: "pm_imp3", renvaniCustomerId: null, matchMethod: "unmatched", status: "pending" })
        ])
      );

      // GET (what the panel reads) exposes the same pending rows.
      const get = await request(app.server).get(base(bundle.id)).set("Authorization", authorization);
      expect(get.body.migration.customerMappings).toHaveLength(3);

      // Same row building as the web panel: pending + matched only.
      const rows = pending.map((m: { stripeCustomerId: string; stripePaymentMethodId: string; renvaniCustomerId: string | null; email: string | null }) => ({
        stripeCustomerId: m.stripeCustomerId,
        stripePaymentMethodId: m.stripePaymentMethodId,
        ...(m.renvaniCustomerId ? { renvaniCustomerId: m.renvaniCustomerId } : {}),
        ...(m.email ? { email: m.email } : {})
      }));
      const apply = await request(app.server)
        .post(`${base(bundle.id)}/apply-mappings`)
        .set("Authorization", authorization)
        .send({
          ownerOffSessionConsentAcknowledged: true,
          ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
          rows
        });
      expect(apply.status).toBe(200);
      expect(attachImportedPaymentMethodMock).toHaveBeenCalledTimes(2);
      expect(apply.body.mappingSummary).toEqual({ matched: 2, unmatched: 1, failed: 0, total: 3 });
      expect(apply.body.status).toBe("fallback_required");
      expect(apply.body.customerMappings.some((m: { status: string }) => m.status === "pending")).toBe(false);
    });

    it("is idempotent on replay: no duplicates and attached rows are not reset to pending", async () => {
      const { company, authorization } = createAuthContext("owner");
      const bundle = fakeDb.seedImportBundle({ companyId: company.id });
      const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "One", email: "a@example.com" });
      const rows = [
        { stripeCustomerId: "cus_rp1", stripePaymentMethodId: "pm_rp1", renvaniCustomerId: customer.id },
        { stripeCustomerId: "cus_rp1", stripePaymentMethodId: "pm_rp1", renvaniCustomerId: customer.id }
      ];
      const first = await realStartThenConfirm(authorization, bundle.id, rows);
      expect(first.status).toBe(200);
      expect(first.body.customerMappings).toHaveLength(1);

      const replay = await request(app.server)
        .post(`${base(bundle.id)}/confirm-stripe-import`)
        .set("Authorization", authorization)
        .send({ stripeImportReference: "stripe_import_job_pending", importedPaymentMethods: rows });
      expect(replay.status).toBe(200);
      expect(replay.body.customerMappings).toHaveLength(1);
      expect(replay.body.customerMappings[0].status).toBe("pending");

      // Apply one of two -> keep "mapping"; replay must not reset the attached row.
      const migration = fakeDb.getTestState().savedCardMigrations.find((r) => r.companyId === company.id);
      expect(migration).toBeDefined();
      const apply = await request(app.server)
        .post(`${base(bundle.id)}/apply-mappings`)
        .set("Authorization", authorization)
        .send({
          ownerOffSessionConsentAcknowledged: true,
          ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
          rows: [{ stripeCustomerId: "cus_rp1", stripePaymentMethodId: "pm_rp1", renvaniCustomerId: customer.id }]
        });
      expect(apply.body.status).toBe("completed");
      if (migration) migration.status = "mapping";
      const afterApply = await request(app.server)
        .post(`${base(bundle.id)}/confirm-stripe-import`)
        .set("Authorization", authorization)
        .send({ stripeImportReference: "stripe_import_job_pending", importedPaymentMethods: rows });
      expect(afterApply.body.customerMappings).toHaveLength(1);
      expect(afterApply.body.customerMappings[0].status).toBe("attached");
    });

    it("keeps the migration in mapping while matched imported rows are still pending", async () => {
      const { company, authorization } = createAuthContext("owner");
      const bundle = fakeDb.seedImportBundle({ companyId: company.id });
      const a = fakeDb.seedCustomer({ companyId: company.id, firstName: "A", lastName: "One", email: "a@example.com" });
      const b = fakeDb.seedCustomer({ companyId: company.id, firstName: "B", lastName: "Two", email: "b@example.com" });
      await realStartThenConfirm(authorization, bundle.id, [
        { stripeCustomerId: "cus_p1", stripePaymentMethodId: "pm_p1", renvaniCustomerId: a.id },
        { stripeCustomerId: "cus_p2", stripePaymentMethodId: "pm_p2", renvaniCustomerId: b.id }
      ]);
      const apply = await request(app.server)
        .post(`${base(bundle.id)}/apply-mappings`)
        .set("Authorization", authorization)
        .send({
          ownerOffSessionConsentAcknowledged: true,
          ownerOffSessionConsentVersion: SAVED_CARD_OFF_SESSION_CONSENT_ACK_VERSION,
          rows: [{ stripeCustomerId: "cus_p1", stripePaymentMethodId: "pm_p1", renvaniCustomerId: a.id }]
        });
      expect(apply.status).toBe(200);
      expect(apply.body.status).toBe("mapping");
    });

    it("never matches another company's customer and never shows its rows to another tenant", async () => {
      const tenantA = createAuthContext("owner");
      const tenantB = createAuthContext("owner");
      const bundleA = fakeDb.seedImportBundle({ companyId: tenantA.company.id });
      const bundleB = fakeDb.seedImportBundle({ companyId: tenantB.company.id });
      const foreign = fakeDb.seedCustomer({ companyId: tenantB.company.id, firstName: "F", lastName: "B", email: "shared@example.com" });

      const confirm = await realStartThenConfirm(tenantA.authorization, bundleA.id, [
        { stripeCustomerId: "cus_x1", stripePaymentMethodId: "pm_x1", renvaniCustomerId: foreign.id },
        { stripeCustomerId: "cus_x2", stripePaymentMethodId: "pm_x2", email: "shared@example.com" }
      ]);
      expect(confirm.status).toBe(200);
      for (const m of confirm.body.customerMappings) {
        expect(m.renvaniCustomerId).toBeNull();
        expect(m.matchMethod).toBe("unmatched");
      }

      // Tenant B cannot read or confirm against tenant A's bundle.
      const crossGet = await request(app.server).get(base(bundleA.id)).set("Authorization", tenantB.authorization);
      // Scoped by company: tenant B sees no migration (and none of A's rows) for A's bundle id.
      expect(crossGet.body.migration ?? null).toBeNull();
      expect(JSON.stringify(crossGet.body)).not.toContain("pm_x1");
      const crossConfirm = await request(app.server)
        .post(`${base(bundleA.id)}/confirm-stripe-import`)
        .set("Authorization", tenantB.authorization)
        .send({ stripeImportReference: "x", importedPaymentMethods: [{ stripeCustomerId: "cus_y", stripePaymentMethodId: "pm_y" }] });
      expect(crossConfirm.status).toBe(404);
      const ownB = await request(app.server).get(base(bundleB.id)).set("Authorization", tenantB.authorization);
      expect(ownB.body.migration ?? null).toBeNull();
      const rowA = fakeDb.getTestState().savedCardMigrations.find((r) => r.companyId === tenantA.company.id);
      expect((rowA?.customerMappings as unknown[]).length).toBe(2);
    });

    it("rejects malformed Stripe ids in import rows", async () => {
      const { company, authorization } = createAuthContext("owner");
      const bundle = fakeDb.seedImportBundle({ companyId: company.id });
      const confirm = await realStartThenConfirm(authorization, bundle.id, [
        { stripeCustomerId: "not-a-customer", stripePaymentMethodId: "pm_ok" }
      ]);
      expect(confirm.status).toBe(400);
    });
  });
});
