import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import { hitFixedWindowRateLimit } from "../../lib/fixed-window-rate-limit.js";
import { denyTechnician, technicianOwnJob } from "../../lib/technician-scope.js";

import {
  addJobProductHandler,
  addNoteHandler,
  addPhotoHandler,
  assignTechnicianHandler,
  approveUpsellHandler,
  completeJobHandler,
  completeTaskHandler,
  createTaskHandler,
  createJobHandler,
  previewJobCreateHandler,
  deleteTaskHandler,
  getJobHandler,
  getJobPreparationStatusHandler,
  getJobServiceBriefHandler,
  listJobProductsHandler,
  getJobTimelineHandler,
  getNotesHandler,
  getPhotosHandler,
  listTasksHandler,
  removeJobProductHandler,
  reorderTasksHandler,
  listJobsHandler,
  scheduleJobHandler,
  transitionStatusHandler,
  updateJobProductHandler,
  updateTaskHandler,
  updateJobHandler
} from "./handlers.js";
import {
  activityQueryValidation,
  addJobProductRouteSchema,
  addJobProductValidation,
  addNoteRouteSchema,
  addNoteValidation,
  addPhotoRouteSchema,
  addPhotoValidation,
  assignTechnicianRouteSchema,
  assignTechnicianValidation,
  approveUpsellRouteSchema,
  approveUpsellValidation,
  completeJobRouteSchema,
  completeJobValidation,
  completeTaskValidation,
  createJobSchema,
  createJobValidation,
  jobCreatePreviewValidation,
  createTaskRouteSchema,
  createTaskValidation,
  deleteTaskRouteSchema,
  deleteTaskValidation,
  getActivitySchema,
  getJobSchema,
  getJobPreparationStatusRouteSchema,
  getJobServiceBriefRouteSchema,
  listJobProductsSchema,
  listJobProductsValidation,
  getNotesSchema,
  getPhotosSchema,
  jobIdValidation,
  listTasksSchema,
  listTasksValidation,
  listJobsSchema,
  listJobsValidation,
  notesQueryValidation,
  photosQueryValidation,
  removeJobProductRouteSchema,
  removeJobProductValidation,
  reorderTasksRouteSchema,
  reorderTasksValidation,
  scheduleJobRouteSchema,
  scheduleJobValidation,
  updateJobProductRouteSchema,
  updateJobProductValidation,
  updateTaskRouteSchema,
  updateTaskValidation,
  transitionStatusRouteSchema,
  transitionStatusValidation,
  updateJobSchema,
  updateJobValidation
} from "./schemas.js";

/** POST /jobs/preview: up to 50 catalog lookups + a job-number read per call, so cap it per user (company-scoped key). */
export const JOB_PREVIEW_RATE_LIMIT = 60;
export const JOB_PREVIEW_WINDOW_MS = 60_000;

async function jobPreviewRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const companyId = request.company?.id ?? "unknown";
  const userId = request.user?.id ?? "unknown";
  const result = await hitFixedWindowRateLimit({
    key: `fsm:jobs:preview:company:${companyId}:user:${userId}`,
    limit: JOB_PREVIEW_RATE_LIMIT,
    windowMs: JOB_PREVIEW_WINDOW_MS
  });
  if (!result.allowed) {
    reply.header("Retry-After", String(result.retryAfterSeconds));
    await reply.status(429).send({
      error: "RATE_LIMITED",
      message: "Too many job previews. Please try again shortly.",
      requestId: request.id
    });
  }
}

const jobRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = [fastify.authenticate];
  // FS-25: field-prep reads are for staff (incl. technicians in the field), explicit per route.
  const jobPrepReaders = [
    fastify.authenticate,
    requireRole(["owner", "admin", "dispatcher", "office", "technician"]),
    technicianOwnJob("not_found")
  ];
  // Technician scoping (no-op for other roles): own assigned jobs only.
  const ownJobWrite = [fastify.authenticate, technicianOwnJob("forbidden")];
  const ownJobRead = [fastify.authenticate, technicianOwnJob("not_found")];
  const staffOnly = [fastify.authenticate, denyTechnician];

  fastify.get("/", {
    preHandler: authenticate,
    preValidation: listJobsValidation,
    schema: listJobsSchema
  }, listJobsHandler);

  fastify.post("/", {
    preHandler: authenticate,
    preValidation: createJobValidation,
    schema: createJobSchema
  }, createJobHandler);

  // Before "/:id/*" routes. Staff only; read-only (no job number reserved).
  fastify.post("/preview", {
    preHandler: [...staffOnly, jobPreviewRateLimit],
    preValidation: jobCreatePreviewValidation
  }, previewJobCreateHandler);

  fastify.post("/:id/status", {
    preHandler: ownJobWrite,
    preValidation: transitionStatusValidation,
    schema: transitionStatusRouteSchema
  }, transitionStatusHandler);

  fastify.post("/:id/assign", {
    preHandler: staffOnly,
    preValidation: assignTechnicianValidation,
    schema: assignTechnicianRouteSchema
  }, assignTechnicianHandler);

  fastify.post("/:id/schedule", {
    preHandler: staffOnly,
    preValidation: scheduleJobValidation,
    schema: scheduleJobRouteSchema
  }, scheduleJobHandler);

  fastify.post("/:id/complete", {
    preHandler: authenticate,
    preValidation: completeJobValidation,
    schema: completeJobRouteSchema
  }, completeJobHandler);

  fastify.get("/:id/service-brief", {
    preHandler: jobPrepReaders,
    preValidation: jobIdValidation,
    schema: getJobServiceBriefRouteSchema
  }, getJobServiceBriefHandler);

  fastify.get("/:id/preparation-status", {
    preHandler: jobPrepReaders,
    preValidation: jobIdValidation,
    schema: getJobPreparationStatusRouteSchema
  }, getJobPreparationStatusHandler);

  fastify.post("/:id/notes", {
    preHandler: ownJobWrite,
    preValidation: addNoteValidation,
    schema: addNoteRouteSchema
  }, addNoteHandler);

  fastify.get("/:id/notes", {
    preHandler: ownJobRead,
    preValidation: notesQueryValidation,
    schema: getNotesSchema
  }, getNotesHandler);

  fastify.post("/:id/photos", {
    preHandler: ownJobWrite,
    preValidation: addPhotoValidation,
    schema: addPhotoRouteSchema
  }, addPhotoHandler);

  fastify.get("/:id/photos", {
    preHandler: ownJobRead,
    preValidation: photosQueryValidation,
    schema: getPhotosSchema
  }, getPhotosHandler);

  fastify.get("/:id/tasks", {
    preHandler: ownJobRead,
    preValidation: listTasksValidation,
    schema: listTasksSchema
  }, listTasksHandler);

  fastify.post("/:id/tasks", {
    preHandler: ownJobWrite,
    preValidation: createTaskValidation,
    schema: createTaskRouteSchema
  }, createTaskHandler);

  fastify.post("/:id/tasks/reorder", {
    preHandler: ownJobWrite,
    preValidation: reorderTasksValidation,
    schema: reorderTasksRouteSchema
  }, reorderTasksHandler);

  fastify.patch("/:id/tasks/:taskId", {
    preHandler: ownJobWrite,
    preValidation: updateTaskValidation,
    schema: updateTaskRouteSchema
  }, updateTaskHandler);

  fastify.post("/:id/tasks/:taskId/complete", {
    preHandler: authenticate,
    preValidation: completeTaskValidation,
    schema: updateTaskRouteSchema
  }, completeTaskHandler);

  fastify.delete("/:id/tasks/:taskId", {
    preHandler: ownJobWrite,
    preValidation: deleteTaskValidation,
    schema: deleteTaskRouteSchema
  }, deleteTaskHandler);

  fastify.get("/:id/products", {
    preHandler: ownJobRead,
    preValidation: listJobProductsValidation,
    schema: listJobProductsSchema
  }, listJobProductsHandler);

  fastify.post("/:id/products", {
    preHandler: ownJobWrite,
    preValidation: addJobProductValidation,
    schema: addJobProductRouteSchema
  }, addJobProductHandler);

  fastify.patch("/:id/products/:productId", {
    preHandler: ownJobWrite,
    preValidation: updateJobProductValidation,
    schema: updateJobProductRouteSchema
  }, updateJobProductHandler);

  fastify.post("/:id/products/:productId/approve-upsell", {
    preHandler: ownJobWrite,
    preValidation: approveUpsellValidation,
    schema: approveUpsellRouteSchema
  }, approveUpsellHandler);

  fastify.delete("/:id/products/:productId", {
    preHandler: ownJobWrite,
    preValidation: removeJobProductValidation,
    schema: removeJobProductRouteSchema
  }, removeJobProductHandler);

  fastify.get("/:id/activity", {
    preHandler: ownJobRead,
    preValidation: activityQueryValidation,
    schema: getActivitySchema
  }, getJobTimelineHandler);

  fastify.get("/:id", {
    preHandler: authenticate,
    preValidation: jobIdValidation,
    schema: getJobSchema
  }, getJobHandler);

  fastify.patch("/:id", {
    preHandler: ownJobWrite,
    preValidation: updateJobValidation,
    schema: updateJobSchema
  }, updateJobHandler);
};

export default jobRoutes;
