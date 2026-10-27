import type { FastifyReply, FastifyRequest } from "fastify";

import {
  assertTechnicianAssignedToJob,
  isTechnicianCaller,
  resolveCallerTechnicianId
} from "../../lib/technician-scope.js";
import { withSignedJobSignature } from "../../lib/job-signature-ref.js";
import type {
  ActivityEvent,
  AddNoteInput,
  AddPhotoInput,
  AddJobProductInput,
  CompleteJobInput,
  CreateTaskInput,
  CreateJobInput,
  JobDetail,
  JobListItem,
  JobNote,
  JobPhoto,
  JobProduct,
  JobTask,
  ListJobsQuery,
  ScheduleJobInput,
  UpdateJobProductInput,
  UpdateTaskInput,
  UpdateJobInput
} from "@fsm/types";

import {
  addProduct,
  approveUpsell,
  listJobProducts,
  removeJobProduct,
  updateJobProduct
} from "../../services/job-products.service.js";
import {
  completeTask,
  createTask,
  deleteTask,
  listTasks,
  reorderTasks,
  updateTask
} from "../../services/job-tasks.service.js";
import {
  getJobPreparationStatus,
  getJobServiceBrief
} from "../../services/job-service-brief.service.js";
import {
  addNote,
  addPhoto,
  assignTechnician,
  completeJob,
  createJob,
  getJob,
  getJobNotes,
  getJobPhotos,
  getJobTimeline,
  listJobs,
  patchJob,
  scheduleJob,
  transitionStatus,
} from "../../services/job.service.js";
import type {
  AssignTechnicianBody,
  JobProductIdParams,
  JobIdParams,
  ReorderTasksBody,
  TaskIdParams,
  TransitionStatusBody
} from "./schemas.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toJobListItemResponse(job: JobListItem) {
  return {
    id: job.id,
    jobNumber: job.jobNumber,
    title: job.title,
    type: job.type,
    priority: job.priority,
    status: job.status,
    scheduledStart: toIsoString(job.scheduledStart),
    scheduledEnd: toIsoString(job.scheduledEnd),
    customer: {
      id: job.customer.id,
      firstName: job.customer.firstName,
      lastName: job.customer.lastName,
      phone: job.customer.phone
    },
    property: job.property
      ? {
          id: job.property.id,
          addressLine1: job.property.addressLine1,
          city: job.property.city,
          state: job.property.state
        }
      : null,
    technician: job.technician
      ? {
          id: job.technician.id,
          firstName: job.technician.firstName,
          lastName: job.technician.lastName,
          phone: job.technician.phone,
          calendarColor: job.technician.calendarColor
        }
      : null,
    createdAt: job.createdAt.toISOString()
  };
}

function toJobDetailResponse(job: JobDetail) {
  return {
    id: job.id,
    companyId: job.companyId,
    jobNumber: job.jobNumber,
    customerId: job.customerId,
    propertyId: job.propertyId,
    assetId: job.assetId,
    technicianId: job.technicianId,
    assignedById: job.assignedById,
    type: job.type,
    priority: job.priority,
    status: job.status,
    leadSource: job.leadSource,
    title: job.title,
    description: job.description,
    scheduledStart: toIsoString(job.scheduledStart),
    scheduledEnd: toIsoString(job.scheduledEnd),
    scheduledDurationMinutes: job.scheduledDurationMinutes,
    actualStart: toIsoString(job.actualStart),
    actualEnd: toIsoString(job.actualEnd),
    techNotes: job.techNotes,
    completionNotes: job.completionNotes,
    signatureUrl: job.signatureUrl,
    signedAt: toIsoString(job.signedAt),
    signedByName: job.signedByName,
    estimateTotal: job.estimateTotal,
    invoiceTotal: job.invoiceTotal,
    amountPaid: job.amountPaid,
    maintenancePlanId: job.maintenancePlanId,
    parentJobId: job.parentJobId,
    tags: job.tags ?? [],
    customer: {
      id: job.customer.id,
      firstName: job.customer.firstName,
      lastName: job.customer.lastName,
      phone: job.customer.phone,
      email: job.customer.email ?? null
    },
    property: job.property
      ? {
          id: job.property.id,
          addressLine1: job.property.addressLine1,
          city: job.property.city,
          state: job.property.state,
          zip: job.property.zip ?? "",
          accessNotes: job.property.accessNotes ?? null
        }
      : null,
    asset: job.asset
      ? {
          id: job.asset.id,
          name: job.asset.name,
          assetType: job.asset.assetType,
          brand: job.asset.brand,
          model: job.asset.model,
          installDate: job.asset.installDate,
          lastServiceDate: job.asset.lastServiceDate
        }
      : null,
    technician: job.technician
      ? {
          id: job.technician.id,
          firstName: job.technician.firstName,
          lastName: job.technician.lastName,
          phone: job.technician.phone,
          calendarColor: job.technician.calendarColor
        }
      : null,
    availableTransitions: job.availableTransitions,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    deletedAt: toIsoString(job.deletedAt)
  };
}

