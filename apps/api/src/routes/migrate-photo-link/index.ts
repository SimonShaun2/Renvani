import fastifyMultipart from "@fastify/multipart";
import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import {
  applyPhotoLinkDecisionsHandler,
  commitPhotoLinksHandler,
  getPhotoLinkPreviewHandler,
  getPhotoUploadStatusHandler,
  uploadPhotoBatchHandler
} from "./handlers.js";
import {
  applyPhotoLinkDecisionsValidation,
  migratePhotoBundleParamsValidation,
  photoBatchUploadQueryValidation
} from "./schemas.js";

const PHOTO_BATCH_LIMIT_BYTES = 50 * 1024 * 1024;
const PHOTO_BATCH_MAX_FILES = 50;

const migratePhotoLinkRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyMultipart, {
    limits: {
      fileSize: PHOTO_BATCH_LIMIT_BYTES,
      files: PHOTO_BATCH_MAX_FILES
    },
    throwFileSizeLimit: true
  });

  const authenticate = fastify.authenticate;
  const requireOwnerOrAdmin = requireRole(["owner", "admin"]);

  fastify.get("/migrate/photo-link/bundles/:bundleId/upload-status", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migratePhotoBundleParamsValidation
  }, getPhotoUploadStatusHandler);

  fastify.post("/migrate/photo-link/bundles/:bundleId/upload-batch", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: photoBatchUploadQueryValidation
  }, uploadPhotoBatchHandler);

  fastify.get("/migrate/photo-link/bundles/:bundleId/preview", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migratePhotoBundleParamsValidation
  }, getPhotoLinkPreviewHandler);

  fastify.patch("/migrate/photo-link/bundles/:bundleId/link-decisions", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: applyPhotoLinkDecisionsValidation
  }, applyPhotoLinkDecisionsHandler);

  fastify.post("/migrate/photo-link/bundles/:bundleId/commit-links", {
    preHandler: [authenticate, requireOwnerOrAdmin],
    preValidation: migratePhotoBundleParamsValidation
  }, commitPhotoLinksHandler);
};

export default migratePhotoLinkRoutes;
