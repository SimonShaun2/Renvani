"use client";

import { useQuery } from "@tanstack/react-query";
import { addDays, endOfDay, endOfMonth, format, isSameDay, parseISO, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";

import { api } from "@/src/lib/api";

interface PaginatedResponse<TItem> {
  data: TItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface JobRecord {
  id: string;
  jobNumber: string;
  title: string;
  priority: string;
  status: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  technician: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    calendarColor: string | null;
  } | null;
  createdAt: string;
}

interface EstimateRecord {
  id: string;
  estimateNumber: string;
  title: string | null;
  status: string;
  total: string;
  subtotal: string;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  sentAt: string | null;
  expiresAt: string | null;
  approvedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
}

interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  title: string | null;
  status: string;
  total: string;
  amountPaid: string;
  balanceDue: string;
  dueAt: string | null;
  paidAt: string | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface PaymentRecord {
  id: string;
  companyId: string;
  invoiceId: string;
  customerId: string;
  collectedById: string | null;
  amount: string;
  method: string;
  status: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  checkNumber: string | null;
  referenceNumber: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

interface ReviewRequestRecord {
  id: string;
  referenceId: string;
  status: "pending" | "sent" | "clicked" | "completed" | "declined";
  channel: "sms" | "email";
  sentAt: string | null;
  completedAt: string | null;
  rating: number | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    email: string | null;
  };
  technician: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  job: {
    id: string;
    jobNumber: string;
    title: string;
  } | null;
  createdAt: string;
}

interface ReviewRequestsResponse extends PaginatedResponse<ReviewRequestRecord> {
  stats: {
    pending: number;
    sent: number;
    clicked: number;
    completed: number;
    declined: number;
    averageRating: number | null;
  };
}

interface ServiceAgreementRecord {
  id: string;
  name: string;
  status: string;
  frequency: string;
  nextServiceDate: string | null;
  lastServiceDate: string | null;
  price: string | null;
  billingCycle: "monthly" | "annual" | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

interface TechnicianRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  skills: string[];
  serviceZipCodes: string[];
  availableDays: Array<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun">;
  status: "active" | "inactive";
  calendarColor: string;
  hoursPerDay: string;
  totalJobsCompleted: number;
  userId: string | null;
  createdAt: string;
}

interface ReportingDataset {
  range: ResolvedReportingRange;
  jobs: JobRecord[];
  estimates: EstimateRecord[];
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  reviews: ReviewRequestRecord[];
  technicians: TechnicianRecord[];
}

type MetricDirection = "up" | "down" | "flat";

export type ReportingPreset = "this_month" | "last_month" | "last_3_months" | "last_12_months" | "custom";

export interface ReportingPeriod {
  preset: ReportingPreset;
  startDate?: string;
  endDate?: string;
}

export interface ResolvedReportingRange {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  dayCount: number;
  currentLabel: string;
}

export interface ReportingKpiMetric {
  id: "revenue" | "jobs" | "estimates" | "conversion" | "ticket";
  label: string;
  value: string;
  helper: string;
  trendDirection: MetricDirection;
  trendPercent: number;
  trendLabel: string;
}

export interface RevenueChartPoint {
  dateKey: string;
  label: string;
  revenue: number;
  formattedRevenue: string;
  isToday: boolean;
}

export interface TechUtilizationRow {
  id: string;
  name: string;
  utilizationPercent: number;
  jobsCount: number;
  tone: "green" | "orange" | "red";
  bookedMinutes: number;
  availableMinutes: number;
}

export interface PipelineMetricRow {
  id: "estimates" | "unpaid" | "agreements" | "overdue";
  label: string;
  count: number;
  value: string;
  note: string;
}

export interface EstimateConversionSummary {
  rate: number;
  approved: number;
  pending: number;
  declined: number;
  total: number;
}

export interface ReviewScoreSummary {
  averageRating: number;
  totalReviews: number;
  breakdown: Array<{
    stars: number;
    count: number;
    percent: number;
  }>;
}

export interface ReportingActivityItem {
  id: string;
  summary: string;
  occurredAt: string;
  amount: string | null;
  tone: "green" | "red" | "blue" | "orange";
}

const MAX_PAGE_SIZE = 100;
const ACTIVE_AGREEMENT_STATUSES = new Set(["active", "paused"]);
const JOB_COMPLETION_STATUSES = new Set(["completed", "invoiced", "paid", "closed"]);
const IN_PROGRESS_JOB_STATUSES = new Set(["scheduled", "dispatched", "in_progress", "completed", "invoiced", "paid", "closed"]);
const PENDING_ESTIMATE_STATUSES = new Set(["draft", "sent", "viewed", "approved", "revised"]);
const APPROVED_ESTIMATE_STATUSES = new Set(["approved", "converted"]);
const DECLINED_ESTIMATE_STATUSES = new Set(["declined", "expired"]);
const PENDING_CONVERSION_STATUSES = new Set(["sent", "viewed", "revised"]);

function toQueryString(values: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) {
      params.set(key, String(value));
    }
  }

  return params.toString();
}

