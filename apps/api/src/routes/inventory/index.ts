import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  CreateStockLocationBodySchema,
  InventoryIdParamsSchema,
  JobStockUsageBodySchema,
  ListStockLevelsQuerySchema,
  ListStockLocationsQuerySchema,
  ListStockMovementsQuerySchema,
  StockAdjustmentBodySchema,
  StockTransferBodySchema,
  UpdateStockLevelBodySchema,
  UpdateStockLocationBodySchema,
  type CreateStockLocationBody,
  type JobStockUsageBody,
  type ListStockLevelsQuery,
  type ListStockLocationsQuery,
  type ListStockMovementsQuery,
  type StockAdjustmentBody,
  type StockTransferBody,
  type UpdateStockLevelBody,
  type UpdateStockLocationBody
} from "@fsm/types";

import { requireRole } from "../../lib/authorize.js";
import {
  InventoryConflictError,
  adjustStock,
  createStockLocation,
  listStockLevels,
  listStockLocations,
  listStockMovements,
  recordJobUsage,
  transferStock,
  updateStockLevel,
  updateStockLocation,
  type InventoryActor
} from "../../services/inventory.service.js";
import { withZodValidation } from "../shared/validation.js";

const manageRoles = requireRole(["owner", "admin", "dispatcher", "office"]);
const readOrUseRoles = requireRole(["owner", "admin", "dispatcher", "office", "technician"]);

function actorOf(request: FastifyRequest): InventoryActor {
  return { companyId: request.company.id, userId: request.user.id, role: request.user.role };
}

async function withConflict<T>(reply: FastifyReply, work: () => Promise<T>, code = 200) {
  try {
    return reply.code(code).send(await work());
  } catch (error) {
    if (error instanceof InventoryConflictError) {
      return reply.code(409).send({
        error: "CONFLICT",
        reason: error.reason,
        message: error.message,
        current: error.current
      });
    }
    throw error;
  }
}

const idOf = (request: FastifyRequest) => (request.params as { id: string }).id;

const inventoryRoutes: FastifyPluginAsync = async (fastify) => {
  const read = [fastify.authenticate, readOrUseRoles];
  const manage = [fastify.authenticate, manageRoles];

  fastify.get("/inventory/locations", {
    onRequest: read,
    preValidation: [withZodValidation({ query: ListStockLocationsQuerySchema })]
  }, async (request, reply) =>
    reply.send({ locations: await listStockLocations(actorOf(request), request.query as ListStockLocationsQuery) }));

  fastify.post("/inventory/locations", {
    onRequest: manage,
    preValidation: [withZodValidation({ body: CreateStockLocationBodySchema })]
  }, async (request, reply) =>
    reply.code(201).send({ location: await createStockLocation(actorOf(request), request.body as CreateStockLocationBody) }));

  fastify.patch("/inventory/locations/:id", {
    onRequest: manage,
    preValidation: [withZodValidation({ params: InventoryIdParamsSchema, body: UpdateStockLocationBodySchema })]
  }, async (request, reply) =>
    withConflict(reply, async () => ({
      location: await updateStockLocation(actorOf(request), idOf(request), request.body as UpdateStockLocationBody)
    })));

  fastify.get("/inventory/levels", {
    onRequest: read,
    preValidation: [withZodValidation({ query: ListStockLevelsQuerySchema })]
  }, async (request, reply) =>
    reply.send({ levels: await listStockLevels(actorOf(request), request.query as ListStockLevelsQuery) }));

  fastify.get("/inventory/low-stock", {
    onRequest: read,
    preValidation: [withZodValidation({ query: ListStockLevelsQuerySchema })]
  }, async (request, reply) =>
    reply.send({
      levels: await listStockLevels(actorOf(request), { ...(request.query as ListStockLevelsQuery), lowStock: "true" })
    }));

  fastify.patch("/inventory/levels/:id", {
    onRequest: manage,
    preValidation: [withZodValidation({ params: InventoryIdParamsSchema, body: UpdateStockLevelBodySchema })]
  }, async (request, reply) =>
    withConflict(reply, async () => ({
      level: await updateStockLevel(actorOf(request), idOf(request), request.body as UpdateStockLevelBody)
    })));

  fastify.post("/inventory/adjustments", {
    onRequest: manage,
    preValidation: [withZodValidation({ body: StockAdjustmentBodySchema })]
  }, async (request, reply) =>
    withConflict(reply, async () => adjustStock(actorOf(request), request.body as StockAdjustmentBody), 201));

  fastify.post("/inventory/transfers", {
    onRequest: manage,
    preValidation: [withZodValidation({ body: StockTransferBodySchema })]
  }, async (request, reply) =>
    withConflict(reply, async () => transferStock(actorOf(request), request.body as StockTransferBody), 201));

  fastify.post("/inventory/job-usage", {
    onRequest: read,
    preValidation: [withZodValidation({ body: JobStockUsageBodySchema })]
  }, async (request, reply) =>
    withConflict(reply, async () => recordJobUsage(actorOf(request), request.body as JobStockUsageBody), 201));

  fastify.get("/inventory/movements", {
    onRequest: manage,
    preValidation: [withZodValidation({ query: ListStockMovementsQuerySchema })]
  }, async (request, reply) =>
    reply.send({ movements: await listStockMovements(actorOf(request), request.query as ListStockMovementsQuery) }));
};

export default inventoryRoutes;
