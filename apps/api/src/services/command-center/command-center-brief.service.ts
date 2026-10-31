import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { Decimal } from "decimal.js";
import {
  agentActions,
  bookingRequests,
  callRecords,
  crews,
  invoices,
  jobs,
  maintenancePlans,
  runTransactionWithTenantSession
} from "@fsm/db";
import {
  COMMAND_CENTER_KPI_REGISTRY,
  type CommandCenterBrief,
  type CommandCenterCrewToday,
  type CommandCenterKpi,
  type CommandCenterKpiKey,
  type CommandCenterLoopStage,
  type CommandCenterMissingData,
  type CommandCenterNeedsYouItem,
  type CommandCenterSource
} from "@fsm/types";
import { resolveReportingPeriod } from "../../lib/reporting-period.js";
import { todayLocalDate } from "../recurring-visit-occurrence.schedule.js";
import { hashCallerNumber } from "../growth/call-tracking-caller-hash.js";
import { capSources, commandCenterSource, normalizeBookingPhoneE164 } from "./command-center-sources.js";

/**
 * FS-29 Owner Command Center brief. Read-only composition of tenant records inside one RLS tenant-session
 * transaction (every query also filters by company_id). Deterministic: no LLM, no provider calls, no writes,
 * no audit event (view is not an audited action, per E.. CoS decision 4).
 */

export const BOOKED_JOB_STATUSES = [
  "estimate_approved",
  "scheduled",
  "dispatched",
  "in_progress",
  "on_hold",
  "completed",
  "invoiced",
  "paid",
  "closed"
] as const;
const BOOKED = new Set<string>(BOOKED_JOB_STATUSES);
const COMPLETED = new Set<string>(["completed", "invoiced", "paid", "closed"]);
const CALL_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const NEEDS_YOU_LIMIT = 20;

export interface CommandCenterBriefInput {
  companyId: string;
  companyTimeZone: string;
  date?: string | undefined;
  timeZone?: string | undefined;
  now?: Date | undefined;
}