function roundCurrency(value: number): string {
  return value.toFixed(2);
}

function toAmount(value: string | null | undefined): number {
  const parsed = Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPercent(current: number, previous: number): { direction: MetricDirection; percent: number } {
  if (current === previous) {
    return { direction: "flat", percent: 0 };
  }

  if (previous <= 0) {
    return {
      direction: current > 0 ? "up" : "flat",
      percent: current > 0 ? 100 : 0
    };
  }

  const raw = ((current - previous) / previous) * 100;
  const direction: MetricDirection = raw > 0 ? "up" : raw < 0 ? "down" : "flat";

  return {
    direction,
    percent: Math.round(Math.abs(raw))
  };
}

function formatRangeLabel(start: Date, end: Date) {
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameYear) {
    if (start.getMonth() === end.getMonth()) {
      return `${format(start, "MMM d")} - ${format(end, "d, yyyy")}`;
    }

    return `${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`;
  }

  return `${format(start, "MMM d, yyyy")} - ${format(end, "MMM d, yyyy")}`;
}

function getResolvedRange(period: ReportingPeriod): ResolvedReportingRange {
  const today = new Date();
  let start: Date;
  let end: Date;

  switch (period.preset) {
    case "last_month": {
      const previousMonth = subMonths(today, 1);
      start = startOfMonth(previousMonth);
      end = endOfDay(endOfMonth(previousMonth));
      break;
    }
    case "last_3_months":
      start = startOfMonth(subMonths(today, 2));
      end = endOfDay(today);
      break;
    case "last_12_months":
      start = startOfMonth(subMonths(today, 11));
      end = endOfDay(today);
      break;
    case "custom": {
      const parsedStart = period.startDate ? parseISO(period.startDate) : today;
      const parsedEnd = period.endDate ? parseISO(period.endDate) : today;
      start = startOfDay(parsedStart);
      end = endOfDay(parsedEnd.getTime() < parsedStart.getTime() ? parsedStart : parsedEnd);
      break;
    }
    case "this_month":
    default:
      start = startOfMonth(today);
      end = endOfDay(today);
      break;
  }

  const dayCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
  const previousEnd = endOfDay(subDays(start, 1));
  const previousStart = startOfDay(subDays(previousEnd, dayCount - 1));

  return {
    start,
    end,
    previousStart,
    previousEnd,
    dayCount,
    currentLabel: formatRangeLabel(start, end)
  };
}

export function describeReportingPeriod(period: ReportingPeriod): string {
  const range = getResolvedRange(period);

  switch (period.preset) {
    case "this_month":
      return `This Month (${format(range.start, "MMM yyyy")})`;
    case "last_month":
      return `Last Month (${format(range.start, "MMM yyyy")})`;
    case "last_3_months":
      return `Last 3 Months (${format(range.start, "MMM")} - ${format(range.end, "MMM yyyy")})`;
    case "last_12_months":
      return `Last 12 Months (${format(range.start, "MMM yyyy")} - ${format(range.end, "MMM yyyy")})`;
    case "custom":
    default:
      return `Custom Range (${range.currentLabel})`;
  }
}

function parseOptionalDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinRange(value: string | Date | null | undefined, start: Date, end: Date): boolean {
  if (!value) {
    return false;
  }

  const parsed = value instanceof Date ? value : parseOptionalDate(value);

  if (!parsed) {
    return false;
  }

  return parsed >= start && parsed <= end;
}

