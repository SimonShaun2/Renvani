import type { FastifyPluginAsync } from "fastify";
import { requireRole } from "../../lib/authorize.js";

import {
  addEstimateItemHandler,
  approveEstimateHandler,
  convertEstimateHandler,
  createEstimateHandler,
  declineEstimateHandler,
  deleteEstimateHandler,
  deleteEstimateItemHandler,
  getEstimateHandler,
  listEstimateItemsHandler,
  listEstimatesHandler,
  reviseEstimateHandler,
  sendEstimateHandler,
  updateEstimateHandler,
  updateEstimateItemHandler
} from "./handlers.js";
import { estimateGroupRoutes } from "./groups.js";
import { registerEstimateOptionSetRoutes } from "./option-sets.js";
import {
  addEstimateItemSchema,
  addEstimateItemValidation,
  approveEstimateSchema,
  convertEstimateSchema,
  createEstimateSchema,
  createEstimateValidation,
  declineEstimateRouteSchema,
  declineEstimateValidation,
  deleteEstimateItemSchema,
  deleteEstimateSchema,
  estimateIdValidation,
  estimateItemIdValidation,
  getEstimateSchema,
  listEstimateItemsSchema,
  listEstimatesSchema,
  listEstimatesValidation,
  reviseEstimateSchema,
  sendEstimateSchema,
  updateEstimateItemRouteSchema,
  updateEstimateItemValidation,
  updateEstimateSchema,
  updateEstimateValidation
} from "./schemas.js";

const estimateRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;
  const officeOnly = [authenticate, requireRole(["owner", "admin", "dispatcher"])];
  const officeOrTechnician = [authenticate, requireRole(["owner", "admin", "dispatcher", "technician"])];

  // FS-212 option sets (registered first; static "option-sets" segment wins over "/:id").
  registerEstimateOptionSetRoutes(fastify);
  await estimateGroupRoutes(fastify, {});

  fastify.get("/", {
    preHandler: officeOnly,
    preValidation: listEstimatesValidation,
    schema: listEstimatesSchema
  }, listEstimatesHandler);

  fastify.post("/", {
    preHandler: officeOnly,
    preValidation: createEstimateValidation,
    schema: createEstimateSchema
  }, createEstimateHandler);

  fastify.get("/:id", {
    preHandler: officeOrTechnician,
    preValidation: estimateIdValidation,
    schema: getEstimateSchema
  }, getEstimateHandler);

  fastify.patch("/:id", {
    preHandler: officeOnly,
    preValidation: updateEstimateValidation,
    schema: updateEstimateSchema
  }, updateEstimateHandler);

  fastify.delete("/:id", {
    preHandler: officeOnly,
    preValidation: estimateIdValidation,
    schema: deleteEstimateSchema
  }, deleteEstimateHandler);

  fastify.post("/:id/send", {
    preHandler: officeOnly,
    preValidation: estimateIdValidation,
    schema: sendEstimateSchema
  }, sendEstimateHandler);

  fastify.post("/:id/approve", {
    preHandler: officeOnly,
    preValidation: estimateIdValidation,
    schema: approveEstimateSchema
  }, approveEstimateHandler);

  fastify.post("/:id/decline", {
    preHandler: officeOnly,
    preValidation: declineEstimateValidation,
    schema: declineEstimateRouteSchema
  }, declineEstimateHandler);

  fastify.post("/:id/revise", {
    preHandler: officeOnly,
    preValidation: estimateIdValidation,
    schema: reviseEstimateSchema
  }, reviseEstimateHandler);

  fastify.post("/:id/convert", {
    preHandler: officeOnly,
    preValidation: estimateIdValidation,
    schema: convertEstimateSchema
  }, convertEstimateHandler);

  fastify.post("/:id/convert-to-job", {
    preHandler: officeOnly,
    preValidation: estimateIdValidation,
    schema: convertEstimateSchema
  }, convertEstimateHandler);

  fastify.get("/:id/items", {
    preHandler: officeOrTechnician,
    preValidation: estimateIdValidation,
    schema: listEstimateItemsSchema
  }, listEstimateItemsHandler);

  fastify.post("/:id/items", {
    preHandler: officeOnly,
    preValidation: addEstimateItemValidation,
    schema: addEstimateItemSchema
  }, addEstimateItemHandler);

  fastify.patch("/:id/items/:itemId", {
    preHandler: officeOnly,
    preValidation: updateEstimateItemValidation,
    schema: updateEstimateItemRouteSchema
  }, updateEstimateItemHandler);

  fastify.delete("/:id/items/:itemId", {
    preHandler: officeOnly,
    preValidation: estimateItemIdValidation,
    schema: deleteEstimateItemSchema
  }, deleteEstimateItemHandler);
};

export default estimateRoutes;
