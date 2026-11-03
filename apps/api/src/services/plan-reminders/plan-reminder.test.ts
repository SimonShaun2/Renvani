import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { setupTestEnv } from "../../test-support/env-setup.js";

setupTestEnv();

const { addQueueJob } = vi.hoisted(() => ({ addQueueJob: vi.fn(async () => undefined) }));

vi.mock("drizzle-orm", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDrizzleModuleMock();
});
vi.mock("@fsm/db", async () => {
  const helper = await import("../../test-support/fake-db.js");
  return helper.createDbModuleMock();
});
vi.mock("@fsm/jobs", () => ({
  notificationsQueue: { add: addQueueJob },
  redisConnection: { get: vi.fn(), set: vi.fn(), del: vi.fn() }
}));

type FakeDbModule = typeof import("../../test-support/fake-db.js");
type ServiceModule = typeof import("./plan-reminder.service.js");
type PolicyModule = typeof import("./plan-reminder-policy.js");
type RegistryModule = typeof import("../automation/event-automation.registry.js");
type RateLimitModule = typeof import("../../lib/fixed-window-rate-limit.js");

let fakeDb: FakeDbModule;
let service: ServiceModule;
let policy: PolicyModule;
let registry: RegistryModule;
let rateLimit: RateLimitModule;

const NOW = new Date("2026-10-28T15:00:00.000Z"); // 10am Chicago

beforeAll(async () => {
  fakeDb = await import("../../test-support/fake-db.js");
  service = await import("./plan-reminder.service.js");
  policy = await import("./plan-reminder-policy.js");
  registry = await import("../automation/event-automation.registry.js");
  rateLimit = await import("../../lib/fixed-window-rate-limit.js");
});

