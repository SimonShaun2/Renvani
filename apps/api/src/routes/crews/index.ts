import type { FastifyPluginAsync, FastifyReply, FastifyRequest, FastifySchema } from "fastify";
import { z } from "zod";

import { requireRole } from "../../lib/authorize.js";
import {
  assignJobCrew,
  createCrew,
  deleteCrew,
  getTechnicianDriveTime,
  listCrews,
  replaceCrewMembers,
  updateCrew
} from "../../services/crews/crews.service.js";
import { withZodValidation } from "../shared/validation.js";

const MAX_MEMBERS = 50;
const idParams = z.object({ id: z.string().uuid() }).strict();
const roleSchema = z.string().regex(/^[a-z][a-z0-9_]{0,31}$/u);
const memberSchema = z.object({ technicianId: z.string().uuid(), role: roleSchema.default("member") }).strict();
const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/u).nullable();
const nameSchema = z.string().trim().min(1).max(100);
const versionSchema = z.number().int().positive();

export const createCrewBody = z.object({
  name: nameSchema,
  color: colorSchema.optional(),
  members: z.array(memberSchema).max(MAX_MEMBERS).optional()
}).strict();
export const updateCrewBody = z.object({
  expectedVersion: versionSchema,
  name: nameSchema.optional(),
  color: colorSchema.optional(),
  isActive: z.boolean().optional()
}).strict();
export const replaceMembersBody = z.object({
  expectedVersion: versionSchema,
  members: z.array(memberSchema).max(MAX_MEMBERS)
}).strict();
export const deleteCrewQuery = z.object({ expectedVersion: z.coerce.number().int().positive() }).strict();
export const assignCrewBody = z.object({ crewId: z.string().uuid().nullable() }).strict();
export const driveTimeParams = z.object({ technicianId: z.string().uuid() }).strict();
export const driveTimeQuery = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u) }).strict();

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] }) as const;
const crewJson = {
  type: "object",
  additionalProperties: false,
  required: ["id", "name", "color", "isActive", "version", "members"],
  properties: {
    id: { type: "string" },
    name: { type: "string" },
    color: nullable("string"),
    isActive: { type: "boolean" },
    version: { type: "integer" },
    members: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["technicianId", "role"],
        properties: { technicianId: { type: "string" }, role: { type: "string" } }
      }
    }
  }
} as const;
const crewResponse = { type: "object", additionalProperties: false, required: ["crew"], properties: { crew: crewJson } } as const;

const listSchema: FastifySchema = {
  response: { 200: { type: "object", additionalProperties: false, required: ["crews"], properties: { crews: { type: "array", items: crewJson } } } }
};
const createSchema: FastifySchema = { response: { 201: crewResponse } };
const crewSchema: FastifySchema = { response: { 200: crewResponse } };
const assignSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["jobId", "crewId"],
      properties: { jobId: { type: "string" }, crewId: nullable("string") }
    }
  }
};
const driveTimeSchema: FastifySchema = {
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["technicianId", "date", "estimator", "method", "confidence", "totalMinutes", "legs"],
      properties: {
        technicianId: { type: "string" },
        date: { type: "string" },
        estimator: { type: "string" },
        method: { type: "string" },
        confidence: { type: "string" },
        totalMinutes: { type: "integer" },
        legs: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["fromJobId", "toJobId", "status", "minutes", "distanceMiles", "unavailableReason"],
            properties: {
              fromJobId: { type: "string" },
              toJobId: { type: "string" },
              status: { type: "string" },
              minutes: nullable("integer"),
              distanceMiles: nullable("number"),
              unavailableReason: nullable("string")
            }
          }
        }
      }
    }
  }
};

type Req = FastifyRequest;
const READ_ROLES = ["owner", "admin", "dispatcher"] as const;
const WRITE_ROLES = ["owner", "admin"] as const;

/** FS-195 — crews/teams CRUD, job crew assignment and per-technician drive-time (mounted at /api/v1). */
const crewRoutes: FastifyPluginAsync = async (fastify) => {
  const read = [fastify.authenticate, requireRole([...READ_ROLES])];
  const write = [fastify.authenticate, requireRole([...WRITE_ROLES])];

  fastify.get("/crews", { preHandler: read, schema: listSchema }, async (request: Req, reply: FastifyReply) =>
    reply.send({ crews: await listCrews(request.company.id) }));

  fastify.post("/crews", {
    preHandler: write,
    preValidation: [withZodValidation({ body: createCrewBody })],
    schema: createSchema,
    bodyLimit: 16_384
  }, async (request: Req, reply: FastifyReply) => {
    const body = request.body as z.infer<typeof createCrewBody>;
    return reply.status(201).send({ crew: await createCrew(request.company.id, body) });
  });

  fastify.patch("/crews/:id", {
    preHandler: write,
    preValidation: [withZodValidation({ params: idParams, body: updateCrewBody })],
    schema: crewSchema,
    bodyLimit: 4_096
  }, async (request: Req, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof idParams>;
    return reply.send({ crew: await updateCrew(request.company.id, id, request.body as z.infer<typeof updateCrewBody>) });
  });

  fastify.put("/crews/:id/members", {
    preHandler: write,
    preValidation: [withZodValidation({ params: idParams, body: replaceMembersBody })],
    schema: crewSchema,
    bodyLimit: 16_384
  }, async (request: Req, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof idParams>;
    return reply.send({ crew: await replaceCrewMembers(request.company.id, id, request.body as z.infer<typeof replaceMembersBody>) });
  });

  fastify.delete("/crews/:id", {
    preHandler: write,
    preValidation: [withZodValidation({ params: idParams, query: deleteCrewQuery })]
  }, async (request: Req, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof idParams>;
    const { expectedVersion } = request.query as z.infer<typeof deleteCrewQuery>;
    await deleteCrew(request.company.id, id, expectedVersion);
    return reply.status(204).send();
  });

  fastify.put("/jobs/:id/crew", {
    preHandler: read,
    preValidation: [withZodValidation({ params: idParams, body: assignCrewBody })],
    schema: assignSchema,
    bodyLimit: 1_024
  }, async (request: Req, reply: FastifyReply) => {
    const { id } = request.params as z.infer<typeof idParams>;
    const { crewId } = request.body as z.infer<typeof assignCrewBody>;
    return reply.send(await assignJobCrew(request.company.id, id, crewId));
  });

  fastify.get("/dispatch/technicians/:technicianId/drive-time", {
    preHandler: read,
    preValidation: [withZodValidation({ params: driveTimeParams, query: driveTimeQuery })],
    schema: driveTimeSchema
  }, async (request: Req, reply: FastifyReply) => {
    const { technicianId } = request.params as z.infer<typeof driveTimeParams>;
    const { date } = request.query as z.infer<typeof driveTimeQuery>;
    return reply.send(await getTechnicianDriveTime(request.company.id, technicianId, date));
  });
};

export default crewRoutes;
