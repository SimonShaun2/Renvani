import { randomUUID } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetEnvCacheForTests } from "@fsm/config";
import { setupTestEnv } from "../test-support/env-setup.js";
import {
  EstimateGroupsQuerySchema,
  DispatchWeekQuerySchema,
  type UserRole,
} from "@fsm/types";

const url = process.env.WORKFLOW_FULL_DATABASE_URL;
setupTestEnv();
if (url) {
  vi.stubEnv("DATABASE_URL", url);
  vi.stubEnv("DATABASE_POOL_MAX", "4");
  resetEnvCacheForTests();
}
const company = randomUUID(),
  otherCompany = randomUUID(),
  owner = randomUUID(),
  otherOwner = randomUUID(),
  customer = randomUUID(),
  otherCustomer = randomUUID(),
  technician = randomUUID(),
  job = randomUUID(),
  estimate = randomUUID();
const ids = [company, otherCompany];
type Database = typeof import("@fsm/db");
let database: Database;
let groups: typeof import("./estimate-groups.service.js");
let week: typeof import("./dispatch-week.service.js");
let app: FastifyInstance;
const actors = new Map<
  string,
  { id: string; companyId: string; role: UserRole }
>();

describe.skipIf(!url)(
  "workflow reads against the complete migrated schema",
  () => {
    beforeAll(async () => {
      database = await import("@fsm/db");
      groups = await import("./estimate-groups.service.js");
      week = await import("./dispatch-week.service.js");
      await database.db.insert(database.companies).values([
        {
          id: company,
          name: "Workflow isolated A",
          slug: `wf-a-${company}`,
          timezone: "America/Chicago",
        },
        {
          id: otherCompany,
          name: "Workflow isolated B",
          slug: `wf-b-${otherCompany}`,
          timezone: "Pacific/Auckland",
        },
      ]);
      for (const role of [
        "owner",
        "admin",
        "dispatcher",
        "office",
        "technician",
      ] as const) {
        const id = role === "owner" ? owner : randomUUID();
        actors.set(role, { id, companyId: company, role });
        await database.db
          .insert(database.users)
          .values({
            id,
            companyId: company,
            email: `${id}@example.com`,
            firstName: "Workflow",
            lastName: role,
            role,
            isActive: true,
          });
      }
      await database.db
        .insert(database.users)
        .values({
          id: otherOwner,
          companyId: otherCompany,
          email: `${otherOwner}@example.com`,
          firstName: "Other",
          lastName: "Owner",
          role: "owner",
          isActive: true,
        });
      actors.set("other", {
        id: otherOwner,
        companyId: otherCompany,
        role: "owner",
      });
      await database.db.insert(database.customers).values([
        {
          id: customer,
          companyId: company,
          firstName: "Isolated",
          lastName: "Customer",
        },
        {
          id: otherCustomer,
          companyId: otherCompany,
          firstName: "Other",
          lastName: "Customer",
        },
      ]);
      await database.db
        .insert(database.technicians)
        .values({
          id: technician,
          companyId: company,
          firstName: "Workflow",
          lastName: "Tech",
          phone: "+15555550123",
        });
      await database.db
        .insert(database.jobs)
        .values({
          id: job,
          companyId: company,
          customerId: customer,
          technicianId: technician,
          jobNumber: `WF-${job.slice(0, 8)}`,
          title: "Workflow example",
          status: "scheduled",
          scheduledStart: new Date("2026-11-05T14:00:00Z"),
          scheduledEnd: new Date("2026-11-05T16:00:00Z"),
        });
      await database.db
        .insert(database.estimates)
        .values({
          id: estimate,
          companyId: company,
          customerId: customer,
          estimateNumber: `WF-${estimate.slice(0, 8)}`,
          status: "sent",
          title: "Workflow quote",
          subtotal: "100.10",
          total: "100.10",
        });
      app = Fastify();
      app.decorate("authenticate", async (request, reply) => {
        const value = request.headers["x-fixture-actor"];
        const actor = typeof value === "string" ? actors.get(value) : undefined;
        if (!actor) {
          await reply.code(401).send({ error: "UNAUTHORIZED" });
          return;
        }
        request.user = {
          id: actor.id,
          role: actor.role,
        } as typeof request.user;
        request.company = { id: actor.companyId } as typeof request.company;
      });
      app.setErrorHandler((error, request, reply) => {
        const e = error as Error & { code?: string };
        const status =
          e.code === "FORBIDDEN"
            ? 403
            : e.code === "NOT_FOUND"
              ? 404
              : e.code === "VALIDATION_ERROR" || e.name === "ZodError"
                ? 400
                : 500;
        void reply.code(status).send({ error: e.code ?? e.name });
      });
      const { estimateGroupRoutes } = await import(
        "../routes/estimates/groups.js"
      );
      const { dispatchWeekRoutes } = await import("../routes/dispatch/week.js");
      await app.register(estimateGroupRoutes, { prefix: "/api/v1/estimates" });
      await app.register(dispatchWeekRoutes, { prefix: "/api/v1" });
      await app.ready();
    });
    afterAll(async () => {
      if (app) await app.close();
      if (!database) return;
      await database.db
        .delete(database.estimates)
        .where(inArray(database.estimates.companyId, ids));
      await database.db
        .delete(database.jobs)
        .where(inArray(database.jobs.companyId, ids));
      await database.db
        .delete(database.technicians)
        .where(inArray(database.technicians.companyId, ids));
      await database.db
        .delete(database.customers)
        .where(inArray(database.customers.companyId, ids));
      await database.db
        .delete(database.users)
        .where(inArray(database.users.companyId, ids));
      await database.db
        .delete(database.companies)
        .where(inArray(database.companies.id, ids));
    });
    const paths = [
      "/api/v1/estimates/groups",
      "/api/v1/dispatch/week?date=2026-11-05",
    ];
    it.each(paths)("requires authentication for %s", async (path) => {
      expect((await app.inject({ url: path })).statusCode).toBe(401);
    });
    it.each(["owner", "admin", "dispatcher"])(
      "allows existing estimate staff role %s",
      async (role) => {
        const r = await app.inject({
          url: paths[0]!,
          headers: { "x-fixture-actor": role },
        });
        expect(r.statusCode).toBe(200);
        expect(r.json().data[0]).toMatchObject({
          estimateId: estimate,
          total: "100.10",
        });
      },
    );
    it.each(["office", "technician"])(
      "does not widen estimate permission to %s",
      async (role) => {
        expect(
          (
            await app.inject({
              url: paths[0]!,
              headers: { "x-fixture-actor": role },
            })
          ).statusCode,
        ).toBe(403);
      },
    );
    it.each(["owner", "admin", "dispatcher", "office"])(
      "allows weekly dispatch staff %s",
      async (role) => {
        const r = await app.inject({
          url: paths[1]!,
          headers: { "x-fixture-actor": role },
        });
        expect(r.statusCode).toBe(200);
        expect(r.json()).toMatchObject({
          timezone: "America/Chicago",
          uniqueJobCount: 1,
        });
        expect(r.json().jobs[0].id).toBe(job);
      },
    );
    it("denies a technician access to the office schedule", async () => {
      expect(
        (
          await app.inject({
            url: paths[1]!,
            headers: { "x-fixture-actor": "technician" },
          })
        ).statusCode,
      ).toBe(403);
    });
    it("separates actual company data and timezone", async () => {
      const g = await app.inject({
        url: paths[0]!,
        headers: { "x-fixture-actor": "other" },
      });
      const w = await app.inject({
        url: paths[1]!,
        headers: { "x-fixture-actor": "other" },
      });
      expect(g.json()).toMatchObject({ total: 0, data: [] });
      expect(w.json()).toMatchObject({
        timezone: "Pacific/Auckland",
        uniqueJobCount: 0,
      });
      expect(JSON.stringify([g.json(), w.json()])).not.toContain(job);
    });
    it.each([
      "/api/v1/estimates/groups?page=0",
      "/api/v1/estimates/groups?limit=101",
      "/api/v1/estimates/groups?companyId=other",
      "/api/v1/dispatch/week?date=2026-02-30",
      "/api/v1/dispatch/week?technician=bad",
      "/api/v1/dispatch/week?companyId=other",
    ])("rejects invalid or scope-changing query %s", async (path) => {
      expect(
        (
          await app.inject({
            url: path,
            headers: { "x-fixture-actor": "owner" },
          })
        ).statusCode,
      ).toBe(400);
    });
    it("hides foreign technician existence", async () => {
      const r = await app.inject({
        url: `/api/v1/dispatch/week?date=2026-11-05&technician=${technician}`,
        headers: { "x-fixture-actor": "other" },
      });
      expect(r.statusCode).toBe(404);
    });
    it("rechecks current role and active status rather than trusting stale claims", async () => {
      await database.db
        .update(database.users)
        .set({ isActive: false })
        .where(eq(database.users.id, owner));
      try {
        for (const path of paths)
          expect(
            (
              await app.inject({
                url: path,
                headers: { "x-fixture-actor": "owner" },
              })
            ).statusCode,
          ).toBe(403);
      } finally {
        await database.db
          .update(database.users)
          .set({ isActive: true })
          .where(eq(database.users.id, owner));
      }
      await database.db
        .update(database.users)
        .set({ role: "technician" })
        .where(eq(database.users.id, owner));
      try {
        for (const path of paths)
          expect(
            (
              await app.inject({
                url: path,
                headers: { "x-fixture-actor": "owner" },
              })
            ).statusCode,
          ).toBe(403);
      } finally {
        await database.db
          .update(database.users)
          .set({ role: "owner" })
          .where(eq(database.users.id, owner));
      }
    });
    it("services reject a user ID belonging to a different company", async () => {
      const actor = {
        companyId: company,
        userId: otherOwner,
        role: "owner" as const,
      };
      await expect(
        groups.listEstimateGroups(actor, EstimateGroupsQuerySchema.parse({})),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(
        week.getDispatchWeek(actor, DispatchWeekQuerySchema.parse({})),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
    it("new reads do not add activity events or alter source records", async () => {
      const before = await database.db.execute<{ n: string }>(
        sql`select count(*)::text as n from activity_events where company_id=${company}::uuid`,
      );
      for (const path of paths)
        await app.inject({
          url: path,
          headers: { "x-fixture-actor": "owner" },
        });
      const after = await database.db.execute<{ n: string }>(
        sql`select count(*)::text as n from activity_events where company_id=${company}::uuid`,
      );
      expect(after[0]?.n).toBe(before[0]?.n);
      const [saved] = await database.db
        .select()
        .from(database.jobs)
        .where(eq(database.jobs.id, job));
      expect(saved?.status).toBe("scheduled");
    });
  },
);