function getJobWindowDate(job: JobRecord): string {
  return job.scheduledEnd ?? job.scheduledStart ?? job.createdAt;
}

function getEstimateConversionBucket(estimate: EstimateRecord): "approved" | "pending" | "declined" | null {
  if (APPROVED_ESTIMATE_STATUSES.has(estimate.status)) {
    return "approved";
  }

  if (DECLINED_ESTIMATE_STATUSES.has(estimate.status)) {
    return "declined";
  }

  if (PENDING_CONVERSION_STATUSES.has(estimate.status)) {
    return "pending";
  }

  return null;
}

async function fetchAllPages<TItem>(path: string, query: Record<string, string | number | undefined>) {
  const items: TItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await api.get<PaginatedResponse<TItem>>(
      `${path}?${toQueryString({
        ...query,
        page,
        limit: MAX_PAGE_SIZE
      })}`
    );

    items.push(...response.data);
    totalPages = response.totalPages;
    page += 1;
  } while (page <= totalPages);

  return items;
}

async function fetchReviewPages() {
  const items: ReviewRequestRecord[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const response = await api.get<ReviewRequestsResponse>(
      `/api/v1/review-requests?${toQueryString({
        page,
        limit: MAX_PAGE_SIZE
      })}`
    );

    items.push(...response.data);
    totalPages = response.totalPages;
    page += 1;
  } while (page <= totalPages);

  return items;
}

async function fetchReportingDataset(period: ReportingPeriod): Promise<ReportingDataset> {
  const range = getResolvedRange(period);
  const from = range.previousStart.toISOString();
  const to = range.end.toISOString();

  const [jobs, estimates, invoices, payments, reviews, technicians] = await Promise.all([
    fetchAllPages<JobRecord>("/api/v1/jobs", {
      scheduledAfter: from,
      scheduledBefore: to,
      sortBy: "scheduledStart",
      sortOrder: "asc"
    }),
    fetchAllPages<EstimateRecord>("/api/v1/estimates", {
      createdAfter: from,
      createdBefore: to,
      sortBy: "createdAt",
      sortOrder: "asc"
    }),
    fetchAllPages<InvoiceRecord>("/api/v1/invoices", {
      createdAfter: from,
      createdBefore: to,
      sortBy: "createdAt",
      sortOrder: "asc"
    }),
    fetchAllPages<PaymentRecord>("/api/v1/payments", {
      createdAfter: from,
      createdBefore: to,
      sortBy: "createdAt",
      sortOrder: "asc"
    }),
    fetchReviewPages(),
    fetchAllPages<TechnicianRecord>("/api/v1/technicians", {
      status: "active",
      sortBy: "firstName",
      sortOrder: "asc"
    })
  ]);

  return {
    range,
    jobs,
    estimates,
    invoices,
    payments,
    reviews,
    technicians
  };
}

async function fetchPipelineSnapshot(period: ReportingPeriod) {
  const range = getResolvedRange(period);
  const from = range.previousStart.toISOString();
  const to = range.end.toISOString();

  const [estimates, invoices, agreements] = await Promise.all([
    fetchAllPages<EstimateRecord>("/api/v1/estimates", {
      createdAfter: from,
      createdBefore: to,
      sortBy: "createdAt",
      sortOrder: "desc"
    }),
    fetchAllPages<InvoiceRecord>("/api/v1/invoices", {
      createdAfter: from,
      createdBefore: to,
      sortBy: "createdAt",
      sortOrder: "desc"
    }),
    fetchAllPages<ServiceAgreementRecord>("/api/v1/service-agreements", {
      sortBy: "nextServiceDate",
      sortOrder: "asc"
    })
  ]);

  return {
    estimates,
    invoices,
    agreements
  };
}

function buildDatasetQuery(period: ReportingPeriod) {
  return {
    queryKey: ["reporting", "dataset", period.preset, period.startDate ?? "", period.endDate ?? ""],
    queryFn: () => fetchReportingDataset(period),
    staleTime: 60 * 1000
  } as const;
}

