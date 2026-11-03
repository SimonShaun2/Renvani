import { and, eq, isNull } from "drizzle-orm";

import { companies, db, jobs, technicians } from "@fsm/db";
import {
  AppError,
  type AutoFitResponse,
  type AutoFitScoreBreakdown,
  type AutoFitSuggestion,
  ErrorCode,
  type JobDetail
} from "@fsm/types";

import { getJob } from "./job.service.js";

type CompanyRow = typeof companies.$inferSelect;
type JobRow = typeof jobs.$inferSelect;
type TechnicianRow = typeof technicians.$inferSelect;

type AutoFitInput = {
  companyId: string;
  jobId: string;
  date: string;
};

type RankedSuggestion = AutoFitSuggestion & {
  hiddenTieBreakers: {
    travelProximity: number;
    slotWasteMinutes: number;
    utilization: number;
  };
};

type OpenSlot = {
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  wasteMinutes: number;
};

const DEFAULT_HOURS_PER_DAY = 8;
const DEFAULT_JOB_DURATION_MINUTES = 120;
const MAX_SUGGESTIONS = 3;
const WORKDAY_START_HOUR = 8;
const DEFAULT_TIME_ZONE = "America/Chicago";
const CANCELLED_JOB_STATUSES = new Set(["cancelled"]);
const KNOWN_SKILL_TOKENS = [
  "hvac",
  "heating",
  "cooling",
  "air conditioning",
  "ac",
  "furnace",
  "boiler",
  "refrigeration",
  "water heater",
  "electrical",
  "plumbing",
  "maintenance",
  "inspection",
  "installation",
  "repair",
  "emergency",
  "thermostat",
  "air handler",
  "condenser"
] as const;
const JOB_TYPE_SKILL_HINTS: Record<string, string[]> = {
  service_call: ["repair", "service"],
  maintenance: ["maintenance", "tune-up"],
  installation: ["installation"],
  inspection: ["inspection"],
  estimate_only: ["estimate"],
  warranty: ["warranty", "repair"],
  callback: ["repair", "service"],
  emergency: ["emergency", "repair"]
};

function assertIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "date must be in YYYY-MM-DD format");
  }

  const parsed = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, "date must be in YYYY-MM-DD format");
  }

  return value;
}

function parseHoursPerDay(value: string | null): number {
  const parsed = Number(value ?? String(DEFAULT_HOURS_PER_DAY));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_HOURS_PER_DAY;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(25, Math.round(value)));
}

function getDatePartsForTimeZone(dateValue: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(dateValue);

  const result: Record<string, string> = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      result[part.type] = part.value;
    }
  }

  return result;
}

function getTimeZoneOffsetMinutes(dateValue: Date, timeZone: string): number {
  const parts = getDatePartsForTimeZone(dateValue, timeZone);
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );

  return Math.round((asUtc - dateValue.getTime()) / 60_000);
}

export function createTimeZoneDate(date: string, hour: number, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const utcGuess = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hour, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcGuess, timeZone);

  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}

function getWeekdayKey(date: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short"
  }).format(new Date(`${date}T12:00:00.000Z`)).toLowerCase();
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}

function formatHourLabel(dateValue: Date, timeZone: string): string {
  return dateValue.toLocaleTimeString("en-US", {
    timeZone,
    hour: "numeric",
    minute: "2-digit"
  });
}

