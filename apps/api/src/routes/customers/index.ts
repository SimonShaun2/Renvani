import type { FastifyPluginAsync } from "fastify";

import {
  createAssetHandler,
  createCustomerHandler,
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
