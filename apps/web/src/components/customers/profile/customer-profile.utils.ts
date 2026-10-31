import type {
  AssetRecord,
  CustomerAgreementRecord,
  CustomerDetailRecord,
  CustomerInvoiceRecord,
  CustomerJobRecord,
  PropertyRecord
} from "@/src/hooks/customers.hooks";

/** Pill tones used across Figma 1:17 (Status/* components 144:139–144:219). */
export type ProfilePillTone = "blue" | "green" | "neutral" | "amber" | "red";

export interface ProfilePill {
  key: string;
  label: string;
  tone: ProfilePillTone;
}

export interface ProfileKpi {
  key: "lifetime" | "balance" | "nextVisit" | "plan";
  label: string;
  value: string;
  caption: string;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses API dates; date-only "YYYY-MM-DD" is read as local parts (no UTC shift). */
export function parseProfileDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parts = DATE_ONLY.exec(value);
  const date = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function format(value: string | null | undefined, options: Intl.DateTimeFormatOptions): string | null {
  return parseProfileDate(value)?.toLocaleDateString("en-US", options) ?? null;
}

export const formatMonthDay = (value: string | null | undefined) => format(value, { month: "short", day: "numeric" });
export const formatMonthYear = (value: string | null | undefined) => format(value, { month: "short", year: "numeric" });
export const formatYear = (value: string | null | undefined) => format(value, { year: "numeric" });

/** "$1,920" for whole amounts, "$1,920.50" otherwise. */
export function formatProfileMoney(value: string | number): string {
  const amount = typeof value === "string" ? Number.parseFloat(value) : value;
  const safe = Number.isFinite(amount) ? amount : 0;
  const whole = Math.round(safe * 100) % 100 === 0;
  return safe.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2
  });
}

const PROPERTY_TYPE_LABELS: Record<PropertyRecord["type"], string> = {
  residential: "Residential",
  commercial: "Commercial",
  industrial: "Industrial",
  multi_family: "Multi-family"
};

export function primaryProperty(customer: Pick<CustomerDetailRecord, "properties">): PropertyRecord | null {
  return customer.properties.find((property) => property.isPrimary) ?? customer.properties[0] ?? null;
}

export function activeAgreement(agreements: CustomerAgreementRecord[]): CustomerAgreementRecord | null {
  return agreements.find((agreement) => agreement.status === "active") ?? null;
}

/** Subtitle under the name (144:95): "Customer since Mar 2024 · Residential". */
export function buildProfileSubtitle(customer: CustomerDetailRecord): string {
  const since = formatMonthYear(customer.firstServiceDate ?? customer.createdAt);
  const property = primaryProperty(customer);
  return [since ? `Customer since ${since}` : null, property ? PROPERTY_TYPE_LABELS[property.type] : null]
    .filter(Boolean)
    .join(" · ");
}

const UPCOMING_JOB_STATUSES = new Set(["scheduled", "dispatched", "estimate_approved"]);
const CLOSED_INVOICE_STATUSES = new Set(["void", "draft", "paid", "refunded", "written_off"]);

/** KPI row (144:100): lifetime value, open balance, next visit, plan. */
export function buildProfileKpis(input: {
  customer: Pick<CustomerDetailRecord, "lifetimeValue" | "totalJobs">;
  invoices: CustomerInvoiceRecord[];
  agreements: CustomerAgreementRecord[];
  jobs: CustomerJobRecord[];
  now?: Date;
}): ProfileKpi[] {
  const now = input.now ?? new Date();
  const open = input.invoices.filter((invoice) => !CLOSED_INVOICE_STATUSES.has(invoice.status) && Number(invoice.balanceDue) > 0);
  const balance = open.reduce((sum, invoice) => sum + Number(invoice.balanceDue), 0);

  const nextJob = input.jobs
    .filter((job) => UPCOMING_JOB_STATUSES.has(job.status) && (parseProfileDate(job.scheduledStart)?.getTime() ?? -1) >= now.getTime())
    .sort((a, b) => (parseProfileDate(a.scheduledStart)?.getTime() ?? 0) - (parseProfileDate(b.scheduledStart)?.getTime() ?? 0))[0];
  const plan = activeAgreement(input.agreements);
  const nextVisit = nextJob
    ? { value: formatMonthDay(nextJob.scheduledStart), caption: nextJob.title }
    : plan?.nextServiceDate
      ? { value: formatMonthDay(plan.nextServiceDate), caption: plan.name }
      : null;

  const jobs = input.customer.totalJobs;
  return [
    { key: "lifetime", label: "Lifetime value", value: formatProfileMoney(input.customer.lifetimeValue), caption: `${jobs} ${jobs === 1 ? "job" : "jobs"}` },
    {
      key: "balance",
      label: "Open balance",
      value: formatProfileMoney(balance),
      caption: open.length === 0 ? "All invoices paid" : `${open.length} open ${open.length === 1 ? "invoice" : "invoices"}`
    },
    { key: "nextVisit", label: "Next visit", value: nextVisit?.value ?? "—", caption: nextVisit?.caption ?? "Nothing scheduled" },
    {
      key: "plan",
      label: "Plan",
      value: plan?.name ?? "—",
      caption: plan ? [plan.frequency, plan.billingCycle ? `billed ${plan.billingCycle}` : null].filter(Boolean).join(" · ") : "No active plan"
    }
  ];
}

/** Contact & property pills (144:138). "Card on file" needs a saved-card API, so it is not derived. */
export function buildContactPills(customer: CustomerDetailRecord, agreements: CustomerAgreementRecord[]): ProfilePill[] {
  const pills: ProfilePill[] = [];
  const property = primaryProperty(customer);
  if (property) pills.push({ key: "type", label: PROPERTY_TYPE_LABELS[property.type], tone: "blue" });
  const plan = activeAgreement(agreements);
  if (plan) pills.push({ key: "plan", label: `VIP · ${plan.name}`, tone: "neutral" });
  if (customer.doNotContact) pills.push({ key: "dnc", label: "Do not contact", tone: "red" });
  return pills;
}

/** Equipment rows (144:150–144:152): "Carrier gas furnace 59SC5 · installed 2016". */
export function formatEquipmentLine(asset: Pick<AssetRecord, "name" | "model" | "installDate">): string {
  const name = asset.model && !asset.name.includes(asset.model) ? `${asset.name} ${asset.model}` : asset.name;
  const year = formatYear(asset.installDate);
  return year ? `${name} · installed ${year}` : name;
}

const JOB_STATE_PILLS: Record<string, { label: string; tone: ProfilePillTone }> = {
  paid: { label: "Paid", tone: "green" },
  completed: { label: "Completed", tone: "green" },
  closed: { label: "Closed", tone: "green" },
  invoiced: { label: "Invoiced", tone: "amber" },
  scheduled: { label: "Scheduled", tone: "blue" },
  dispatched: { label: "Dispatched", tone: "blue" },
  in_progress: { label: "In progress", tone: "blue" },
  on_hold: { label: "On hold", tone: "amber" },
  cancelled: { label: "Canceled", tone: "neutral" }
};

/** Jobs table STATE column (144:176 Paid, 144:215 Scheduled). Unknown statuses fall back to a neutral label. */
export function jobStatePill(status: string): { label: string; tone: ProfilePillTone } {
  return JOB_STATE_PILLS[status] ?? { label: status.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()), tone: "neutral" };
}