function getEstimatedJobDurationMinutes(job: JobDetail): number {
  if (job.scheduledDurationMinutes && job.scheduledDurationMinutes > 0) {
    return job.scheduledDurationMinutes;
  }

  if (job.scheduledStart && job.scheduledEnd) {
    return Math.max(DEFAULT_JOB_DURATION_MINUTES, minutesBetween(job.scheduledStart, job.scheduledEnd));
  }

  switch (job.type) {
    case "maintenance":
      return 90;
    case "inspection":
    case "estimate_only":
      return 60;
    case "installation":
      return 240;
    case "warranty":
    case "callback":
      return 90;
    case "emergency":
      return 180;
    default:
      return DEFAULT_JOB_DURATION_MINUTES;
  }
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function buildJobSkillTokens(job: JobDetail): string[] {
  const tokens = new Set<string>();
  const typeHints = JOB_TYPE_SKILL_HINTS[job.type] ?? [];
  const assetType = job.asset?.assetType ? normalizeText(job.asset.assetType) : null;
  const combinedText = [
    job.title,
    job.description ?? "",
    job.type.replaceAll("_", " "),
    assetType ?? ""
  ].join(" ").toLowerCase();

  for (const hint of typeHints) {
    tokens.add(hint);
  }

  if (assetType) {
    tokens.add(assetType);
  }

  for (const knownToken of KNOWN_SKILL_TOKENS) {
    if (combinedText.includes(knownToken)) {
      tokens.add(knownToken);
    }
  }

  return Array.from(tokens);
}

function skillMatchesToken(skill: string, token: string): boolean {
  const normalizedSkill = normalizeText(skill);
  const normalizedToken = normalizeText(token);

  return normalizedSkill.includes(normalizedToken) || normalizedToken.includes(normalizedSkill);
}

export function calculateZipMatchScore(serviceZipCodes: string[] | null, jobZip: string | null): number {
  if (!jobZip) {
    return 0;
  }

  return (serviceZipCodes ?? []).includes(jobZip) ? 25 : 0;
}

function calculateTravelProximity(serviceZipCodes: string[] | null, jobZip: string | null): number {
  if (!jobZip) {
    return 0;
  }

  for (const zip of serviceZipCodes ?? []) {
    if (zip === jobZip) {
      return 2;
    }

    if (zip.slice(0, 3) === jobZip.slice(0, 3)) {
      return 1;
    }
  }

  return 0;
}

export function calculateSkillsMatchScore(technicianSkills: string[] | null, jobSkillTokens: string[]): number {
  if (!technicianSkills || technicianSkills.length === 0 || jobSkillTokens.length === 0) {
    return 0;
  }

  const matchedTokens = jobSkillTokens.filter((token) =>
    technicianSkills.some((skill) => skillMatchesToken(skill, token))
  );

  const ratio = matchedTokens.length / jobSkillTokens.length;
  return clampScore(ratio * 25);
}

export function calculateUtilizationScore(scheduledMinutes: number, availableMinutes: number): number {
  if (availableMinutes <= 0) {
    return 0;
  }

  const remainingCapacity = Math.max(0, 1 - scheduledMinutes / availableMinutes);
  return clampScore(remainingCapacity * 25);
}

function buildOpenSlots(date: string, timeZone: string, hoursAvailable: number, technicianJobs: JobRow[]): OpenSlot[] {
  const workdayStart = createTimeZoneDate(date, WORKDAY_START_HOUR, timeZone);
  const workdayEnd = new Date(workdayStart.getTime() + hoursAvailable * 60 * 60 * 1000);
  const sortedJobs = technicianJobs
    .filter((job) => job.scheduledStart && job.scheduledEnd)
    .slice()
    .sort((left, right) => (left.scheduledStart?.getTime() ?? 0) - (right.scheduledStart?.getTime() ?? 0));
  const slots: OpenSlot[] = [];
  let cursor = workdayStart;

  if (sortedJobs.length === 0) {
    return [{
      scheduledStart: workdayStart.toISOString(),
      scheduledEnd: workdayEnd.toISOString(),
      durationMinutes: minutesBetween(workdayStart, workdayEnd),
      wasteMinutes: 0
    }];
  }

  for (const job of sortedJobs) {
    if (!job.scheduledStart || !job.scheduledEnd) {
      continue;
    }

    const jobStart = job.scheduledStart < workdayStart ? workdayStart : job.scheduledStart;
    const jobEnd = job.scheduledEnd > workdayEnd ? workdayEnd : job.scheduledEnd;

    if (jobStart.getTime() > cursor.getTime()) {
      slots.push({
        scheduledStart: cursor.toISOString(),
        scheduledEnd: jobStart.toISOString(),
        durationMinutes: minutesBetween(cursor, jobStart),
        wasteMinutes: 0
      });
    }

    if (jobEnd.getTime() > cursor.getTime()) {
      cursor = jobEnd;
    }
  }

  if (cursor.getTime() < workdayEnd.getTime()) {
    slots.push({
      scheduledStart: cursor.toISOString(),
      scheduledEnd: workdayEnd.toISOString(),
      durationMinutes: minutesBetween(cursor, workdayEnd),
      wasteMinutes: 0
    });
  }

  return slots;
}

function findBestOpenSlot(slots: OpenSlot[], jobDurationMinutes: number): OpenSlot | null {
  const viableSlots = slots
    .filter((slot) => slot.durationMinutes >= jobDurationMinutes)
    .map((slot) => ({
      ...slot,
      wasteMinutes: Math.max(0, slot.durationMinutes - jobDurationMinutes)
    }));

  if (viableSlots.length === 0) {
    return null;
  }

  return viableSlots.sort((left, right) => {
    if (left.wasteMinutes !== right.wasteMinutes) {
      return left.wasteMinutes - right.wasteMinutes;
    }

    return new Date(left.scheduledStart).getTime() - new Date(right.scheduledStart).getTime();
  })[0] ?? null;
}

export function calculateGapFitScore(slot: Pick<OpenSlot, "durationMinutes"> | null, jobDurationMinutes: number): number {
  if (!slot || jobDurationMinutes <= 0 || slot.durationMinutes < jobDurationMinutes) {
    return 0;
  }

  if (slot.durationMinutes === jobDurationMinutes) {
    return 25;
  }

  const fitRatio = slot.durationMinutes / jobDurationMinutes;

  if (fitRatio >= 2) {
    return 10;
  }

  if (fitRatio <= 1.1) {
    return 23;
  }

  if (fitRatio <= 1.25) {
    return 20;
  }

  if (fitRatio <= 1.5) {
    return 17;
  }

  return 13;
}

function buildReasoningText(input: {
  technician: TechnicianRow;
  jobZip: string;
  scoreBreakdown: AutoFitScoreBreakdown;
  slot: OpenSlot;
  utilization: number;
  timeZone: string;
  travelProximity: number;
}): string {
  const parts: string[] = [];
  const startLabel = formatHourLabel(new Date(input.slot.scheduledStart), input.timeZone);
  const gapHours = Number((input.slot.durationMinutes / 60).toFixed(1));

  if (input.scoreBreakdown.zipMatch === 25) {
    parts.push("covers this zip");
  } else if (input.travelProximity > 0) {
    parts.push("already works nearby");
  } else {
    parts.push("would be traveling in from outside this area");
  }

  if (input.scoreBreakdown.skillsMatch >= 20) {
    parts.push("is a strong skill match");
  } else if (input.scoreBreakdown.skillsMatch > 0) {
    parts.push("has partial skill overlap");
  } else {
    parts.push("has limited skill overlap");
  }

  parts.push(`has a ${gapHours}h opening at ${startLabel}`);
  parts.push(`is at ${input.utilization}% utilization today`);

  return `${input.technician.firstName} ${parts.join(", ")}.`;
}

function isTechnicianAvailableOnDate(technician: TechnicianRow, date: string, timeZone: string): boolean {
  if (technician.status !== "active") {
    return false;
  }

  const availableDays = technician.availableDays ?? ["mon", "tue", "wed", "thu", "fri"];
  return availableDays.includes(getWeekdayKey(date, timeZone));
}

async function getCompanyRecord(companyId: string): Promise<CompanyRow> {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }

  return company;
}