function toJobNoteResponse(note: JobNote) {
  return {
    id: note.id,
    companyId: note.companyId,
    jobId: note.jobId,
    authorId: note.authorId,
    content: note.content,
    noteKind: note.noteKind,
    isInternal: note.isInternal,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
    deletedAt: toIsoString(note.deletedAt)
  };
}

function toJobPhotoResponse(photo: JobPhoto) {
  return {
    id: photo.id,
    companyId: photo.companyId,
    jobId: photo.jobId,
    uploadedById: photo.uploadedById,
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
    caption: photo.caption,
    takenAt: toIsoString(photo.takenAt),
    photoType: photo.photoType,
    createdAt: photo.createdAt.toISOString(),
    updatedAt: photo.updatedAt.toISOString(),
    deletedAt: toIsoString(photo.deletedAt)
  };
}

function toJobTaskResponse(task: JobTask) {
  return {
    id: task.id,
    companyId: task.companyId,
    jobId: task.jobId,
    assignedToId: task.assignedToId,
    title: task.title,
    description: task.description,
    status: task.status,
    isRequired: task.isRequired ?? false,
    completedAt: toIsoString(task.completedAt),
    completedById: task.completedById,
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: task.actualMinutes,
    sortOrder: task.sortOrder ?? 0,
    notes: task.notes,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    deletedAt: toIsoString(task.deletedAt)
  };
}

function toJobProductResponse(product: JobProduct) {
  return {
    id: product.id,
    companyId: product.companyId,
    jobId: product.jobId,
    productCatalogId: product.productCatalogId,
    name: product.name,
    description: product.description,
    category: product.category,
    quantity: product.quantity,
    unitPrice: product.unitPrice,
    total: product.total,
    isTaxable: product.isTaxable,
    addedById: product.addedById,
    isUpsell: product.isUpsell ?? false,
    upsellApproved: product.upsellApproved ?? false,
    upsellApprovedAt: toIsoString(product.upsellApprovedAt),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    deletedAt: toIsoString(product.deletedAt)
  };
}

function toActivityEventResponse(event: ActivityEvent) {
  return {
    id: event.id,
    companyId: event.companyId,
    eventType: event.eventType,
    actorId: event.actorId,
    actorType: event.actorType,
    actorName: event.actorName,
    entityType: event.entityType,
    entityId: event.entityId,
    customerId: event.customerId,
    jobId: event.jobId,
    estimateId: event.estimateId,
    invoiceId: event.invoiceId,
    payload: event.payload,
    summary: event.summary,
    occurredAt: event.occurredAt.toISOString()
  };
}

export async function listJobsHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const query = request.query as ListJobsQuery;
  if (isTechnicianCaller(request)) {
    // Technicians only ever see their own jobs; any client technicianId is overridden.
    const ownTechnicianId = await resolveCallerTechnicianId(request);
    if (!ownTechnicianId) {
      return reply.send({ data: [], total: 0, page: query.page ?? 1, limit: query.limit ?? 0, totalPages: 0 });
    }
    query.technicianId = ownTechnicianId;
  }
  const result = await listJobs(request.company.id, query);

  return reply.send({
    data: result.data.map((job) => toJobListItemResponse(job)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  });
}

export async function createJobHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const job = await createJob(request.company.id, request.user.id, request.body as CreateJobInput);
  const detail = await getJob(request.company.id, job.id);

  return reply.status(201).send({
    job: toJobDetailResponse(await withSignedJobSignature(detail))
  });
}

export async function getJobHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  await assertTechnicianAssignedToJob(request, params.id, { onUnassigned: "not_found" });
  const job = await getJob(request.company.id, params.id);

  return reply.send({
    job: toJobDetailResponse(await withSignedJobSignature(job))
  });
}

export async function updateJobHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const detail = await patchJob(request.company.id, request.user.id, params.id, request.body as UpdateJobInput);

  return reply.send({
    job: toJobDetailResponse(await withSignedJobSignature(detail))
  });
}

export async function transitionStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const body = request.body as TransitionStatusBody;
  await transitionStatus(request.company.id, request.user.id, params.id, body.status, body.reason);
  const detail = await getJob(request.company.id, params.id);

  return reply.send({
    job: toJobDetailResponse(await withSignedJobSignature(detail))
  });
}

