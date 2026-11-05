import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

import { requireRole } from "../../lib/authorize.js";
import { issueCustomerPortalLink } from "../../services/customer-portal.service.js";
import { operatorRevokeSchema, revokeOperatorOutboundConsent } from "../../services/outbound-consent.service.js";

import {
  createAssetHandler,
  createCustomerHandler,
  createCustomerNoteHandler,
  createPropertyHandler,
  deleteAssetHandler,
  deleteCustomerHandler,
  deletePropertyHandler,
  getAssetHandler,
  getCustomerHandler,
  getCustomerImportedHistoryHandler,
  getCustomerHistoryTimelineHandler,
  getCustomerNotesHandler,
  getPropertyHandler,
  listCustomersHandler,
  listPropertiesHandler,
  searchCustomersHandler,
  updateAssetHandler,
  updateCustomerHandler,
  updatePropertyHandler
} from "./handlers.js";
import {
  assetIdValidation,
  createAssetRouteSchema,
  createAssetValidation,
  createCustomerNoteRouteSchema,
  createCustomerNoteValidation,
  createCustomerRouteSchema,
  createCustomerValidation,
  createPropertyRouteSchema,
  createPropertyValidation,
  customerIdValidation,
  deleteAssetRouteSchema,
  deleteCustomerRouteSchema,
  deletePropertyRouteSchema,
  getAssetRouteSchema,
  getCustomerRouteSchema,
  getCustomerImportedHistoryRouteSchema,
  getCustomerHistoryTimelineRouteSchema,
  listCustomerHistoryTimelineValidation,
  getCustomerNotesRouteSchema,
  getPropertyRouteSchema,
  listCustomersRouteSchema,
  listCustomersValidation,
  listPropertiesRouteSchema,
  propertyIdValidation,
  propertyListValidation,
  searchCustomersRouteSchema,
  searchCustomersValidation,
  updateAssetRouteSchema,
  updateAssetValidation,
  updateCustomerRouteSchema,
  updateCustomerValidation,
  updatePropertyRouteSchema,
  updatePropertyValidation
} from "./schemas.js";

const customerRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/",
    { preValidation: [listCustomersValidation], preHandler: [fastify.authenticate], schema: listCustomersRouteSchema },
    listCustomersHandler
  );
  fastify.get(
    "/search",
    { preValidation: [searchCustomersValidation], preHandler: [fastify.authenticate], schema: searchCustomersRouteSchema },
    searchCustomersHandler
  );
  fastify.post(
    "/",
    { preValidation: [createCustomerValidation], preHandler: [fastify.authenticate], schema: createCustomerRouteSchema },
    createCustomerHandler
  );
  fastify.get(
    "/:id",
    { preValidation: [customerIdValidation], preHandler: [fastify.authenticate], schema: getCustomerRouteSchema },
    getCustomerHandler
  );
  fastify.get(
    "/:id/notes",
    { preValidation: [customerIdValidation], preHandler: [fastify.authenticate], schema: getCustomerNotesRouteSchema },
    getCustomerNotesHandler
  );
  // Technicians cannot author CRM notes (they use job notes); office staff and above can.
  fastify.post(
    "/:id/notes",
    {
      preValidation: [createCustomerNoteValidation],
      preHandler: [fastify.authenticate, requireRole(["owner", "admin", "dispatcher", "office"])],
      schema: createCustomerNoteRouteSchema
    },
    createCustomerNoteHandler
  );
  // FS-168: staff issue a customer portal magic link (delivery by email/SMS is a follow-up).
  fastify.post(
    "/:id/portal-link",
    {
      preValidation: [customerIdValidation],
      preHandler: [fastify.authenticate, requireRole(["owner", "admin", "dispatcher", "office"])]
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const link = await issueCustomerPortalLink(request.company.id, id);
      return reply.status(201).send({ link });
    }
  );
  fastify.post(
    "/:id/outbound-consent/revoke",
    { preHandler: [fastify.authenticate, requireRole(["owner", "admin"])] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = operatorRevokeSchema.omit({ customerId: true }).parse(request.body);
      const event = await revokeOperatorOutboundConsent(
        { companyId: request.company.id, actorType: "user", actorId: request.user.id,
          role: z.enum(["owner", "admin"]).parse(request.user.role) },
        { ...body, customerId: id },
      );
      return reply.status(200).send({ id: event.id, version: event.version, state: event.currentState });
    },
  );
  fastify.get(
    "/:id/imported-history",
    { preValidation: [customerIdValidation], preHandler: [fastify.authenticate], schema: getCustomerImportedHistoryRouteSchema },
    getCustomerImportedHistoryHandler
  );
  fastify.get(
    "/:id/history-timeline",
    {
      preValidation: [listCustomerHistoryTimelineValidation],
      preHandler: [fastify.authenticate],
      schema: getCustomerHistoryTimelineRouteSchema
    },
    getCustomerHistoryTimelineHandler
  );
  fastify.patch(
    "/:id",
    { preValidation: [updateCustomerValidation], preHandler: [fastify.authenticate], schema: updateCustomerRouteSchema },
    updateCustomerHandler
  );
  fastify.delete(
    "/:id",
    { preValidation: [customerIdValidation], preHandler: [fastify.authenticate], schema: deleteCustomerRouteSchema },
    deleteCustomerHandler
  );
  fastify.get(
    "/:id/properties",
    { preValidation: [propertyListValidation], preHandler: [fastify.authenticate], schema: listPropertiesRouteSchema },
    listPropertiesHandler
  );
  fastify.post(
    "/:id/properties",
    { preValidation: [createPropertyValidation], preHandler: [fastify.authenticate], schema: createPropertyRouteSchema },
    createPropertyHandler
  );
  fastify.get(
    "/:id/properties/:propertyId",
    { preValidation: [propertyIdValidation], preHandler: [fastify.authenticate], schema: getPropertyRouteSchema },
    getPropertyHandler
  );
  fastify.patch(
    "/:id/properties/:propertyId",
    { preValidation: [updatePropertyValidation], preHandler: [fastify.authenticate], schema: updatePropertyRouteSchema },
    updatePropertyHandler
  );
  fastify.delete(
    "/:id/properties/:propertyId",
    { preValidation: [propertyIdValidation], preHandler: [fastify.authenticate], schema: deletePropertyRouteSchema },
    deletePropertyHandler
  );
  fastify.post(
    "/:id/properties/:propertyId/assets",
    { preValidation: [createAssetValidation], preHandler: [fastify.authenticate], schema: createAssetRouteSchema },
    createAssetHandler
  );
  fastify.get(
    "/:id/properties/:propertyId/assets/:assetId",
    { preValidation: [assetIdValidation], preHandler: [fastify.authenticate], schema: getAssetRouteSchema },
    getAssetHandler
  );
  fastify.patch(
    "/:id/properties/:propertyId/assets/:assetId",
    { preValidation: [updateAssetValidation], preHandler: [fastify.authenticate], schema: updateAssetRouteSchema },
    updateAssetHandler
  );
  fastify.delete(
    "/:id/properties/:propertyId/assets/:assetId",
    { preValidation: [assetIdValidation], preHandler: [fastify.authenticate], schema: deleteAssetRouteSchema },
    deleteAssetHandler
  );
};

export default customerRoutes;