interface MonthWindow {
  startDate: string;
  endDate: string;
  start: Date;
  end: Date;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function monthWindow(date: string, timeZone: string, offsetMonths = 0): MonthWindow {
  const [y, m] = date.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(y, m - 1 + offsetMonths, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const startDate = `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-01`;
  const endDate = `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`;
  const resolved = resolveReportingPeriod(startDate, endDate, timeZone);
  return { startDate, endDate, start: resolved.start, end: resolved.end };
}

function within(at: Date | null | undefined, w: { start: Date; end: Date }): boolean {
  return !!at && at.getTime() >= w.start.getTime() && at.getTime() <= w.end.getTime();
}

function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  return new Decimal(value).mul(100).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

function centsToMoney(cents: number): string {
  return new Decimal(cents).div(100).toFixed(2);
}

function percent(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return new Decimal(numerator).mul(100).div(denominator).toDecimalPlaces(2).toNumber();
}

function hasCampaign(attribution: unknown): boolean {
  if (!attribution || typeof attribution !== "object") return false;
  const value = (attribution as Record<string, unknown>).utm_campaign ?? (attribution as Record<string, unknown>).utmCampaign;
  return typeof value === "string" && value.trim().length > 0;
}

function humanizeActionType(actionType: string): string {
  const words = actionType.replace(/[._-]+/gu, " ").trim();
  return words.length > 0 ? words.charAt(0).toUpperCase() + words.slice(1) : "Agent action";
}

type BookingRow = {
  id: string;
  referenceNumber: string | null;
  phone: string | null;
  jobId: string | null;
  createdAt: Date;
};
type CallRow = { id: string; callerHash: string | null; startedAt: Date };
type JobRow = {
  id: string;
  jobNumber: string | null;
  customerId: string | null;
  status: string;
  crewId: string | null;
  scheduledStart: Date | null;
  actualEnd: Date | null;
  maintenancePlanId: string | null;
  leadAttribution: unknown;
  createdAt: Date;
};

export async function getCommandCenterBrief(input: CommandCenterBriefInput): Promise<CommandCenterBrief> {
  const now = input.now ?? new Date();
  const timeZone = input.timeZone ?? input.companyTimeZone;
  const today = todayLocalDate(timeZone, now);
  const date = input.date ?? today;
  const current = monthWindow(date, timeZone, 0);
  const previous = monthWindow(date, timeZone, -1);
  const todayWindow = resolveReportingPeriod(today, today, timeZone);
  const companyId = input.companyId;

  const data = await runTransactionWithTenantSession(companyId, async (tx) => {
    const bookings = (await tx
      .select({
        id: bookingRequests.id,
        referenceNumber: bookingRequests.referenceNumber,
        phone: bookingRequests.phone,
        jobId: bookingRequests.jobId,
        createdAt: bookingRequests.createdAt
      })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.companyId, companyId),
          gte(bookingRequests.createdAt, new Date(previous.start.getTime() - CALL_DEDUPE_WINDOW_MS)),
          lte(bookingRequests.createdAt, new Date(current.end.getTime() + CALL_DEDUPE_WINDOW_MS))
        )
      )) as BookingRow[];

    const calls = (await tx
      .select({ id: callRecords.id, callerHash: callRecords.callerHash, startedAt: callRecords.startedAt })
      .from(callRecords)
      .where(and(eq(callRecords.companyId, companyId), gte(callRecords.startedAt, previous.start), lte(callRecords.startedAt, current.end)))) as CallRow[];

    // v1: the tenant's job list is read once and aggregated in memory (first-booked-job and rebooking need history).
    const jobRows = (await tx
      .select({
        id: jobs.id,
        jobNumber: jobs.jobNumber,
        customerId: jobs.customerId,
        status: jobs.status,
        crewId: jobs.crewId,
        scheduledStart: jobs.scheduledStart,
        actualEnd: jobs.actualEnd,
        maintenancePlanId: jobs.maintenancePlanId,
        leadAttribution: jobs.leadAttribution,
        createdAt: jobs.createdAt
      })
      .from(jobs)
      .where(eq(jobs.companyId, companyId))) as JobRow[];

    const paidInvoices = await tx
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        jobId: invoices.jobId,
        amountPaid: invoices.amountPaid,
        paidAt: invoices.paidAt
      })
      .from(invoices)
      .where(and(eq(invoices.companyId, companyId), eq(invoices.status, "paid"), gte(invoices.paidAt, previous.start), lte(invoices.paidAt, current.end)));

    const activePlans = await tx
      .select({ id: maintenancePlans.id, customerId: maintenancePlans.customerId })
      .from(maintenancePlans)
      .where(and(eq(maintenancePlans.companyId, companyId), eq(maintenancePlans.status, "active")));

    const actions = await tx
      .select({
        id: agentActions.id,
        agentProduct: agentActions.agentProduct,
        actionType: agentActions.actionType,
        target: agentActions.target,
        state: agentActions.state,
        executionReceipt: agentActions.executionReceipt,
        createdAt: agentActions.createdAt,
        updatedAt: agentActions.updatedAt
      })
      .from(agentActions)
      .where(and(eq(agentActions.companyId, companyId), inArray(agentActions.state, ["awaiting_approval", "failed", "escalated", "succeeded"])));

    const crewRows = await tx
      .select({ id: crews.id, name: crews.name })
      .from(crews)
      .where(and(eq(crews.companyId, companyId), eq(crews.isActive, true)));

    return { bookings, calls, jobRows, paidInvoices, activePlans, actions, crewRows };
  });

  const jobsById = new Map(data.jobRows.map((job) => [job.id, job]));
  const jobSource = (job: JobRow, at: Date | null): CommandCenterSource => commandCenterSource("job", job.id, at, job.jobNumber);

  // --- direct inquiries (bookings + deduped tracked calls) ---
  const bookingHashes = data.bookings
    .map((booking) => {
      const e164 = normalizeBookingPhoneE164(booking.phone);
      return e164 ? { hash: hashCallerNumber(companyId, e164), at: booking.createdAt.getTime() } : null;
    })
    .filter((v): v is { hash: string; at: number } => v !== null);

  function inquiries(w: MonthWindow) {
    const bookingsIn = data.bookings.filter((b) => within(b.createdAt, w));
    const callsIn = data.calls.filter(
      (call) =>
        within(call.startedAt, w) &&
        !(call.callerHash && bookingHashes.some((b) => b.hash === call.callerHash && Math.abs(b.at - call.startedAt.getTime()) <= CALL_DEDUPE_WINDOW_MS))
    );
    const sources = [
      ...bookingsIn.map((b) => commandCenterSource("booking_request", b.id, b.createdAt, b.referenceNumber)),
      ...callsIn.map((c) => commandCenterSource("call_record", c.id, c.startedAt))
    ];
    return { count: bookingsIn.length + callsIn.length, bookingsIn, callsIn, sources };
  }

  function inquiryToBooked(w: MonthWindow) {
    const bookingsIn = data.bookings.filter((b) => within(b.createdAt, w));
    const converted = bookingsIn.filter((b) => {
      const job = b.jobId ? jobsById.get(b.jobId) : undefined;
      return !!job && BOOKED.has(job.status);
    });
    const sources = converted.flatMap((b) => {
      const job = jobsById.get(b.jobId!)!;
      return [commandCenterSource("booking_request", b.id, b.createdAt, b.referenceNumber), jobSource(job, job.createdAt)];
    });
    return { numerator: converted.length, denominator: bookingsIn.length, sources };
  }

  const bookedByCustomer = new Map<string, JobRow[]>();
  for (const job of data.jobRows) {
    if (!job.customerId || !BOOKED.has(job.status)) continue;
    const list = bookedByCustomer.get(job.customerId) ?? [];
    list.push(job);
    bookedByCustomer.set(job.customerId, list);
  }
  for (const list of bookedByCustomer.values()) list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const plansByCustomer = new Map<string, string>();
  for (const plan of data.activePlans) if (plan.customerId && !plansByCustomer.has(plan.customerId)) plansByCustomer.set(plan.customerId, plan.id);

  function firstToRecurring(w: MonthWindow) {
    let denominator = 0;
    let numerator = 0;
    const sources: CommandCenterSource[] = [];
    for (const [customerId, list] of bookedByCustomer) {
      const first = list[0]!;
      if (!within(first.createdAt, w)) continue;
      denominator += 1;
      const planId = plansByCustomer.get(customerId);
      const later = list[1];
      if (planId || later) {
        numerator += 1;
        sources.push(commandCenterSource("customer", customerId, first.createdAt));
        if (planId) sources.push(commandCenterSource("maintenance_plan", planId, null));
        if (later) sources.push(jobSource(later, later.createdAt));
      }
    }
    return { numerator, denominator, sources };
  }

  function isRebooking(job: JobRow): boolean {
    if (job.maintenancePlanId) return true;
    if (!job.customerId) return false;
    const list = bookedByCustomer.get(job.customerId) ?? [];
    return list.length > 0 && list[0]!.id !== job.id && list[0]!.createdAt.getTime() <= job.createdAt.getTime();
  }

  function marketingRevenue(w: MonthWindow) {
    let cents = 0;
    let rebookings = 0;
    let campaigns = 0;
    const sources: CommandCenterSource[] = [];
    for (const invoice of data.paidInvoices) {
      if (!within(invoice.paidAt, w) || !invoice.jobId) continue;
      const job = jobsById.get(invoice.jobId);
      if (!job) continue;
      const rebook = isRebooking(job);
      const campaign = hasCampaign(job.leadAttribution);
      if (!rebook && !campaign) continue;
      cents += toCents(invoice.amountPaid);
      if (rebook) rebookings += 1;
      else campaigns += 1;
      sources.push(commandCenterSource("invoice", invoice.id, invoice.paidAt, invoice.invoiceNumber), jobSource(job, job.createdAt));
    }
    return { cents, rebookings, campaigns, sources };
  }

  const kpiDef = (key: CommandCenterKpiKey) => COMMAND_CENTER_KPI_REGISTRY.find((d) => d.key === key)!;
  const kpi = (
    key: CommandCenterKpiKey,
    value: CommandCenterKpi["value"],
    previousValue: CommandCenterKpi["previousValue"],
    numerator: number | null,
    denominator: number | null,
    detail: string | null,
    sources: CommandCenterSource[]
  ): CommandCenterKpi => {
    const def = kpiDef(key);
    const capped = capSources(sources);
    return {
      key,
      label: def.label,
      unit: def.unit,
      value,
      numerator,
      denominator,
      previousValue,
      detail,
      sourceLabel: def.sourceLabel,
      definition: def.definition,
      sources: capped.sources,
      sourcesTruncated: capped.truncated
    };
  };

  const inqNow = inquiries(current);
  const inqPrev = inquiries(previous);
  const convNow = inquiryToBooked(current);
  const convPrev = inquiryToBooked(previous);
  const recNow = firstToRecurring(current);
  const recPrev = firstToRecurring(previous);
  const revNow = marketingRevenue(current);
  const revPrev = marketingRevenue(previous);

  const kpis: CommandCenterKpi[] = [
    kpi("direct_inquiries", inqNow.count, inqPrev.count, inqNow.count, null, `${inqNow.bookingsIn.length} booking requests · ${inqNow.callsIn.length} tracked calls`, inqNow.sources),
    kpi("inquiry_to_booked", percent(convNow.numerator, convNow.denominator), percent(convPrev.numerator, convPrev.denominator), convNow.numerator, convNow.denominator, null, convNow.sources),
    kpi("first_to_recurring", percent(recNow.numerator, recNow.denominator), percent(recPrev.numerator, recPrev.denominator), recNow.numerator, recNow.denominator, null, recNow.sources),
    kpi("marketing_revenue", centsToMoney(revNow.cents), centsToMoney(revPrev.cents), null, null, `${revNow.rebookings} rebookings · ${revNow.campaigns} campaigns`, revNow.sources)
  ];

  // --- loop (current period) ---
  const completedJobs = data.jobRows.filter((job) => COMPLETED.has(job.status) && within(job.actualEnd, current));
  const rebookedJobs = data.jobRows.filter((job) => BOOKED.has(job.status) && within(job.createdAt, current) && isRebooking(job));
  const bookedFromInquiries = convNow.sources.filter((s) => s.kind === "job");
  const stage = (s: CommandCenterLoopStage["stage"], label: string, count: number, sources: CommandCenterSource[]): CommandCenterLoopStage => {
    const capped = capSources(sources);
    return { stage: s, label, count, sources: capped.sources, sourcesTruncated: capped.truncated };
  };
  const loop: CommandCenterLoopStage[] = [
    stage("discover", "Discover", inqNow.count, inqNow.sources),
    stage("book", "Book", bookedFromInquiries.length, bookedFromInquiries),
    stage("complete", "Complete", completedJobs.length, completedJobs.map((job) => jobSource(job, job.actualEnd))),
    stage("rebook", "Rebook", rebookedJobs.length, rebookedJobs.map((job) => jobSource(job, job.createdAt)))
  ];

  // --- needs you ---
  const needsYouAll: CommandCenterNeedsYouItem[] = [];
  for (const action of data.actions) {
    const receipt = (action.executionReceipt ?? null) as { deliveryState?: string } | null;
    let state: CommandCenterNeedsYouItem["state"] | null = null;
    if (action.state === "awaiting_approval") state = "awaiting_approval";
    else if (action.state === "failed") state = "execution_failed";
    else if (action.state === "escalated") state = "escalated";
    else if (action.state === "succeeded" && receipt?.deliveryState === "failed") state = "delivery_failed";
    if (!state) continue;
    const target = (action.target ?? null) as { entityType?: string; entityId?: string } | null;
    const sources: CommandCenterSource[] = [commandCenterSource("agent_action", action.id, action.updatedAt)];
    if (target?.entityId) {
      const targetKind =
        target.entityType === "job" ? "job"
        : target.entityType === "invoice" ? "invoice"
        : target.entityType === "customer" ? "customer"
        : target.entityType === "booking_request" ? "booking_request"
        : target.entityType === "maintenance_plan" ? "maintenance_plan"
        : null;
      if (targetKind === "job") {
        const job = jobsById.get(target.entityId);
        sources.push(commandCenterSource("job", target.entityId, null, job?.jobNumber));
      } else if (targetKind) sources.push(commandCenterSource(targetKind, target.entityId, null));
    }
    const verb =
      state === "awaiting_approval" ? "awaiting approval"
      : state === "execution_failed" ? "failed"
      : state === "escalated" ? "escalated"
      : "delivery failed";
    needsYouAll.push({
      kind: state === "awaiting_approval" ? "suggestion" : "fact",
      state,
      agentProduct: action.agentProduct,
      actionId: action.id,
      actionType: action.actionType,
      version: action.updatedAt.getTime(),
      title: `${humanizeActionType(action.actionType)} · ${verb}`,
      primaryAction: state === "awaiting_approval" ? "approve" : state === "escalated" ? "review" : "open",
      occurredAt: action.updatedAt.toISOString(),
      sources
    });
  }
  needsYouAll.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || a.actionId.localeCompare(b.actionId));
  const approvals = needsYouAll.filter((item) => item.state === "awaiting_approval").length;
  const exceptions = needsYouAll.length - approvals;

  // --- crews + today ---
  const jobsToday = data.jobRows.filter((job) => job.status !== "cancelled" && within(job.scheduledStart, todayWindow));
  const crewsToday: CommandCenterCrewToday[] = data.crewRows
    .map((crew) => {
      const crewJobs = jobsToday.filter((job) => job.crewId === crew.id);
      const upcoming = crewJobs
        .filter((job) => !COMPLETED.has(job.status) && job.scheduledStart && job.scheduledStart.getTime() >= now.getTime())
        .sort((a, b) => a.scheduledStart!.getTime() - b.scheduledStart!.getTime());
      const status: CommandCenterCrewToday["status"] =
        crewJobs.length === 0 ? "off"
        : crewJobs.some((job) => job.status === "on_hold") ? "exception"
        : crewJobs.some((job) => job.status === "dispatched" || job.status === "in_progress") ? "on_route"
        : "scheduled";
      return {
        crewId: crew.id,
        name: crew.name,
        jobCount: crewJobs.length,
        nextStartAt: upcoming[0]?.scheduledStart?.toISOString() ?? null,
        status,
        sources: [commandCenterSource("crew", crew.id, null, null), ...crewJobs.map((job) => jobSource(job, job.scheduledStart))].slice(0, 20)
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const missing: CommandCenterMissingData[] = [];
  if (inqNow.count === 0 && inqPrev.count === 0) missing.push("inquiries");
  if (data.jobRows.length === 0) missing.push("jobs");
  if (data.actions.length === 0) missing.push("agent_actions");
  if (data.crewRows.length === 0) missing.push("crews");
  const hasAnyData = data.bookings.length + data.calls.length + data.jobRows.length + data.actions.length + data.crewRows.length > 0;

  const todayCapped = capSources(jobsToday.map((job) => jobSource(job, job.scheduledStart)));

  return {
    generatedAt: now.toISOString(),
    period: {
      date,
      period: "month",
      startDate: current.startDate,
      endDate: current.endDate,
      timeZone,
      compareStartDate: previous.startDate,
      compareEndDate: previous.endDate
    },
    header: { approvalsWaiting: approvals, exceptions },
    kpis,
    needsYou: { counts: { approvals, exceptions }, items: needsYouAll.slice(0, NEEDS_YOU_LIMIT), truncated: needsYouAll.length > NEEDS_YOU_LIMIT },
    loop,
    crewsToday,
    today: { jobsToday: jobsToday.length, sources: todayCapped.sources },
    emptyStates: { hasAnyData, missing }
  };
}