export async function assignTechnicianHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const body = request.body as AssignTechnicianBody;
  await assignTechnician(request.company.id, request.user.id, params.id, body.technicianId);
  const detail = await getJob(request.company.id, params.id);

  return reply.send({
    job: toJobDetailResponse(await withSignedJobSignature(detail))
  });
}

export async function scheduleJobHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  await scheduleJob(request.company.id, request.user.id, params.id, request.body as ScheduleJobInput);
  const detail = await getJob(request.company.id, params.id);

  return reply.send({
    job: toJobDetailResponse(await withSignedJobSignature(detail))
  });
}

export async function completeJobHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  await assertTechnicianAssignedToJob(request, params.id);
  await completeJob(request.company.id, request.user.id, params.id, request.body as CompleteJobInput);
  const detail = await getJob(request.company.id, params.id);

  return reply.send({
    job: toJobDetailResponse(await withSignedJobSignature(detail))
  });
}

export async function addNoteHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const note = await addNote(request.company.id, request.user.id, params.id, request.body as AddNoteInput);

  return reply.status(201).send({
    note: toJobNoteResponse(note)
  });
}

export async function getNotesHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const notes = await getJobNotes(request.company.id, params.id);

  return reply.send({
    notes: notes.map((note) => toJobNoteResponse(note))
  });
}

export async function getJobServiceBriefHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const brief = await getJobServiceBrief(request.company.id, params.id);

  return reply.send({ brief });
}

export async function getJobPreparationStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const status = await getJobPreparationStatus(request.company.id, params.id);

  return reply.send({ preparation: status });
}

export async function addPhotoHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const photo = await addPhoto(request.company.id, request.user.id, params.id, request.body as AddPhotoInput);

  return reply.status(201).send({
    photo: toJobPhotoResponse(photo)
  });
}

export async function getPhotosHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const photos = await getJobPhotos(request.company.id, params.id);

  return reply.send({
    photos: photos.map((photo) => toJobPhotoResponse(photo))
  });
}

export async function listTasksHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const tasks = await listTasks(request.company.id, params.id);

  return reply.send({
    tasks: tasks.map((task) => toJobTaskResponse(task))
  });
}

export async function createTaskHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const task = await createTask(request.company.id, params.id, request.body as CreateTaskInput);

  return reply.status(201).send({
    task: toJobTaskResponse(task)
  });
}

export async function updateTaskHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as TaskIdParams;
  const task = await updateTask(
    request.company.id,
    params.id,
    params.taskId,
    request.body as UpdateTaskInput
  );

  return reply.send({
    task: toJobTaskResponse(task)
  });
}

export async function completeTaskHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as TaskIdParams;
  await assertTechnicianAssignedToJob(request, params.id);
  const task = await completeTask(request.company.id, params.id, params.taskId, request.user.id);

  return reply.send({
    task: toJobTaskResponse(task)
  });
}

export async function deleteTaskHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as TaskIdParams;
  await deleteTask(request.company.id, params.id, params.taskId);

  return reply.send({
    success: true
  });
}

export async function reorderTasksHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const body = request.body as ReorderTasksBody;
  await reorderTasks(request.company.id, params.id, body.orderedIds);

  return reply.send({
    success: true
  });
}

export async function listJobProductsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const products = await listJobProducts(request.company.id, params.id);

  return reply.send({
    products: products.map((product) => toJobProductResponse(product))
  });
}

export async function addJobProductHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const product = await addProduct(
    request.company.id,
    params.id,
    request.user.id,
    request.body as AddJobProductInput
  );

  return reply.status(201).send({
    product: toJobProductResponse(product)
  });
}

export async function updateJobProductHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobProductIdParams;
  const product = await updateJobProduct(
    request.company.id,
    params.id,
    params.productId,
    request.body as UpdateJobProductInput
  );

  return reply.send({
    product: toJobProductResponse(product)
  });
}

export async function removeJobProductHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobProductIdParams;
  await removeJobProduct(request.company.id, params.id, params.productId);

  return reply.send({
    success: true
  });
}

export async function approveUpsellHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobProductIdParams;
  const product = await approveUpsell(request.company.id, params.id, params.productId, request.user.id);

  return reply.send({
    product: toJobProductResponse(product)
  });
}

export async function getJobTimelineHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as JobIdParams;
  const timeline = await getJobTimeline(request.company.id, params.id);

  return reply.send({
    activity: timeline.map((event) => toActivityEventResponse(event))
  });
}
