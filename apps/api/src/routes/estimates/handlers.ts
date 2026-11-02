import type { FastifyReply, FastifyRequest } from "fastify";

import type {
  AddEstimateItemInput,
  CreateEstimateInput,
  EstimateDetail,
  EstimateItem,
  EstimateListItem,
  Job,
  ListEstimatesQuery,
  UpdateEstimateInput,
  UpdateEstimateItemInput
} from "@fsm/types";

import {
  approveEstimate,
  convertToJob,
  createEstimate,
  declineEstimate,
  deleteEstimate,
  getEstimate,
  getEstimateForActor,
  listEstimates,
  reviseEstimate,
  sendEstimate,
  updateEstimate
} from "../../services/estimate.service.js";
import {
  addItem,
  removeItem,
  updateItem
} from "../../services/estimate-items.service.js";
import type {
  DeclineEstimateBody,
  EstimateIdParams,
  EstimateItemIdParams
} from "./schemas.js";

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toEstimateItemResponse(item: EstimateItem) {
  return {
    id: item.id,
    estimateId: item.estimateId,
    companyId: item.companyId,
    name: item.name,
    description: item.description,
    itemType: item.itemType,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
    isTaxable: item.isTaxable,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    deletedAt: toIsoString(item.deletedAt)
  };
}

function toEstimateListItemResponse(estimate: EstimateListItem) {
  return {
    id: estimate.id,
    estimateNumber: estimate.estimateNumber,
    title: estimate.title,
    status: estimate.status,
    tierLabel: estimate.tierLabel,
    tierGroupId: estimate.tierGroupId,
    total: estimate.total,
    subtotal: estimate.subtotal,
    customer: estimate.customer,
    sentAt: toIsoString(estimate.sentAt),
    expiresAt: toIsoString(estimate.expiresAt),
    approvedAt: toIsoString(estimate.approvedAt),
    declinedAt: toIsoString(estimate.declinedAt),
    createdAt: estimate.createdAt.toISOString()
  };
}

function toEstimateDetailResponse(estimate: EstimateDetail, redactApprovalToken = false) {
  return {
    id: estimate.id,
    companyId: estimate.companyId,
    estimateNumber: estimate.estimateNumber,
    jobId: estimate.jobId,
    customerId: estimate.customerId,
    propertyId: estimate.propertyId,
    createdById: estimate.createdById,
    status: estimate.status,
    tierLabel: estimate.tierLabel,
    tierGroupId: estimate.tierGroupId,
    isSelectedTier: estimate.isSelectedTier,
    subtotal: estimate.subtotal,
    taxRate: estimate.taxRate,
    taxAmount: estimate.taxAmount,
    discountAmount: estimate.discountAmount,
    total: estimate.total,
    title: estimate.title,
    messageToCustomer: estimate.messageToCustomer,
    internalNotes: estimate.internalNotes,
    approvalToken: redactApprovalToken ? null : estimate.approvalToken,
    approvedAt: toIsoString(estimate.approvedAt),
    approvedByName: estimate.approvedByName,
    approvedSignatureUrl: estimate.approvedSignatureUrl,
    declinedAt: toIsoString(estimate.declinedAt),
    declineReason: estimate.declineReason,
    expiresAt: toIsoString(estimate.expiresAt),
    sentAt: toIsoString(estimate.sentAt),
    viewedAt: toIsoString(estimate.viewedAt),
    followUpSentAt: toIsoString(estimate.followUpSentAt),
    financingOffered: estimate.financingOffered,
    customer: estimate.customer,
    property: estimate.property,
    job: estimate.job,
    items: estimate.items.map((item) => toEstimateItemResponse(item)),
    createdAt: estimate.createdAt.toISOString(),
    updatedAt: estimate.updatedAt.toISOString(),
    deletedAt: toIsoString(estimate.deletedAt)
  };
}

function toJobResponse(job: Job) {
  return {
    ...job,
    scheduledStart: toIsoString(job.scheduledStart),
    scheduledEnd: toIsoString(job.scheduledEnd),
    actualStart: toIsoString(job.actualStart),
    actualEnd: toIsoString(job.actualEnd),
    signedAt: toIsoString(job.signedAt),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    deletedAt: toIsoString(job.deletedAt)
  };
}

export async function listEstimatesHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const result = await listEstimates(request.company.id, request.query as ListEstimatesQuery);

  return reply.send({
    data: result.data.map((estimate) => toEstimateListItemResponse(estimate)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  });
}

export async function createEstimateHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const estimate = await createEstimate(request.company.id, request.user.id, request.body as CreateEstimateInput);
  const detail = await getEstimate(request.company.id, estimate.id);

  return reply.status(201).send({
    estimate: toEstimateDetailResponse(detail)
  });
}

export async function getEstimateHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  const estimate = await getEstimateForActor({
    companyId: request.company.id, userId: request.user.id, role: request.user.role
  }, params.id);

  return reply.send({
    estimate: toEstimateDetailResponse(estimate, request.user.role === "technician")
  });
}

export async function updateEstimateHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  await updateEstimate(request.company.id, request.user.id, params.id, request.body as UpdateEstimateInput);
  const detail = await getEstimate(request.company.id, params.id);

  return reply.send({
    estimate: toEstimateDetailResponse(detail)
  });
}

export async function deleteEstimateHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  await deleteEstimate(request.company.id, request.user.id, params.id);
  return reply.status(204).send();
}

export async function sendEstimateHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  await sendEstimate(request.company.id, request.user.id, params.id);
  const detail = await getEstimate(request.company.id, params.id);

  return reply.send({
    estimate: toEstimateDetailResponse(detail)
  });
}

export async function approveEstimateHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  await approveEstimate(request.company.id, request.user.id, params.id);
  const detail = await getEstimate(request.company.id, params.id);

  return reply.send({
    estimate: toEstimateDetailResponse(detail)
  });
}

export async function declineEstimateHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  const body = request.body as DeclineEstimateBody;
  await declineEstimate(request.company.id, request.user.id, params.id, body.reason);
  const detail = await getEstimate(request.company.id, params.id);

  return reply.send({
    estimate: toEstimateDetailResponse(detail)
  });
}

export async function reviseEstimateHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  const estimate = await reviseEstimate(request.company.id, request.user.id, params.id);
  const detail = await getEstimate(request.company.id, estimate.id);

  return reply.send({
    estimate: toEstimateDetailResponse(detail)
  });
}

export async function convertEstimateHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  const job = await convertToJob(request.company.id, request.user.id, params.id);

  return reply.status(201).send({
    job: toJobResponse(job)
  });
}

export async function listEstimateItemsHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  const detail = await getEstimateForActor({
    companyId: request.company.id, userId: request.user.id, role: request.user.role
  }, params.id);

  return reply.send({
    items: detail.items.map((item) => toEstimateItemResponse(item))
  });
}

export async function addEstimateItemHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateIdParams;
  const item = await addItem(request.company.id, params.id, request.body as AddEstimateItemInput);

  return reply.status(201).send({
    item: toEstimateItemResponse(item)
  });
}

export async function updateEstimateItemHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateItemIdParams;
  const item = await updateItem(request.company.id, params.id, params.itemId, request.body as UpdateEstimateItemInput);

  return reply.send({
    item: toEstimateItemResponse(item)
  });
}

export async function deleteEstimateItemHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as EstimateItemIdParams;
  await removeItem(request.company.id, params.id, params.itemId);

  return reply.status(204).send();
}