function getRevenueAmount(payment: PaymentRecord): number {
  if (payment.status !== "succeeded") {
    return 0;
  }

  return toAmount(payment.amount);
}

function getAverageTicketValue(revenue: number, jobCount: number): number {
  if (jobCount <= 0) {
    return 0;
  }

  return revenue / jobCount;
}

function buildKpiMetrics(dataset: ReportingDataset): ReportingKpiMetric[] {
  const currentPayments = dataset.payments.filter((payment) =>
    isWithinRange(payment.paidAt ?? payment.createdAt, dataset.range.start, dataset.range.end)
  );
  const previousPayments = dataset.payments.filter((payment) =>
    isWithinRange(payment.paidAt ?? payment.createdAt, dataset.range.previousStart, dataset.range.previousEnd)
  );
  const currentRevenue = currentPayments.reduce((sum, payment) => sum + getRevenueAmount(payment), 0);
  const previousRevenue = previousPayments.reduce((sum, payment) => sum + getRevenueAmount(payment), 0);

  const currentCompletedJobs = dataset.jobs.filter(
    (job) =>
      JOB_COMPLETION_STATUSES.has(job.status) &&
      isWithinRange(getJobWindowDate(job), dataset.range.start, dataset.range.end)
  );
  const previousCompletedJobs = dataset.jobs.filter(
    (job) =>
      JOB_COMPLETION_STATUSES.has(job.status) &&
      isWithinRange(getJobWindowDate(job), dataset.range.previousStart, dataset.range.previousEnd)
  );

  const currentSentEstimates = dataset.estimates.filter((estimate) =>
    isWithinRange(estimate.sentAt, dataset.range.start, dataset.range.end)
  );
  const previousSentEstimates = dataset.estimates.filter((estimate) =>
    isWithinRange(estimate.sentAt, dataset.range.previousStart, dataset.range.previousEnd)
  );

  const currentConversion = buildEstimateConversion(dataset, dataset.range.start, dataset.range.end);
  const previousConversion = buildEstimateConversion(dataset, dataset.range.previousStart, dataset.range.previousEnd);
  const currentAverageTicket = getAverageTicketValue(currentRevenue, currentCompletedJobs.length);
  const previousAverageTicket = getAverageTicketValue(previousRevenue, previousCompletedJobs.length);

  const revenueTrend = toPercent(currentRevenue, previousRevenue);
  const jobsTrend = toPercent(currentCompletedJobs.length, previousCompletedJobs.length);
  const estimatesTrend = toPercent(currentSentEstimates.length, previousSentEstimates.length);
  const conversionTrend = toPercent(currentConversion.rate, previousConversion.rate);
  const ticketTrend = toPercent(currentAverageTicket, previousAverageTicket);

  return [
    {
      id: "revenue",
      label: "Revenue Collected",
      value: roundCurrency(currentRevenue),
      helper: `vs ${dataset.range.dayCount}-day prior period`,
      trendDirection: revenueTrend.direction,
      trendPercent: revenueTrend.percent,
      trendLabel: "Revenue trend"
    },
    {
      id: "jobs",
      label: "Jobs Completed",
      value: String(currentCompletedJobs.length),
      helper: `${currentCompletedJobs.length} completed jobs`,
      trendDirection: jobsTrend.direction,
      trendPercent: jobsTrend.percent,
      trendLabel: "Completion trend"
    },
    {
      id: "estimates",
      label: "Estimates Sent",
      value: String(currentSentEstimates.length),
      helper: `${currentSentEstimates.length} customer-ready quotes`,
      trendDirection: estimatesTrend.direction,
      trendPercent: estimatesTrend.percent,
      trendLabel: "Send trend"
    },
    {
      id: "conversion",
      label: "Conversion Rate",
      value: `${currentConversion.rate}%`,
      helper: `${currentConversion.approved} approved of ${currentConversion.total}`,
      trendDirection: conversionTrend.direction,
      trendPercent: conversionTrend.percent,
      trendLabel: "Conversion trend"
    },
    {
      id: "ticket",
      label: "Avg Ticket Value",
      value: roundCurrency(currentAverageTicket),
      helper: "Revenue per completed job",
      trendDirection: ticketTrend.direction,
      trendPercent: ticketTrend.percent,
      trendLabel: "Ticket value trend"
    }
  ];
}

