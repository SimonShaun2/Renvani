import type { FastifyPluginAsync } from "fastify";

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

  // FS-212 option sets (registered first; static "option-sets" segment wins over "/:id").
  registerEstimateOptionSetRoutes(fastify);

  fastify.get("/", {
    preHandler: authenticate,
    preValidation: listEstimatesValidation,
    schema: listEstimatesSchema
  }, listEstimatesHandler);

  fastify.post("/", {
    preHandler: authenticate,
    preValidation: createEstimateValidation,
    schema: createEstimateSchema
  }, createEstimateHandler);

  fastify.get("/:id", {
    preHandler: authenticate,
    preValidation: estimateIdValidation,
    schema: getEstimateSchema
  }, getEstimateHandler);

  fastify.patch("/:id", {
    preHandler: authenticate,
    preValidation: updateEstimateValidation,
    schema: updateEstimateSchema
  }, updateEstimateHandler);

  fastify.delete("/:id", {
    preHandler: authenticate,
    preValidation: estimateIdValidation,
    schema: deleteEstimateSchema
  }, deleteEstimateHandler);

  fastify.post("/:id/send", {
    preHandler: authenticate,
    preValidation: estimateIdValidation,
    schema: sendEstimateSchema
  }, sendEstimateHandler);

  fastify.post("/:id/approve", {
    preHandler: authenticate,
    preValidation: estimateIdValidation,
    schema: approveEstimateSchema
  }, approveEstimateHandler);

  fastify.post("/:id/decline", {
    preHandler: authenticate,
    preValidation: declineEstimateValidation,
    schema: declineEstimateRouteSchema
  }, declineEstimateHandler);

  fastify.post("/:id/revise", {
    preHandler: authenticate,
    preValidation: estimateIdValidation,
    schema: reviseEstimateSchema
  }, reviseEstimateHandler);

  fastify.post("/:id/convert", {
    preHandler: authenticate,
    preValidation: estimateIdValidation,
    schema: convertEstimateSchema
  }, convertEstimateHandler);

  fastify.post("/:id/convert-to-job", {
    preHandler: authenticate,
    preValidation: estimateIdValidation,
    schema: convertEstimateSchema
  }, convertEstimateHandler);

  fastify.get("/:id/items", {
    preHandler: authenticate,
    preValidation: estimateIdValidation,
    schema: listEstimateItemsSchema
  }, listEstimateItemsHandler);

  fastify.post("/:id/items", {
    preHandler: authenticate,
    preValidation: addEstimateItemValidation,
    schema: addEstimateItemSchema
  }, addEstimateItemHandler);

  fastify.patch("/:id/items/:itemId", {
    preHandler: authenticate,
    preValidation: updateEstimateItemValidation,
    schema: updateEstimateItemRouteSchema
  }, updateEstimateItemHandler);

  fastify.delete("/:id/items/:itemId", {
    preHandler: authenticate,
    preValidation: estimateItemIdValidation,
    schema: deleteEstimateItemSchema
  }, deleteEstimateItemHandler);
};

export default estimateRoutes;
