import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DispatchWeekJobSchema } from "@fsm/types";
import {
  buildDispatchWeekCalendar,
  weekJobOverlaps,
} from "./dispatch-week.calendar.js";
import {
  buildDispatchWeekJobsQuery,
  MAX_DISPATCH_WEEK_JOBS,
} from "./dispatch-week.query.js";

const url = process.env.WORKFLOW_TEST_DATABASE_URL;
const company = randomUUID(),
  other = randomUUID(),
  customer = randomUUID(),
  tech = randomUUID(),
  inactive = randomUUID(),
  property = randomUUID();
const schema = `wf_week_${randomUUID().replaceAll("-", "")}`;
const calendar = buildDispatchWeekCalendar(
  "America/Chicago",
  "2026-11-05",
  new Date("2026-11-05T12:00:00Z"),
);
describe.skipIf(!url)("weekly dispatch actual PostgreSQL range read", () => {
  const connection = postgres(url ?? "postgres://localhost/unused", {
      max: 1,
      prepare: false,
    }),
    db = drizzle(connection);
  beforeAll(async () => {
    await connection.unsafe(
      `create schema "${schema}";set search_path to "${schema}"`,
    );
    await connection.unsafe(`
      create table customers(id uuid primary key,company_id uuid,first_name text,last_name text,display_name text,deleted_at timestamp);
      create table technicians(id uuid primary key,company_id uuid,first_name text,last_name text,status text,deleted_at timestamp);
      create table properties(id uuid primary key,company_id uuid,address_line_1 text,city text,deleted_at timestamp);
      create table jobs(id uuid primary key,company_id uuid,customer_id uuid,technician_id uuid,property_id uuid,job_number text,title text,status text,
        scheduled_start timestamp,scheduled_end timestamp,deleted_at timestamp);
    `);
    await connection`insert into customers values(${customer},${company},'Dana','Test',null,null)`;
    await connection`insert into technicians values(${tech},${company},'Marco','Test','active',null),(${inactive},${company},'Former','Tech','inactive',null)`;
    await connection`insert into properties values(${property},${company},'100 Test St','Test City',null)`;
  });
  afterAll(async () => {
    await connection.unsafe(`drop schema "${schema}" cascade`);
    await connection.end();
  });
  beforeEach(async () => {
    await connection`truncate jobs`;
  });
  async function row(
    input: {
      tenant?: string;
      start?: string | null;
      end?: string | null;
      technician?: string | null;
      status?: string;
      deleted?: boolean;
      customerId?: string;
      propertyId?: string;
    } = {},
  ) {
    const id = randomUUID();
    await connection`insert into jobs values(${id},${input.tenant ?? company},${input.customerId ?? customer},${input.technician === undefined ? tech : input.technician},${input.propertyId ?? property},${id},'Repair',${input.status ?? "scheduled"},
      ${input.start === undefined ? "2026-11-05T14:00:00Z" : input.start},${input.end === undefined ? "2026-11-05T15:00:00Z" : input.end},${input.deleted ? "2026-11-05T16:00:00Z" : null})`;
    return id;
  }
  async function read(technician = "all", tenant = company) {
    const rows = await db.execute<{ payload: unknown }>(
      buildDispatchWeekJobsQuery(
        tenant,
        calendar.rangeStart,
        calendar.rangeEndExclusive,
        technician,
      ),
    );
    return rows.map((r) => DispatchWeekJobSchema.parse(r.payload));
  }
  it("includes a job crossing into the week and excludes the exact outside boundaries", async () => {
    const overnight = await row({
      start: "2026-11-02T05:00:00Z",
      end: "2026-11-02T07:00:00Z",
    });
    await row({ start: "2026-11-02T04:00:00Z", end: calendar.rangeStart });
    await row({
      start: calendar.rangeEndExclusive,
      end: "2026-11-09T08:00:00Z",
    });
    expect((await read()).map((j) => j.id)).toEqual([overnight]);
  });
  it("excludes other tenants, deleted jobs, cancelled jobs, and unscheduled work", async () => {
    const valid = await row();
    await row({ tenant: other });
    await row({ deleted: true });
    await row({ status: "cancelled" });
    await row({ start: null });
    expect((await read()).map((j) => j.id)).toEqual([valid]);
  });
  it("keeps completed, paid, and inactive-technician jobs visible", async () => {
    await row({ status: "completed" });
    await row({ status: "paid", technician: inactive });
    const jobs = await read();
    expect(jobs).toHaveLength(2);
    expect(jobs.find((x) => x.status === "paid")?.assignmentState).toBe(
      "inactive",
    );
  });
  it("filters technicians and unassigned work without duplicate rows", async () => {
    const a = await row(),
      b = await row({ technician: null });
    await row({ technician: inactive });
    expect((await read(tech)).map((j) => j.id)).toEqual([a]);
    expect((await read("unassigned")).map((j) => j.id)).toEqual([b]);
  });
  it("keeps missing and reversed ends explicit instead of inventing durations", async () => {
    await row({ end: null });
    await row({ end: "2026-11-05T13:00:00Z" });
    const rows = await read();
    expect(rows.map((j) => j.timingWarning).sort()).toEqual([
      "invalid_end",
      "missing_end",
    ]);
    for (const job of rows)
      expect(
        calendar.days.filter((d) =>
          weekJobOverlaps(job, d.start, d.endExclusive),
        ),
      ).toHaveLength(1);
  });
  it("does not disclose joined customer, technician, or property data from another tenant", async () => {
    const c = randomUUID(),
      t = randomUUID(),
      p = randomUUID();
    await connection`insert into customers values(${c},${other},'SECRET','CUSTOMER',null,null)`;
    await connection`insert into technicians values(${t},${other},'SECRET','TECH','active',null)`;
    await connection`insert into properties values(${p},${other},'SECRET ADDRESS','SECRET CITY',null)`;
    await row({ customerId: c, technician: t, propertyId: p });
    const jobs = await read();
    expect(jobs[0]).toMatchObject({
      customerName: null,
      technicianName: null,
      technicianId: null,
      address: null,
      assignmentState: "unavailable",
    });
    expect(JSON.stringify(jobs)).not.toContain("SECRET");
    expect(await read("unassigned")).toHaveLength(1);
  });
  it("returns a multi-day job once, with separate day membership", async () => {
    await row({ start: "2026-11-03T05:00:00Z", end: "2026-11-03T07:00:00Z" });
    const jobs = await read();
    expect(jobs).toHaveLength(1);
    expect(
      calendar.days
        .filter((d) => weekJobOverlaps(jobs[0]!, d.start, d.endExclusive))
        .map((d) => d.date),
    ).toEqual(["2026-11-02", "2026-11-03"]);
  });
  it("returns the overflow sentinel so the service can fail explicitly rather than truncate", async () => {
    await connection`insert into jobs(id,company_id,customer_id,job_number,title,status,scheduled_start,scheduled_end)
      select gen_random_uuid(),${company}::uuid,${customer}::uuid,'LOAD-'||n,'Load fixture','scheduled','2026-11-05 14:00'::timestamp,'2026-11-05 15:00'::timestamp from generate_series(1,${MAX_DISPATCH_WEEK_JOBS + 2}) n`;
    expect(await read()).toHaveLength(MAX_DISPATCH_WEEK_JOBS + 1);
  });
});