function buildRevenueChartData(dataset: ReportingDataset): RevenueChartPoint[] {
  const points: RevenueChartPoint[] = [];
  const paymentsByDay = new Map<string, number>();
  let cursor = new Date(dataset.range.start);

  for (const payment of dataset.payments) {
    if (!isWithinRange(payment.paidAt ?? payment.createdAt, dataset.range.start, dataset.range.end)) {
      continue;
    }

    const paymentDate = parseOptionalDate(payment.paidAt ?? payment.createdAt);

    if (!paymentDate) {
      continue;
    }

    const dayKey = format(paymentDate, "yyyy-MM-dd");
    paymentsByDay.set(dayKey, (paymentsByDay.get(dayKey) ?? 0) + getRevenueAmount(payment));
  }

  while (cursor <= dataset.range.end) {
    const dayKey = format(cursor, "yyyy-MM-dd");
    const revenue = paymentsByDay.get(dayKey) ?? 0;

    points.push({
      dateKey: dayKey,
      label: format(cursor, dataset.range.dayCount > 62 ? "MMM d" : "MMM d"),
      revenue,
      formattedRevenue: roundCurrency(revenue),
      isToday: isSameDay(cursor, new Date())
    });

    // Calendar-day step: a fixed 24h step stalls on 25-hour DST fall-back days (infinite loop).
    cursor = startOfDay(addDays(cursor, 1));
  }

  return points;
}

function getWorkingDaysBetween(start: Date, end: Date, availableDays: TechnicianRecord["availableDays"]) {
  const allowedDays = new Set(availableDays);
  let count = 0;
  let cursor = new Date(start);

  while (cursor <= end) {
    const weekday = format(cursor, "EEE").toLowerCase().slice(0, 3) as TechnicianRecord["availableDays"][number];

    if (allowedDays.has(weekday)) {
      count += 1;
    }

    // Calendar-day step: a fixed 24h step stalls on 25-hour DST fall-back days (infinite loop).
    cursor = startOfDay(addDays(cursor, 1));
  }

  return count;
}

function buildTechUtilizationRows(dataset: ReportingDataset): TechUtilizationRow[] {
  return dataset.technicians
    .filter((technician) => technician.status === "active")
    .map((technician) => {
      const technicianJobs = dataset.jobs.filter(
        (job) =>
          job.technician?.id === technician.id &&
          IN_PROGRESS_JOB_STATUSES.has(job.status) &&
          isWithinRange(getJobWindowDate(job), dataset.range.start, dataset.range.end)
      );
      const bookedMinutes = technicianJobs.reduce((sum, job) => {
        const start = parseOptionalDate(job.scheduledStart);
        const end = parseOptionalDate(job.scheduledEnd);

        if (!start || !end || end <= start) {
          return sum;
        }

        return sum + Math.round((end.getTime() - start.getTime()) / (60 * 1000));
      }, 0);
      const workDays = getWorkingDaysBetween(dataset.range.start, dataset.range.end, technician.availableDays);
      const hoursPerDay = Number.parseFloat(technician.hoursPerDay);
      const safeHoursPerDay = Number.isFinite(hoursPerDay) && hoursPerDay > 0 ? hoursPerDay : 8;
      const availableMinutes = workDays * safeHoursPerDay * 60;
      const utilizationPercent =
        availableMinutes > 0 ? Math.max(0, Math.min(100, Math.round((bookedMinutes / availableMinutes) * 100))) : 0;
      const tone: TechUtilizationRow["tone"] =
        utilizationPercent > 80 ? "green" : utilizationPercent >= 60 ? "orange" : "red";

      return {
        id: technician.id,
        name: `${technician.firstName} ${technician.lastName}`.trim(),
        utilizationPercent,
        jobsCount: technicianJobs.length,
        tone,
        bookedMinutes,
        availableMinutes
      };
    })
    .sort((left, right) => right.utilizationPercent - left.utilizationPercent || right.jobsCount - left.jobsCount);
}

