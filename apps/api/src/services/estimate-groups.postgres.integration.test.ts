import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  EstimateGroupsQuerySchema,
  EstimateGroupsResponseSchema,
} from "@fsm/types";
import { buildEstimateGroupsQuery } from "./estimate-groups.query.js";

const url = process.env.WORKFLOW_TEST_DATABASE_URL;
const company = randomUUID();
const otherCompany = randomUUID();
const customer = randomUUID();
const schema = `wf_groups_${randomUUID().replaceAll("-", "")}`;

describe.skipIf(!url)("group-safe estimates: actual PostgreSQL", () => {
  const connection = postgres(url ?? "postgres://localhost/unused", {
    max: 1,
    prepare: false,
  });
  const db = drizzle(connection);
  beforeAll(async () => {
    await connection.unsafe(
      `create schema "${schema}"; set search_path to "${schema}"`,
    );
    await connection.unsafe(`
      create table customers (id uuid primary key, company_id uuid not null,
        first_name text not null, last_name text not null, display_name text, deleted_at timestamp);
      create table estimates (id uuid primary key, company_id uuid not null, customer_id uuid not null,
        estimate_number text not null, title text, status text not null default 'draft', tier_label text,
        tier_group_id uuid, total numeric(10,2) default 0, subtotal numeric(10,2) default 0,
        created_at timestamp not null default '2026-11-05', sent_at timestamp, expires_at timestamp,
        approved_at timestamp, declined_at timestamp, deleted_at timestamp);
    `);
  });
  afterAll(async () => {
    await connection.unsafe(`drop schema if exists "${schema}" cascade`);
    await connection.end();
  });
  beforeEach(async () => {
    await connection`truncate estimates, customers`;
    await connection`insert into customers values (${customer}, ${company}, 'Dana', 'Whitfield', 'Summit Test', null)`;
  });
  async function row(
    input: {
      id?: string;
      tenant?: string;
      customerId?: string;
      number?: string;
      title?: string;
      status?: string;
      group?: string;
      tier?: string;
      total?: string;
      created?: string;
      deleted?: boolean;
    } = {},
  ) {
    const id = input.id ?? randomUUID();
    await connection`insert into estimates (id,company_id,customer_id,estimate_number,title,status,tier_group_id,tier_label,total,subtotal,created_at,deleted_at)
      values (${id},${input.tenant ?? company},${input.customerId ?? customer},${input.number ?? id},${input.title ?? "Repair"},
        ${input.status ?? "sent"},${input.group ?? null},${input.tier ?? null},${input.total ?? "100.00"},${input.total ?? "100.00"},
        ${input.created ?? "2026-11-05T12:00:00Z"},${input.deleted ? "2026-11-05T13:00:00Z" : null})`;
    return id;
  }
  async function list(input: Record<string, unknown> = {}, tenant = company) {
    const result = await db.execute<{ payload: unknown }>(
      buildEstimateGroupsQuery(tenant, EstimateGroupsQuerySchema.parse(input)),
    );
    return EstimateGroupsResponseSchema.parse(result[0]?.payload);
  }
  it("keeps all options together across raw-row page boundaries", async () => {
    for (let i = 0; i < 26; i++) {
      const group = randomUUID();
      for (const tier of ["Good", "Better", "Best"]) await row({ group, tier });
    }
    const a = await list(),
      b = await list({ page: 2 });
    expect(a.total).toBe(26);
    expect(a.data).toHaveLength(25);
    expect(b.data).toHaveLength(1);
    for (const item of [...a.data, ...b.data]) {
      expect(item.tierCount).toBe(3);
      expect(item.estimateIds).toHaveLength(3);
    }
    expect(new Set([...a.data, ...b.data].map((x) => x.id)).size).toBe(26);
  });
  it("finds older records beyond the former 10,000-row window", async () => {
    await connection`insert into estimates (id,company_id,customer_id,estimate_number,title,status,created_at)
      select gen_random_uuid(),${company}::uuid,${customer}::uuid,'RECENT-' || n,'Recent','draft','2026-11-05'::timestamp
      from generate_series(1,10001) n`;
    const old = await row({
      number: "OLD-NEEDLE",
      created: "2019-01-01T00:00:00Z",
    });
    const result = await list({ search: "old-needle" });
    expect(result.total).toBe(1);
    expect(result.data[0]?.estimateId).toBe(old);
  });
  it("searches full customer names and business display names", async () => {
    await row();
    expect((await list({ search: "dana whitfield" })).total).toBe(1);
    expect((await list({ search: "summit test" })).total).toBe(1);
  });
  it("retains the complete group when only one alternative matches", async () => {
    const group = randomUUID();
    await row({ group, tier: "Good", title: "Plain" });
    await row({ group, tier: "Better", title: "Plain" });
    const best = await row({ group, tier: "Best", title: "Unique component" });
    const result = await list({ search: "unique component" });
    expect(result.total).toBe(1);
    expect(result.data[0]?.tierCount).toBe(3);
    expect(result.data[0]?.estimateIds).toContain(best);
  });
  it("uses the selected option total, never the sum of alternatives", async () => {
    const group = randomUUID();
    await row({ group, tier: "Good", total: "100.10" });
    await row({ group, tier: "Better", total: "200.20" });
    const chosen = await row({
      group,
      tier: "Best",
      status: "approved",
      total: "300.30",
    });
    const result = await list();
    expect(result.data[0]).toMatchObject({
      estimateId: chosen,
      total: "300.30",
      subtotal: "300.30",
      status: "approved",
    });
  });
  it("includes viewed groups in Sent without including mixed approved groups", async () => {
    await row({ status: "viewed" });
    const group = randomUUID();
    await row({ group, status: "sent" });
    await row({ group, status: "approved" });
    const sent = await list({ status: "sent" });
    expect(sent.total).toBe(1);
    expect(sent.data[0]?.status).toBe("viewed");
    expect((await list({ status: "approved" })).total).toBe(1);
  });
  it("excludes other tenants, cross-tenant customer pointers, and deleted customers before counting", async () => {
    const other = randomUUID(),
      deleted = randomUUID();
    await connection`insert into customers values (${other},${otherCompany},'Other','Tenant',null,null),
      (${deleted},${company},'Deleted','Customer',null,'2026-01-01')`;
    await row();
    await row({ tenant: otherCompany, customerId: other });
    await row({ customerId: other });
    await row({ customerId: deleted });
    await row({ deleted: true });
    const result = await list();
    expect(result.total).toBe(1);
    expect(result.data).toHaveLength(1);
    expect((await list({}, otherCompany)).total).toBe(1);
  });
  it("does not combine a corrupt group shared by two customers", async () => {
    const second = randomUUID(),
      group = randomUUID();
    await connection`insert into customers values (${second},${company},'Second','Customer',null,null)`;
    await row({ group });
    await row({ group, customerId: second });
    expect((await list()).total).toBe(2);
  });
  it("uses stable identity ordering when creation times tie", async () => {
    for (let i = 0; i < 7; i++) await row();
    const a = await list({ limit: 3 }),
      b = await list({ limit: 3, page: 2 }),
      repeat = await list({ limit: 3 });
    expect(a.data.map((x) => x.id)).toEqual(repeat.data.map((x) => x.id));
    expect(new Set([...a.data, ...b.data].map((x) => x.id)).size).toBe(6);
  });
  it("treats wildcard and SQL-looking input as literal search text", async () => {
    await row({ title: "100% repair_under" });
    await row({ title: "Ordinary repair" });
    expect((await list({ search: "%" })).total).toBe(1);
    expect((await list({ search: "_" })).total).toBe(1);
    expect((await list({ search: "' OR TRUE --" })).total).toBe(0);
  });
  it("returns accurate counts on empty and out-of-range pages", async () => {
    expect(await list()).toMatchObject({ data: [], total: 0, totalPages: 0 });
    await row();
    expect(await list({ page: 5 })).toMatchObject({
      data: [],
      total: 1,
      totalPages: 1,
      page: 5,
    });
  });
  it("separates single-estimate IDs from group IDs", async () => {
    const id = randomUUID();
    await row({ id });
    await row({ group: id });
    expect((await list()).total).toBe(2);
  });
});
