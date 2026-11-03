import { and, asc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";

import { env } from "@fsm/config";
import { companies, crewMembers, crews, jobs, properties, runTransactionWithTenantSession, technicians } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import { createTimeZoneDate } from "../dispatch-intelligence.service.js";
import { isCrewMemberRole } from "./crew-roles.registry.js";
import { resolveDriveTimeEstimator } from "./drive-time.registry.js";

export type CrewMemberView = { technicianId: string; role: string };
export type CrewView = {
  id: string;
  name: string;
  color: string | null;
  isActive: boolean;
  version: number;
  members: CrewMemberView[];
};

type Tx = Parameters<Parameters<typeof runTransactionWithTenantSession>[1]>[0];

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

async function loadCrews(tx: Tx, companyId: string, crewIds?: string[]): Promise<CrewView[]> {
  const crewRows = await tx
    .select({ id: crews.id, name: crews.name, color: crews.color, isActive: crews.isActive, version: crews.version })
    .from(crews)
    .where(and(eq(crews.companyId, companyId), isNull(crews.deletedAt), crewIds ? inArray(crews.id, crewIds) : undefined))
    .orderBy(asc(crews.name));
  if (crewRows.length === 0) return [];
  const memberRows = await tx
    .select({ crewId: crewMembers.crewId, technicianId: crewMembers.technicianId, role: crewMembers.role })
    .from(crewMembers)
    .where(and(eq(crewMembers.companyId, companyId), isNull(crewMembers.deletedAt), inArray(crewMembers.crewId, crewRows.map((c) => c.id))));
  return crewRows.map((crew) => ({
    ...crew,
    members: memberRows.filter((m) => m.crewId === crew.id).map(({ technicianId, role }) => ({ technicianId, role }))
  }));
}

async function requireCrew(tx: Tx, companyId: string, crewId: string): Promise<CrewView> {
  const [crew] = await loadCrews(tx, companyId, [crewId]);
  if (!crew) throw new AppError(ErrorCode.NOT_FOUND, "Crew not found");
  return crew;
}

/** Validates an active tenant crew inside the caller's transaction (job create). */
export async function assertActiveCrewInTransaction(tx: Tx, companyId: string, crewId: string): Promise<void> {
  const crew = await requireCrew(tx, companyId, crewId);
  if (!crew.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, "Crew is inactive");
}

/** Bumps the crew version iff it still matches `expectedVersion` (optimistic concurrency / idempotency guard). */
async function bumpVersion(tx: Tx, companyId: string, crewId: string, expectedVersion: number, patch: Partial<typeof crews.$inferInsert> = {}): Promise<void> {
  const updated = await tx
    .update(crews)
    .set({ ...patch, version: sql`${crews.version} + 1`, updatedAt: new Date() })
    .where(and(eq(crews.id, crewId), eq(crews.companyId, companyId), isNull(crews.deletedAt), eq(crews.version, expectedVersion)))
    .returning({ id: crews.id });
  if (updated.length === 0) {
    await requireCrew(tx, companyId, crewId);
    throw new AppError(ErrorCode.CONFLICT, "Crew was changed by someone else; reload and retry");
  }
}

async function assertTechniciansInTenant(tx: Tx, companyId: string, technicianIds: string[]): Promise<void> {
  if (technicianIds.length === 0) return;
  const rows = await tx
    .select({ id: technicians.id })
    .from(technicians)
    .where(and(eq(technicians.companyId, companyId), isNull(technicians.deletedAt), inArray(technicians.id, technicianIds)));
  if (rows.length !== new Set(technicianIds).size) throw new AppError(ErrorCode.VALIDATION_ERROR, "Unknown technician in members");
}

function assertMembers(members: CrewMemberView[]): void {
  const ids = new Set<string>();
  for (const member of members) {
    if (!isCrewMemberRole(member.role)) throw new AppError(ErrorCode.VALIDATION_ERROR, `Unknown crew member role: ${member.role}`);
    if (ids.has(member.technicianId)) throw new AppError(ErrorCode.VALIDATION_ERROR, "Duplicate technician in members");
    ids.add(member.technicianId);
  }
}

async function replaceMembers(tx: Tx, companyId: string, crewId: string, members: CrewMemberView[]): Promise<void> {
  await tx
    .update(crewMembers)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(crewMembers.companyId, companyId), eq(crewMembers.crewId, crewId), isNull(crewMembers.deletedAt)));
  if (members.length > 0) {
    await tx.insert(crewMembers).values(members.map((m) => ({ companyId, crewId, technicianId: m.technicianId, role: m.role })));
  }
}

export async function listCrews(companyId: string): Promise<CrewView[]> {
  return runTransactionWithTenantSession(companyId, (tx) => loadCrews(tx, companyId));
}

