import type { FastifyPluginAsync } from "fastify";

import { requireRole } from "../../lib/authorize.js";

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

const jobRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = [fastify.authenticate];
  // FS-25: field-prep reads are for staff (incl. technicians in the field), explicit per route.
  const jobPrepReaders = [
    fastify.authenticate,
    requireRole(["owner", "admin", "dispatcher", "office", "technician"])
  ];

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

  fastify.post("/:id/status", {
    preHandler: authenticate,
    preValidation: transitionStatusValidation,
    schema: transitionStatusRouteSchema
  }, transitionStatusHandler);

  fastify.post("/:id/assign", {
    preHandler: authenticate,
    preValidation: assignTechnicianValidation,
    schema: assignTechnicianRouteSchema
  }, assignTechnicianHandler);

  fastify.post("/:id/schedule", {
    preHandler: authenticate,
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
    preHandler: authenticate,
    preValidation: addNoteValidation,
    schema: addNoteRouteSchema
  }, addNoteHandler);

  fastify.get("/:id/notes", {
    preHandler: authenticate,
    preValidation: notesQueryValidation,
    schema: getNotesSchema
  }, getNotesHandler);

  fastify.post("/:id/photos", {
    preHandler: authenticate,
    preValidation: addPhotoValidation,
    schema: addPhotoRouteSchema
  }, addPhotoHandler);

  fastify.get("/:id/photos", {
    preHandler: authenticate,
    preValidation: photosQueryValidation,
    schema: getPhotosSchema
  }, getPhotosHandler);

  fastify.get("/:id/tasks", {
    preHandler: authenticate,
    preValidation: listTasksValidation,
    schema: listTasksSchema
  }, listTasksHandler);

  fastify.post("/:id/tasks", {
    preHandler: authenticate,
    preValidation: createTaskValidation,
    schema: createTaskRouteSchema
  }, createTaskHandler);

  fastify.post("/:id/tasks/reorder", {
    preHandler: authenticate,
    preValidation: reorderTasksValidation,
    schema: reorderTasksRouteSchema
  }, reorderTasksHandler);

  fastify.patch("/:id/tasks/:taskId", {
    preHandler: authenticate,
    preValidation: updateTaskValidation,
    schema: updateTaskRouteSchema
  }, updateTaskHandler);

  fastify.post("/:id/tasks/:taskId/complete", {
    preHandler: authenticate,
    preValidation: completeTaskValidation,
    schema: updateTaskRouteSchema
  }, completeTaskHandler);

  fastify.delete("/:id/tasks/:taskId", {
    preHandler: authenticate,
    preValidation: deleteTaskValidation,
    schema: deleteTaskRouteSchema
  }, deleteTaskHandler);

  fastify.get("/:id/products", {
    preHandler: authenticate,
    preValidation: listJobProductsValidation,
    schema: listJobProductsSchema
  }, listJobProductsHandler);

  fastify.post("/:id/products", {
    preHandler: authenticate,
    preValidation: addJobProductValidation,
    schema: addJobProductRouteSchema
  }, addJobProductHandler);

  fastify.patch("/:id/products/:productId", {
    preHandler: authenticate,
    preValidation: updateJobProductValidation,
    schema: updateJobProductRouteSchema
  }, updateJobProductHandler);

  fastify.post("/:id/products/:productId/approve-upsell", {
    preHandler: authenticate,
    preValidation: approveUpsellValidation,
    schema: approveUpsellRouteSchema
  }, approveUpsellHandler);

  fastify.delete("/:id/products/:productId", {
    preHandler: authenticate,
    preValidation: removeJobProductValidation,
    schema: removeJobProductRouteSchema
  }, removeJobProductHandler);

  fastify.get("/:id/activity", {
    preHandler: authenticate,
    preValidation: activityQueryValidation,
    schema: getActivitySchema
  }, getJobTimelineHandler);

  fastify.get("/:id", {
    preHandler: authenticate,
    preValidation: jobIdValidation,
    schema: getJobSchema
  }, getJobHandler);

  fastify.patch("/:id", {
    preHandler: authenticate,
    preValidation: updateJobValidation,
    schema: updateJobSchema
  }, updateJobHandler);
};

export default jobRoutes;