function scoreTechnicianSuggestion(input: {
  technician: TechnicianRow;
  technicianJobs: JobRow[];
  job: JobDetail;
  jobDurationMinutes: number;
  jobZip: string;
  date: string;
  timeZone: string;
}): RankedSuggestion | null {
  const hoursAvailable = parseHoursPerDay(input.technician.hoursPerDay);
  const availableMinutes = hoursAvailable * 60;
  const scheduledMinutes = input.technicianJobs.reduce((sum, job) => {
    if (!job.scheduledStart || !job.scheduledEnd) {
      return sum;
    }

    return sum + minutesBetween(job.scheduledStart, job.scheduledEnd);
  }, 0);
  const utilization = availableMinutes <= 0
    ? 100
    : Math.min(100, Math.round((scheduledMinutes / availableMinutes) * 100));
  const slots = buildOpenSlots(input.date, input.timeZone, hoursAvailable, input.technicianJobs);
  const bestSlot = findBestOpenSlot(slots, input.jobDurationMinutes);

  if (!bestSlot) {
    return null;
  }

  const scoreBreakdown: AutoFitScoreBreakdown = {
    zipMatch: calculateZipMatchScore(input.technician.serviceZipCodes ?? [], input.jobZip),
    skillsMatch: calculateSkillsMatchScore(input.technician.skills ?? [], buildJobSkillTokens(input.job)),
    utilizationScore: calculateUtilizationScore(scheduledMinutes, availableMinutes),
    gapFitScore: calculateGapFitScore(bestSlot, input.jobDurationMinutes)
  };
  const score =
    scoreBreakdown.zipMatch +
    scoreBreakdown.skillsMatch +
    scoreBreakdown.utilizationScore +
    scoreBreakdown.gapFitScore;
  const travelProximity = calculateTravelProximity(input.technician.serviceZipCodes ?? [], input.jobZip);

  return {
    technicianId: input.technician.id,
    technicianName: `${input.technician.firstName} ${input.technician.lastName}`.trim(),
    scheduledStart: bestSlot.scheduledStart,
    scheduledEnd: new Date(new Date(bestSlot.scheduledStart).getTime() + input.jobDurationMinutes * 60_000).toISOString(),
    score,
    scoreBreakdown,
    reasoningText: buildReasoningText({
      technician: input.technician,
      jobZip: input.jobZip,
      scoreBreakdown,
      slot: bestSlot,
      utilization,
      timeZone: input.timeZone,
      travelProximity
    }),
    hiddenTieBreakers: {
      travelProximity,
      slotWasteMinutes: bestSlot.wasteMinutes,
      utilization
    }
  };
}