beforeEach(() => {
  fakeDb.resetTestState();
  service.resetPlanReminderStateForTests();
  rateLimit.resetFixedWindowRateLimitStateForTests();
  addQueueJob.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function seed(options: { rule?: { isEnabled?: boolean; thresholdDays?: number | null; config?: Record<string, unknown> } | null; customer?: Record<string, unknown> } = {}) {
  const company = fakeDb.seedCompany({ name: "Acme HVAC", slug: `acme-${Math.random().toString(36).slice(2, 8)}`, timezone: "America/Chicago" });
  if (options.rule !== null) {
    fakeDb.seedAutomationRule({
      companyId: company.id,
      ruleType: "service_agreement_renewal",
      isEnabled: options.rule?.isEnabled ?? true,
      thresholdDays: options.rule?.thresholdDays ?? 30,
      config: options.rule?.config ?? {}
    } as never);
  }
  const customer = fakeDb.seedCustomer({
    companyId: company.id,
    firstName: "Chris",
    lastName: "Pine",
    email: "chris@example.com",
    phone: "555-0100",
    prefersEmail: true,
    prefersSms: true,
    doNotContact: false,
    ...options.customer
  } as never);
  return { company, customer };
}

function plan(companyId: string, customerId: string, values: Record<string, unknown>) {
  return fakeDb.seedMaintenancePlan({ companyId, customerId, name: "Gold Plan", frequency: "bi_annual", status: "active", ...values } as never);
}

function reminderCalls() {
  return addQueueJob.mock.calls.filter((call) => (call as unknown[])[0] === "send-plan-reminder") as unknown as Array<
    [string, Record<string, unknown>, { jobId: string }]
  >;
}

describe("plan reminder window selection (pure)", () => {
  const settings = () => policy.readPlanReminderSettings({ thresholdDays: 30, config: {} });
  const base = { id: "p1", status: "active", endDate: null, nextServiceDate: null };

  it("defaults: renewal 30d, tune-up on, 14d", () => {
    expect(policy.readPlanReminderSettings(null)).toMatchObject({ renewalWindowDays: 30, tuneUpReminders: true, tuneUpWindowDays: 14 });
  });

  it("selects renewals inside [today, today+window] only", () => {
    expect(policy.selectDueReminders({ ...base, endDate: "2026-11-27" }, "2026-10-28", settings())).toEqual([
      { planId: "p1", kind: "renewal", dueDate: "2026-11-27" }
    ]);
    expect(policy.selectDueReminders({ ...base, endDate: "2026-11-28" }, "2026-10-28", settings())).toEqual([]);
    expect(policy.selectDueReminders({ ...base, endDate: "2026-10-27" }, "2026-10-28", settings())).toEqual([]);
    expect(policy.selectDueReminders({ ...base, endDate: "2026-11-01", status: "cancelled" }, "2026-10-28", settings())).toEqual([]);
    expect(policy.selectDueReminders({ ...base, endDate: "2026-11-01", stripeCancelAtPeriodEnd: true }, "2026-10-28", settings())).toEqual([]);
  });

  it("falls back to the Stripe period end when there is no end date", () => {
    expect(
      policy.selectDueReminders({ ...base, stripeCurrentPeriodEnd: new Date("2026-11-10T00:00:00Z") }, "2026-10-28", settings())
    ).toEqual([{ planId: "p1", kind: "renewal", dueDate: "2026-11-10" }]);
  });

  it("selects tune-ups inside the tune-up window, unless turned off or after the plan ends", () => {
    expect(policy.selectDueReminders({ ...base, nextServiceDate: "2026-11-05" }, "2026-10-28", settings())).toEqual([
      { planId: "p1", kind: "tune_up", dueDate: "2026-11-05" }
    ]);
    expect(policy.selectDueReminders({ ...base, nextServiceDate: "2026-11-20" }, "2026-10-28", settings())).toEqual([]);
    const off = policy.readPlanReminderSettings({ thresholdDays: 30, config: { tuneUpReminders: false } });
    expect(policy.selectDueReminders({ ...base, nextServiceDate: "2026-11-05" }, "2026-10-28", off)).toEqual([]);
    expect(
      policy.selectDueReminders({ ...base, endDate: "2026-11-01", nextServiceDate: "2026-11-05" }, "2026-10-28", settings()).map((r) => r.kind)
    ).toEqual(["renewal"]);
  });

  it("uses a fixed job id per plan per window", () => {
    expect(policy.planReminderJobId({ planId: "p1", kind: "renewal", dueDate: "2026-11-27" })).toBe("plan-reminder-renewal-p1-2026-11-27");
  });
});

describe("renewal.due automation", () => {
  it("is registered in the event-to-automation registry", () => {
    expect(registry.listEventAutomations("renewal.due").map((entry) => entry.id)).toContain(
      registry.RENEWAL_DUE_PLAN_REMINDER_AUTOMATION_ID
    );
  });

  it("scan queues one renewal and one tune-up email; replays are no-ops", async () => {
    const { company, customer } = seed({ rule: { config: { customerCooldownDays: 1 } } });
    const renewal = plan(company.id, customer.id, { endDate: "2026-11-20" });
    const other = seed();
    const tuneUp = plan(other.company.id, other.customer.id, { nextServiceDate: "2026-11-02" });

    await service.scanAllPlanReminders(NOW);
    const calls = reminderCalls();
    expect(calls.map((c) => c[2].jobId).sort()).toEqual(
      [`plan-reminder-renewal-${renewal.id}-2026-11-20`, `plan-reminder-tune_up-${tuneUp.id}-2026-11-02`].sort()
    );
    const renewalJob = calls.find((c) => c[1].reminderKind === "renewal")!;
    expect(renewalJob[1]).toMatchObject({ channel: "email", customerEmail: "chris@example.com", customerPhone: null, dueDateLabel: "November 20, 2026" });

    await service.scanAllPlanReminders(NOW);
    await registry.dispatchEventAutomation({
      eventType: "renewal.due",
      companyId: company.id,
      maintenancePlanId: renewal.id,
      reminderKind: "renewal",
      dueDate: "2026-11-20"
    });
    expect(reminderCalls()).toHaveLength(2);
  });

  it("does nothing while the rule is missing or off (default OFF)", async () => {
    const missing = seed({ rule: null });
    plan(missing.company.id, missing.customer.id, { endDate: "2026-11-20" });
    const off = seed({ rule: { isEnabled: false } });
    const offPlan = plan(off.company.id, off.customer.id, { endDate: "2026-11-20" });
    await service.scanAllPlanReminders(NOW);
    await expect(
      service.requestPlanReminder({ companyId: off.company.id, maintenancePlanId: offPlan.id, reminderKind: "renewal", dueDate: "2026-11-20" }, NOW)
    ).resolves.toEqual({ status: "skipped", reason: "rule_disabled" });
    expect(reminderCalls()).toHaveLength(0);
  });

  it.each([
    ["do not contact", { doNotContact: true }, "do_not_contact"],
    ["email opt-out (SMS stub disabled)", { prefersEmail: false }, "no_consented_channel"],
    ["NULL prefersEmail is not consent", { prefersEmail: null }, "no_consented_channel"],
    ["SMS-only customer while SMS stub is disabled", { email: null }, "no_consented_channel"]
  ] as const)("respects consent: %s", async (_label, customer, reason) => {
    const s = seed({ customer });
    Object.assign(fakeDb.getTestState().customers.find((row) => row.id === s.customer.id)!, customer);
    const p = plan(s.company.id, s.customer.id, { endDate: "2026-11-20" });
    await expect(
      service.requestPlanReminder({ companyId: s.company.id, maintenancePlanId: p.id, reminderKind: "renewal", dueDate: "2026-11-20" }, NOW)
    ).resolves.toEqual({ status: "skipped", reason });
    expect(reminderCalls()).toHaveLength(0);
  });

  it("skips stale events whose date no longer matches the plan", async () => {
    const s = seed();
    const p = plan(s.company.id, s.customer.id, { endDate: "2026-11-20" });
    await expect(
      service.requestPlanReminder({ companyId: s.company.id, maintenancePlanId: p.id, reminderKind: "renewal", dueDate: "2026-11-19" }, NOW)
    ).resolves.toEqual({ status: "skipped", reason: "plan_not_eligible" });
  });

  it("rate limits per customer (cooldown) and per company (daily cap); folded reminders retry later", async () => {
    const s = seed({ rule: { config: { companyDailyLimit: 3 } } });
    const a = plan(s.company.id, s.customer.id, { endDate: "2026-11-20" });
    const b = plan(s.company.id, s.customer.id, { endDate: "2026-11-21" });
    const ev = (id: string, dueDate: string) => ({ companyId: s.company.id, maintenancePlanId: id, reminderKind: "renewal" as const, dueDate });
    expect((await service.requestPlanReminder(ev(a.id, "2026-11-20"), NOW)).status).toBe("queued");
    await expect(service.requestPlanReminder(ev(b.id, "2026-11-21"), NOW)).resolves.toEqual({ status: "skipped", reason: "customer_rate_limited" });

    const c2 = fakeDb.seedCustomer({ companyId: s.company.id, firstName: "A", lastName: "B", email: "a@example.com", prefersEmail: true } as never);
    const c3 = fakeDb.seedCustomer({ companyId: s.company.id, firstName: "C", lastName: "D", email: "c@example.com", prefersEmail: true } as never);
    const p2 = plan(s.company.id, c2.id, { endDate: "2026-11-20" });
    const p3 = plan(s.company.id, c3.id, { endDate: "2026-11-20" });
    expect((await service.requestPlanReminder(ev(p2.id, "2026-11-20"), NOW)).status).toBe("queued");
    await expect(service.requestPlanReminder(ev(p3.id, "2026-11-20"), NOW)).resolves.toEqual({ status: "skipped", reason: "company_rate_limited" });

    // Next day: the folded reminder for p3 is not marked sent, so it goes out.
    rateLimit.resetFixedWindowRateLimitStateForTests();
    expect((await service.requestPlanReminder(ev(p3.id, "2026-11-20"), new Date("2026-10-29T15:00:00Z"))).status).toBe("queued");
    expect(reminderCalls()).toHaveLength(3);
  });

  it("checks the company cap first, so a cap-held reminder does not consume the customer cooldown", async () => {
    const s = seed({ rule: { config: { companyDailyLimit: 1 } } });
    const other = fakeDb.seedCustomer({ companyId: s.company.id, firstName: "A", lastName: "B", email: "a@example.com", prefersEmail: true } as never);
    const first = plan(s.company.id, other.id, { endDate: "2026-11-20" });
    const held = plan(s.company.id, s.customer.id, { endDate: "2026-11-20" });
    const ev = (id: string) => ({ companyId: s.company.id, maintenancePlanId: id, reminderKind: "renewal" as const, dueDate: "2026-11-20" });
    expect((await service.requestPlanReminder(ev(first.id), NOW)).status).toBe("queued");
    await expect(service.requestPlanReminder(ev(held.id), NOW)).resolves.toEqual({ status: "skipped", reason: "company_rate_limited" });

    const nextDay = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    vi.setSystemTime(nextDay);
    expect((await service.requestPlanReminder(ev(held.id), nextDay)).status).toBe("queued");
  });

  it("releases the send-once claim when queuing fails, so the reminder is retried", async () => {
    const s = seed();
    const p = plan(s.company.id, s.customer.id, { endDate: "2026-11-20" });
    const ev = { companyId: s.company.id, maintenancePlanId: p.id, reminderKind: "renewal" as const, dueDate: "2026-11-20" };
    addQueueJob.mockRejectedValueOnce(new Error("redis down"));
    await expect(service.requestPlanReminder(ev, NOW)).resolves.toEqual({ status: "skipped", reason: "error" });
    rateLimit.resetFixedWindowRateLimitStateForTests();
    expect((await service.requestPlanReminder(ev, NOW)).status).toBe("queued");
    expect(reminderCalls()).toHaveLength(2);
  });
});
