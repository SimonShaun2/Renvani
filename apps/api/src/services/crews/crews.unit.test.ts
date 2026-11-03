import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  companyIds: [] as string[],
  insertError: null as unknown
}));
vi.mock("@fsm/config", () => ({ env: { DRIVE_TIME_ESTIMATOR: "straight_line", DRIVE_TIME_ASSUMED_SPEED_MPH: 30 } }));
vi.mock("@fsm/db", () => {
  const next = async () => state.queue.shift() ?? [];
  const chain: Record<string, unknown> = {};
  for (const key of ["select", "from", "where", "leftJoin", "orderBy", "update", "set", "insert"]) chain[key] = () => chain;
  chain.limit = next;
  chain.returning = next;
  chain.values = () => {
    if (state.insertError) throw state.insertError;
    return chain;
  };
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => next().then(resolve, reject);
  const col = (name: string) => ({ name });
  const table = new Proxy({}, { get: (_t, prop) => col(String(prop)) });
  return {
    companies: table, crewMembers: table, crews: table, jobs: table, properties: table, technicians: table,
    runTransactionWithTenantSession: async (companyId: string, cb: (tx: unknown) => unknown) => {
      state.companyIds.push(companyId);
      return cb(chain);
    }
  };
});
vi.mock("drizzle-orm", () => {
  const f = () => ({});
  return { and: f, asc: f, eq: f, gte: f, inArray: f, isNull: f, lt: f, sql: Object.assign(() => ({}), { raw: f }) };
});
vi.mock("../dispatch-intelligence.service.js", () => ({ createTimeZoneDate: () => new Date("2026-10-28T05:00:00Z") }));

import { isCrewMemberRole, listCrewMemberRoles, registerCrewMemberRole } from "./crew-roles.registry.js";
import { createCrew, getTechnicianDriveTime, replaceCrewMembers, updateCrew } from "./crews.service.js";
import {
  clampDriveSpeedMph,
  createStraightLineEstimator,
  getDriveTimeEstimator,
  haversineMiles,
  registerDriveTimeEstimator,
  resolveDriveTimeEstimator
} from "./drive-time.registry.js";

const companyId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const crewId = "11111111-1111-4111-8111-111111111111";
const techId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  state.queue = [];
  state.companyIds = [];
  state.insertError = null;
});

describe("drive-time registry", () => {
  it("haversine + clamp + straight-line estimate", () => {
    expect(haversineMiles({ lat: 41.8781, lng: -87.6298 }, { lat: 41.9742, lng: -87.9073 })).toBeCloseTo(15.73, 1);
    expect(clampDriveSpeedMph(1)).toBe(5);
    expect(clampDriveSpeedMph(200)).toBe(80);
    expect(clampDriveSpeedMph(Number.NaN)).toBe(30);
    const est = createStraightLineEstimator(30).estimate({ lat: 0, lng: 0 }, { lat: 0, lng: 0 });
    expect(est).toMatchObject({ minutes: 0, method: "straight_line_estimate", confidence: "low" });
  });
  it("resolves default from config, supports register/override, rejects unknown", () => {
    expect(resolveDriveTimeEstimator({ DRIVE_TIME_ESTIMATOR: "straight_line", DRIVE_TIME_ASSUMED_SPEED_MPH: 30 }).id).toBe("straight_line");
    expect(() => resolveDriveTimeEstimator({ DRIVE_TIME_ESTIMATOR: "mapbox", DRIVE_TIME_ASSUMED_SPEED_MPH: 30 })).toThrow(/UNKNOWN/);
    const custom = { ...createStraightLineEstimator(60), id: "custom_eta" };
    registerDriveTimeEstimator(custom);
    expect(getDriveTimeEstimator("custom_eta")).toBe(custom);
    expect(() => registerDriveTimeEstimator({ ...custom, id: "Bad Id" })).toThrow();
  });
});

describe("crew role registry", () => {
  it("has lead/member, allows registering, rejects bad ids", () => {
    expect(isCrewMemberRole("lead")).toBe(true);
    expect(isCrewMemberRole("helper")).toBe(false);
    registerCrewMemberRole("helper");
    expect(listCrewMemberRoles()).toContain("helper");
    expect(() => registerCrewMemberRole("Bad Role")).toThrow();
  });
});

describe("crews service", () => {
  it("rejects unknown roles and duplicate members before touching the DB", async () => {
    await expect(createCrew(companyId, { name: "A", members: [{ technicianId: techId, role: "boss" }] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(createCrew(companyId, { name: "A", members: [{ technicianId: techId, role: "member" }, { technicianId: techId, role: "lead" }] }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.companyIds).toEqual([]);
  });

  it("maps unique violations on create to CONFLICT", async () => {
    state.insertError = Object.assign(new Error("dup"), { code: "23505" });
    await expect(createCrew(companyId, { name: "A" })).rejects.toMatchObject({ code: "CONFLICT" });
    expect(state.companyIds).toEqual([companyId]);
  });

  it("rejects members from another tenant", async () => {
    state.queue.push([]); // technicians lookup returns nothing in this tenant
    await expect(replaceCrewMembers(companyId, crewId, { expectedVersion: 1, members: [{ technicianId: techId, role: "member" }] }))
      .rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("stale expectedVersion → CONFLICT; missing crew → NOT_FOUND", async () => {
    state.queue.push([], [{ id: crewId, name: "A", color: null, isActive: true, version: 3 }], []);
    await expect(updateCrew(companyId, crewId, { expectedVersion: 1, name: "B" })).rejects.toMatchObject({ code: "CONFLICT" });
    state.queue.push([], []);
    await expect(updateCrew(companyId, crewId, { expectedVersion: 1 })).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("drive-time: legs between consecutive non-cancelled jobs, unavailable without coordinates", async () => {
    state.queue.push(
      [{ id: techId }],
      [{ timezone: "America/Chicago" }],
      [
        { jobId: "j1", status: "scheduled", lat: "41.8781000", lng: "-87.6298000" },
        { jobId: "jx", status: "cancelled", lat: null, lng: null },
        { jobId: "j2", status: "scheduled", lat: "41.9742000", lng: "-87.9073000" },
        { jobId: "j3", status: "scheduled", lat: null, lng: null }
      ]
    );
    const result = await getTechnicianDriveTime(companyId, techId, "2026-10-28");
    expect(state.companyIds).toEqual([companyId]);
    expect(result.legs).toHaveLength(2);
    expect(result.legs[0]).toMatchObject({ fromJobId: "j1", toJobId: "j2", status: "estimated", minutes: 41 });
    expect(result.legs[1]).toMatchObject({ fromJobId: "j2", toJobId: "j3", status: "unavailable", minutes: null, unavailableReason: "missing_coordinates" });
    expect(result.totalMinutes).toBe(41);
  });

  it("drive-time: unknown technician → NOT_FOUND", async () => {
    state.queue.push([]);
    await expect(getTechnicianDriveTime(companyId, techId, "2026-10-28")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