export async function createCrew(
  companyId: string,
  input: { name: string; color?: string | null | undefined; members?: CrewMemberView[] | undefined }
): Promise<CrewView> {
  const members = input.members ?? [];
  assertMembers(members);
  try {
    return await runTransactionWithTenantSession(companyId, async (tx) => {
      await assertTechniciansInTenant(tx, companyId, members.map((m) => m.technicianId));
      const [row] = await tx
        .insert(crews)
        .values({ companyId, name: input.name, color: input.color ?? null })
        .returning({ id: crews.id });
      await replaceMembers(tx, companyId, row!.id, members);
      return requireCrew(tx, companyId, row!.id);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(ErrorCode.CONFLICT, "A crew with this name already exists");
    throw error;
  }
}

export async function updateCrew(
  companyId: string,
  crewId: string,
  input: { expectedVersion: number; name?: string | undefined; color?: string | null | undefined; isActive?: boolean | undefined }
): Promise<CrewView> {
  try {
    return await runTransactionWithTenantSession(companyId, async (tx) => {
      await bumpVersion(tx, companyId, crewId, input.expectedVersion, {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      });
      return requireCrew(tx, companyId, crewId);
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError(ErrorCode.CONFLICT, "A crew with this name already exists");
    throw error;
  }
}

export async function replaceCrewMembers(
  companyId: string,
  crewId: string,
  input: { expectedVersion: number; members: CrewMemberView[] }
): Promise<CrewView> {
  assertMembers(input.members);
  return runTransactionWithTenantSession(companyId, async (tx) => {
    await assertTechniciansInTenant(tx, companyId, input.members.map((m) => m.technicianId));
    await bumpVersion(tx, companyId, crewId, input.expectedVersion);
    await replaceMembers(tx, companyId, crewId, input.members);
    return requireCrew(tx, companyId, crewId);
  });
}

export async function deleteCrew(companyId: string, crewId: string, expectedVersion: number): Promise<void> {
  await runTransactionWithTenantSession(companyId, async (tx) => {
    await bumpVersion(tx, companyId, crewId, expectedVersion, { deletedAt: new Date(), isActive: false });
    await replaceMembers(tx, companyId, crewId, []);
    await tx
      .update(jobs)
      .set({ crewId: null, updatedAt: new Date() })
      .where(and(eq(jobs.companyId, companyId), eq(jobs.crewId, crewId)));
  });
}

/** Idempotent: setting the same crew again is a no-op success. `crewId: null` clears it. */
export async function assignJobCrew(companyId: string, jobId: string, crewId: string | null): Promise<{ jobId: string; crewId: string | null }> {
  return runTransactionWithTenantSession(companyId, async (tx) => {
    if (crewId) {
      const crew = await requireCrew(tx, companyId, crewId);
      if (!crew.isActive) throw new AppError(ErrorCode.VALIDATION_ERROR, "Crew is inactive");
    }
    const updated = await tx
      .update(jobs)
      .set({ crewId, updatedAt: new Date() })
      .where(and(eq(jobs.id, jobId), eq(jobs.companyId, companyId), isNull(jobs.deletedAt)))
      .returning({ id: jobs.id, crewId: jobs.crewId });
    if (updated.length === 0) throw new AppError(ErrorCode.NOT_FOUND, "Job not found");
    return { jobId: updated[0]!.id, crewId: updated[0]!.crewId };
  });
}

export type DriveTimeLeg = {
  fromJobId: string;
  toJobId: string;
  status: "estimated" | "unavailable";
  minutes: number | null;
  distanceMiles: number | null;
  unavailableReason: "missing_coordinates" | null;
};
export type TechnicianDriveTime = {
  technicianId: string;
  date: string;
  estimator: string;
  method: string;
  confidence: string;
  totalMinutes: number;
  legs: DriveTimeLeg[];
};

function toPoint(lat: string | null, lng: string | null): { lat: number; lng: number } | null {
  if (lat === null || lng === null) return null;
  const point = { lat: Number(lat), lng: Number(lng) };
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180
    ? point
    : null;
}

/** Drive-time between a technician's consecutive scheduled jobs on `date` (company time zone). Never guesses coordinates. */
export async function getTechnicianDriveTime(companyId: string, technicianId: string, date: string): Promise<TechnicianDriveTime> {
  const estimator = resolveDriveTimeEstimator(env);
  const rows = await runTransactionWithTenantSession(companyId, async (tx) => {
    const [tech] = await tx
      .select({ id: technicians.id })
      .from(technicians)
      .where(and(eq(technicians.id, technicianId), eq(technicians.companyId, companyId), isNull(technicians.deletedAt)))
      .limit(1);
    if (!tech) throw new AppError(ErrorCode.NOT_FOUND, "Technician not found");
    const [company] = await tx.select({ timezone: companies.timezone }).from(companies).where(eq(companies.id, companyId)).limit(1);
    const timeZone = company?.timezone?.trim() || "America/Chicago";
    const dayStart = createTimeZoneDate(date, 0, timeZone);
    const nextDay = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    return tx
      .select({ jobId: jobs.id, status: jobs.status, lat: properties.lat, lng: properties.lng })
      .from(jobs)
      .leftJoin(properties, and(eq(properties.id, jobs.propertyId), eq(properties.companyId, companyId)))
      .where(and(
        eq(jobs.companyId, companyId),
        eq(jobs.technicianId, technicianId),
        isNull(jobs.deletedAt),
        gte(jobs.scheduledStart, dayStart),
        lt(jobs.scheduledStart, nextDay)
      ))
      .orderBy(asc(jobs.scheduledStart))
      .limit(100);
  });

  const stops = rows.filter((row) => row.status !== "cancelled");
  const legs: DriveTimeLeg[] = [];
  for (let index = 1; index < stops.length; index += 1) {
    const from = stops[index - 1]!;
    const to = stops[index]!;
    const a = toPoint(from.lat, from.lng);
    const b = toPoint(to.lat, to.lng);
    if (!a || !b) {
      legs.push({ fromJobId: from.jobId, toJobId: to.jobId, status: "unavailable", minutes: null, distanceMiles: null, unavailableReason: "missing_coordinates" });
      continue;
    }
    const estimate = estimator.estimate(a, b);
    legs.push({ fromJobId: from.jobId, toJobId: to.jobId, status: "estimated", minutes: estimate.minutes, distanceMiles: estimate.distanceMiles, unavailableReason: null });
  }

  return {
    technicianId,
    date,
    estimator: estimator.id,
    method: estimator.method,
    confidence: estimator.confidence,
    totalMinutes: legs.reduce((sum, leg) => sum + (leg.minutes ?? 0), 0),
    legs
  };
}
