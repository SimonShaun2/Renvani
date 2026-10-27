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
        ownerOffSessionConsentAcknowledged: true,
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
        ownerOffSessionConsentAcknowledged: true,
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
      ownerOffSessionConsentAcknowledged: true,
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
      ownerOffSessionConsentAcknowledged: true,
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
    const tooMany = await applyMappings(authorization, bundle.id, { ownerOffSessionConsentAcknowledged: true, rows });
    expect(tooMany.status).toBe(400);
    const noAck = await applyMappings(authorization, bundle.id, { rows: rows.slice(0, 1) });
    expect(noAck.status).toBe(400);
    const falseAck = await applyMappings(authorization, bundle.id, { ownerOffSessionConsentAcknowledged: false, rows: rows.slice(0, 1) });
    expect(falseAck.status).toBe(400);
    expect(attachImportedPaymentMethodMock).not.toHaveBeenCalled();
  });

  it("records the consent acknowledgment and skips already-applied rows on retry", async () => {
    const { company, user, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "I", lastName: "D", email: "idem@example.com" });
    await startAndConfirm(authorization, bundle.id);
    const body = {
      ownerOffSessionConsentAcknowledged: true,
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
      ownerOffSessionConsentAcknowledged: true,
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

  it("falls back to APP_URL in the fallback email when the company has no slug", async () => {
    const { company, authorization } = createAuthContext("owner");
    const bundle = fakeDb.seedImportBundle({ companyId: company.id });
    const customer = fakeDb.seedCustomer({ companyId: company.id, firstName: "N", lastName: "S", email: "noslug@example.com" });
    attachImportedPaymentMethodMock.mockRejectedValueOnce(new Error("raw stripe failure"));
    await startAndConfirm(authorization, bundle.id);
    await applyMappings(authorization, bundle.id, {
      ownerOffSessionConsentAcknowledged: true,
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
      ownerOffSessionConsentAcknowledged: true,
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
      ownerOffSessionConsentAcknowledged: true,
      rows: [{ stripeCustomerId: "cus_se", stripePaymentMethodId: "pm_se", renvaniCustomerId: customer.id }]
    });
    expect(apply.body.customerMappings[0].errorMessage).toBe("stripe_resource_missing");
    expect(JSON.stringify(apply.body)).not.toContain("pm_secret_detail");
  });
});
