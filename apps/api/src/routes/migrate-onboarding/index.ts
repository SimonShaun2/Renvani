import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  acknowledgeMigrateOnboardingPreviewHandler,
  applyMigrateDedupeDecisionsHandler,
  commitMigrateOnboardingBundleHandler,
  confirmMigrateOnboardingMappingsHandler,
  createMigrateOnboardingSessionHandler,
  getActiveMigrateOnboardingSessionHandler,
  getMigrateDedupePreviewHandler,
  getMigrateRelationalPreviewHandler,
  getMigrateOnboardingIngestStatusHandler,
  getMigrateOnboardingBundleHandler,
  linkMigrateOnboardingFilesHandler,
  listMigrateOnboardingSourcesHandler,
  setMigrateOnboardingSourceHandler,
  runMigrateImportFileLinkHandler,
  getMigrateImportFileLinkPreviewHandler,
  confirmMigrateImportFileLinkHandler
} from "./handlers.js";
import {
  acknowledgePreviewRouteSchema,
  applyMigrateDedupeDecisionsValidation,
  commitBundleRouteSchema,
  confirmMappingsRouteSchema,
  createMigrateOnboardingSessionValidation,
  createSessionRouteSchema,
  dedupeDecisionsRouteSchema,
  dedupePreviewRouteSchema,
  relationalPreviewRouteSchema,
  getActiveSessionRouteSchema,
  getBundleRouteSchema,
  ingestStatusRouteSchema,
  linkFilesRouteSchema,
  linkMigrateOnboardingFilesValidation,
  listSourcesRouteSchema,
  migrateOnboardingBundleIdValidation,
  setMigrateOnboardingSourceValidation,
  setSourceRouteSchema,
  confirmImportFileLinkDecisionsValidation,
  fileLinkPreviewRouteSchema,
  runFileLinkRouteSchema,
  confirmFileLinkRouteSchema
} from "./schemas.js";

const migrateOnboardingRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;
  const requireOwnerOrAdmin = requireRole(["owner", "admin"]);

  fastify.get("/migrate/onboarding/sources", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    schema: listSourcesRouteSchema
  }, listMigrateOnboardingSourcesHandler);

  fastify.post("/migrate/onboarding/sessions", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: createMigrateOnboardingSessionValidation,
    schema: createSessionRouteSchema
  }, createMigrateOnboardingSessionHandler);

  fastify.get("/migrate/onboarding/sessions/active", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    schema: getActiveSessionRouteSchema
  }, getActiveMigrateOnboardingSessionHandler);

  fastify.get("/migrate/onboarding/sessions/:bundleId", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migrateOnboardingBundleIdValidation,
    schema: getBundleRouteSchema
  }, getMigrateOnboardingBundleHandler);

  fastify.patch("/migrate/onboarding/sessions/:bundleId/source", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: setMigrateOnboardingSourceValidation,
    schema: setSourceRouteSchema
  }, setMigrateOnboardingSourceHandler);

  fastify.patch("/migrate/onboarding/sessions/:bundleId/files", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: linkMigrateOnboardingFilesValidation,
    schema: linkFilesRouteSchema
  }, linkMigrateOnboardingFilesHandler);

  fastify.post("/migrate/onboarding/sessions/:bundleId/confirm-mappings", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migrateOnboardingBundleIdValidation,
    schema: confirmMappingsRouteSchema
  }, confirmMigrateOnboardingMappingsHandler);

  fastify.post("/migrate/onboarding/sessions/:bundleId/acknowledge-preview", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migrateOnboardingBundleIdValidation,
    schema: acknowledgePreviewRouteSchema
  }, acknowledgeMigrateOnboardingPreviewHandler);

  fastify.post("/migrate/onboarding/sessions/:bundleId/file-link/run", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migrateOnboardingBundleIdValidation,
    schema: runFileLinkRouteSchema
  }, runMigrateImportFileLinkHandler);

  fastify.get("/migrate/onboarding/sessions/:bundleId/file-link/preview", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migrateOnboardingBundleIdValidation,
    schema: fileLinkPreviewRouteSchema
  }, getMigrateImportFileLinkPreviewHandler);

  fastify.patch("/migrate/onboarding/sessions/:bundleId/file-link/decisions", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: confirmImportFileLinkDecisionsValidation,
    schema: confirmFileLinkRouteSchema
  }, confirmMigrateImportFileLinkHandler);

  fastify.get("/migrate/onboarding/sessions/:bundleId/dedupe-preview", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migrateOnboardingBundleIdValidation,
    schema: dedupePreviewRouteSchema
  }, getMigrateDedupePreviewHandler);

  fastify.get("/migrate/onboarding/sessions/:bundleId/relational-preview", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migrateOnboardingBundleIdValidation,
    schema: relationalPreviewRouteSchema
  }, getMigrateRelationalPreviewHandler);

  fastify.get("/migrate/onboarding/sessions/:bundleId/ingest-status", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migrateOnboardingBundleIdValidation,
    schema: ingestStatusRouteSchema
  }, getMigrateOnboardingIngestStatusHandler);

  fastify.patch("/migrate/onboarding/sessions/:bundleId/dedupe-decisions", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: applyMigrateDedupeDecisionsValidation,
    schema: dedupeDecisionsRouteSchema
  }, applyMigrateDedupeDecisionsHandler);

  fastify.post("/migrate/onboarding/sessions/:bundleId/commit", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migrateOnboardingBundleIdValidation,
    schema: commitBundleRouteSchema
  }, commitMigrateOnboardingBundleHandler);
};

export default migrateOnboardingRoutes;