function buildEstimateConversion(dataset: ReportingDataset, start: Date, end: Date): EstimateConversionSummary {
  const relevantEstimates = dataset.estimates.filter((estimate) => {
    const comparisonDate = estimate.sentAt ?? estimate.createdAt;
    return isWithinRange(comparisonDate, start, end);
  });

  const approved = relevantEstimates.filter((estimate) => getEstimateConversionBucket(estimate) === "approved").length;
  const pending = relevantEstimates.filter((estimate) => getEstimateConversionBucket(estimate) === "pending").length;
  const declined = relevantEstimates.filter((estimate) => getEstimateConversionBucket(estimate) === "declined").length;
  const total = approved + pending + declined;

  return {
    rate: total > 0 ? Math.round((approved / total) * 100) : 0,
    approved,
    pending,
    declined,
    total
  };
}

function buildReviewSummary(dataset: ReportingDataset): ReviewScoreSummary {
  const completedReviews = dataset.reviews.filter(
    (review) =>
      review.status === "completed" &&
      typeof review.rating === "number" &&
      isWithinRange(review.completedAt ?? review.createdAt, dataset.range.start, dataset.range.end)
  );
  const totalReviews = completedReviews.length;
  const averageRating =
    totalReviews > 0
      ? Number(
          (
            completedReviews.reduce((sum, review) => sum + Number(review.rating ?? 0), 0) / totalReviews
          ).toFixed(1)
        )
      : 0;
  const breakdown = [5, 4, 3, 2, 1].map((stars) => {
    const count = completedReviews.filter((review) => review.rating === stars).length;
    return {
      stars,
      count,
      percent: totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0
    };
  });

  return {
    averageRating,
    totalReviews,
    breakdown
  };
}

function buildActivityFeed(dataset: ReportingDataset): ReportingActivityItem[] {
  const activity: ReportingActivityItem[] = [];

  for (const job of dataset.jobs) {
    if (
      JOB_COMPLETION_STATUSES.has(job.status) &&
      isWithinRange(getJobWindowDate(job), dataset.range.start, dataset.range.end)
    ) {
      activity.push({
        id: `job-${job.id}`,
        summary: `Job ${job.jobNumber} completed - ${job.title} at ${job.customer.firstName} ${job.customer.lastName}`.trim(),
        occurredAt: getJobWindowDate(job),
        amount: null,
        tone: "green"
      });
    }
  }

  for (const invoice of dataset.invoices) {
    if (isWithinRange(invoice.paidAt, dataset.range.start, dataset.range.end)) {
      activity.push({
        id: `invoice-paid-${invoice.id}`,
        summary: `Payment received - ${invoice.customer.firstName} ${invoice.customer.lastName} invoice ${invoice.invoiceNumber}`,
        occurredAt: invoice.paidAt ?? invoice.createdAt,
        amount: roundCurrency(toAmount(invoice.amountPaid || invoice.total)),
        tone: "green"
      });
    }

    const isOverdue =
      toAmount(invoice.balanceDue) > 0 &&
      (() => {
        if (invoice.status === "overdue") {
          return true;
        }

        const dueDate = parseOptionalDate(invoice.dueAt);
        return dueDate ? dueDate.getTime() < Date.now() : false;
      })();

    if (isOverdue && isWithinRange(invoice.dueAt ?? invoice.createdAt, dataset.range.start, dataset.range.end)) {
      activity.push({
        id: `invoice-overdue-${invoice.id}`,
        summary: `Invoice ${invoice.invoiceNumber} overdue - ${invoice.customer.firstName} ${invoice.customer.lastName}`,
        occurredAt: invoice.dueAt ?? invoice.createdAt,
        amount: `-${roundCurrency(toAmount(invoice.balanceDue))}`,
        tone: "red"
      });
    }
  }

  for (const estimate of dataset.estimates) {
    if (isWithinRange(estimate.approvedAt, dataset.range.start, dataset.range.end)) {
      activity.push({
        id: `estimate-approved-${estimate.id}`,
        summary: `Estimate ${estimate.estimateNumber} approved - ${estimate.customer.firstName} ${estimate.customer.lastName}`,
        occurredAt: estimate.approvedAt ?? estimate.createdAt,
        amount: roundCurrency(toAmount(estimate.total)),
        tone: "blue"
      });
    }
  }

  for (const review of dataset.reviews) {
    if (
      review.status === "completed" &&
      typeof review.rating === "number" &&
      isWithinRange(review.completedAt ?? review.createdAt, dataset.range.start, dataset.range.end)
    ) {
      activity.push({
        id: `review-${review.id}`,
        summary: `${review.rating}-star review received - ${review.customer.firstName} ${review.customer.lastName}`,
        occurredAt: review.completedAt ?? review.createdAt,
        amount: null,
        tone: "orange"
      });
    }
  }

  return activity
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 10);
}