function compareSuggestions(left: RankedSuggestion, right: RankedSuggestion): number {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  if (right.hiddenTieBreakers.travelProximity !== left.hiddenTieBreakers.travelProximity) {
    return right.hiddenTieBreakers.travelProximity - left.hiddenTieBreakers.travelProximity;
  }

  if (left.hiddenTieBreakers.slotWasteMinutes !== right.hiddenTieBreakers.slotWasteMinutes) {
    return left.hiddenTieBreakers.slotWasteMinutes - right.hiddenTieBreakers.slotWasteMinutes;
  }

  if (left.hiddenTieBreakers.utilization !== right.hiddenTieBreakers.utilization) {
    return left.hiddenTieBreakers.utilization - right.hiddenTieBreakers.utilization;
  }

  return left.technicianName.localeCompare(right.technicianName);
}

export async function getAutoFitSuggestions(input: AutoFitInput): Promise<AutoFitResponse> {
  const normalizedDate = assertIsoDate(input.date);
  const [company, job, technicianRows, companyJobs] = await Promise.all([
    getCompanyRecord(input.companyId),
    getJob(input.companyId, input.jobId),
    db.select().from(technicians).where(and(eq(technicians.companyId, input.companyId), isNull(technicians.deletedAt))),
    db.select().from(jobs).where(and(eq(jobs.companyId, input.companyId), isNull(jobs.deletedAt)))
  ]);
  const timeZone = company.timezone?.trim() || DEFAULT_TIME_ZONE;
  const jobZip = job.property?.zip?.trim() ?? null;

  if (!jobZip) {
    return {
      suggestions: [],
      message: "This job is missing a property ZIP code, so auto-fit cannot rank technicians yet."
    };
  }

  const availableTechnicians = technicianRows.filter((technician) =>
    isTechnicianAvailableOnDate(technician, normalizedDate, timeZone)
  );

  if (availableTechnicians.length === 0) {
    return {
      suggestions: [],
      message: "No active technicians are available on that date."
    };
  }

  const dayStart = createTimeZoneDate(normalizedDate, 0, timeZone);
  const nextDayStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const companyDayJobs = companyJobs.filter((scheduledJob) => {
    if (!scheduledJob.technicianId || !scheduledJob.scheduledStart || !scheduledJob.scheduledEnd) {
      return false;
    }

    if (CANCELLED_JOB_STATUSES.has(scheduledJob.status)) {
      return false;
    }

    return scheduledJob.scheduledStart.getTime() < nextDayStart.getTime() &&
      scheduledJob.scheduledEnd.getTime() > dayStart.getTime();
  });
  const jobsByTechnicianId = new Map<string, JobRow[]>();

  for (const scheduledJob of companyDayJobs) {
    const technicianJobs = jobsByTechnicianId.get(scheduledJob.technicianId as string) ?? [];
    technicianJobs.push(scheduledJob);
    jobsByTechnicianId.set(scheduledJob.technicianId as string, technicianJobs);
  }

  const jobDurationMinutes = getEstimatedJobDurationMinutes(job);
  const suggestions = availableTechnicians
    .map((technician) =>
      scoreTechnicianSuggestion({
        technician,
        technicianJobs: jobsByTechnicianId.get(technician.id) ?? [],
        job,
        jobDurationMinutes,
        jobZip,
        date: normalizedDate,
        timeZone
      })
    )
    .filter((suggestion): suggestion is RankedSuggestion => suggestion !== null)
    .sort(compareSuggestions)
    .slice(0, MAX_SUGGESTIONS)
    .map(({ hiddenTieBreakers: _hiddenTieBreakers, ...suggestion }) => suggestion);

  if (suggestions.length === 0) {
    return {
      suggestions: [],
      message: "No technician has an open gap large enough for this job on that date."
    };
  }

  return {
    suggestions,
    message: null
  };
}