function buildPipelineRows(snapshot: {
  estimates: EstimateRecord[];
  invoices: InvoiceRecord[];
  agreements: ServiceAgreementRecord[];
}): PipelineMetricRow[] {
  const pendingEstimates = snapshot.estimates.filter((estimate) => PENDING_ESTIMATE_STATUSES.has(estimate.status));
  const unpaidInvoices = snapshot.invoices.filter(
    (invoice) => toAmount(invoice.balanceDue) > 0 && ["sent", "viewed", "partially_paid", "overdue"].includes(invoice.status)
  );
  const overdueInvoices = snapshot.invoices.filter((invoice) => {
    if (toAmount(invoice.balanceDue) <= 0) {
      return false;
    }

    if (invoice.status === "overdue") {
      return true;
    }

    const dueDate = parseOptionalDate(invoice.dueAt);
    return dueDate ? dueDate < new Date() : false;
  });
  const activeAgreements = snapshot.agreements.filter((agreement) => ACTIVE_AGREEMENT_STATUSES.has(agreement.status));
  const activeAgreementValue = activeAgreements.reduce((sum, agreement) => {
    const price = toAmount(agreement.price);
    return sum + (agreement.billingCycle === "annual" ? price / 12 : price);
  }, 0);

  return [
    {
      id: "estimates",
      label: "Estimates Pending",
      count: pendingEstimates.length,
      value: roundCurrency(pendingEstimates.reduce((sum, estimate) => sum + toAmount(estimate.total), 0)),
      note: "Open estimate value"
    },
    {
      id: "unpaid",
      label: "Invoices Unpaid",
      count: unpaidInvoices.length,
      value: roundCurrency(unpaidInvoices.reduce((sum, invoice) => sum + toAmount(invoice.balanceDue), 0)),
      note: "Outstanding balance"
    },
    {
      id: "agreements",
      label: "Active Agreements",
      count: activeAgreements.length,
      value: roundCurrency(activeAgreementValue),
      note: "Monthly recurring revenue"
    },
    {
      id: "overdue",
      label: "Overdue Invoices",
      count: overdueInvoices.length,
      value: roundCurrency(overdueInvoices.reduce((sum, invoice) => sum + toAmount(invoice.balanceDue), 0)),
      note: "Past due balance"
    }
  ];
}

export function useReportingKPIs(period: ReportingPeriod) {
  return useQuery({
    ...buildDatasetQuery(period),
    select: buildKpiMetrics
  });
}

export function useRevenueChart(period: ReportingPeriod) {
  return useQuery({
    ...buildDatasetQuery(period),
    select: buildRevenueChartData
  });
}

export function useTechUtilization(period: ReportingPeriod) {
  return useQuery({
    ...buildDatasetQuery(period),
    select: buildTechUtilizationRows
  });
}

export function useEstimateConversion(period: ReportingPeriod) {
  return useQuery({
    ...buildDatasetQuery(period),
    select: (dataset) => buildEstimateConversion(dataset, dataset.range.start, dataset.range.end)
  });
}

export function useReviewScore(period: ReportingPeriod) {
  return useQuery({
    ...buildDatasetQuery(period),
    select: buildReviewSummary
  });
}

export function useReportingActivity(period: ReportingPeriod) {
  return useQuery({
    ...buildDatasetQuery(period),
    select: buildActivityFeed
  });
}

export function usePipelineMetrics(period: ReportingPeriod) {
  return useQuery({
    queryKey: ["reporting", "pipeline", period.preset, period.startDate ?? "", period.endDate ?? ""],
    queryFn: () => fetchPipelineSnapshot(period),
    staleTime: 60 * 1000,
    select: buildPipelineRows
  });
}
