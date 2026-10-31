import type {
  GrowthCheckReportDeliveryBody,
  GrowthCheckReportDraftApproveBody,
  GrowthCheckReportDraftCreateBody,
  GrowthCheckReportDraftEditBody,
  GrowthCheckReportExportFormat,
  GrowthCheckReportShareCreateBody
} from "@fsm/types";
import type { FastifyReply, FastifyRequest } from "fastify";

import {
  approveGrowthCheckReportDraft,
  createGrowthCheckReportDraft,
  createGrowthCheckReportShare,
  editGrowthCheckReportDraft,
  exportGrowthCheckReportDraft,
  getGrowthCheckReportDraftDetail,
  getGrowthCheckReportDraftForScan,
  listGrowthCheckReportShares,
  previewGrowthCheckReportDraft,
  requestGrowthCheckReportDelivery,
  revokeGrowthCheckReportShare,
  type GrowthCheckReportActor
} from "../../services/growth-check-report.service.js";

const actorOf = (request: FastifyRequest): GrowthCheckReportActor => ({
  companyId: request.company.id,
  userId: request.user.id,
  role: request.user.role
});
const scanIdOf = (request: FastifyRequest) => (request.params as { scanId: string }).scanId;
const draftIdOf = (request: FastifyRequest) => (request.params as { draftId: string }).draftId;
const shareIdOf = (request: FastifyRequest) => (request.params as { shareId: string }).shareId;

export async function createReportDraftHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await createGrowthCheckReportDraft(actorOf(request), scanIdOf(request), request.body as GrowthCheckReportDraftCreateBody);
  return reply.code(result.replayed ? 200 : 201).send(result);
}

export async function getScanReportDraftHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getGrowthCheckReportDraftForScan(request.company.id, scanIdOf(request)));
}

export async function getReportDraftHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await getGrowthCheckReportDraftDetail(request.company.id, draftIdOf(request)));
}

export async function editReportDraftHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await editGrowthCheckReportDraft(actorOf(request), draftIdOf(request), request.body as GrowthCheckReportDraftEditBody));
}

export async function approveReportDraftHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await approveGrowthCheckReportDraft(actorOf(request), draftIdOf(request), request.body as GrowthCheckReportDraftApproveBody));
}

export async function previewReportDraftHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.header("Cache-Control", "no-store").send(await previewGrowthCheckReportDraft(request.company.id, draftIdOf(request)));
}

export async function exportReportDraftHandler(request: FastifyRequest, reply: FastifyReply) {
  const { format } = request.query as { format?: GrowthCheckReportExportFormat };
  const file = await exportGrowthCheckReportDraft(request.company.id, draftIdOf(request), format ?? "markdown");
  return reply
    .header("Content-Type", file.contentType)
    .header("Content-Disposition", `attachment; filename="${file.filename}"`)
    .header("X-Content-Type-Options", "nosniff")
    .header("Cache-Control", "no-store")
    .header("X-Report-Version", String(file.version))
    .header("X-Report-Content-Hash", file.contentHash)
    .send(file.body);
}

export async function createReportShareHandler(request: FastifyRequest, reply: FastifyReply) {
  const result = await createGrowthCheckReportShare(actorOf(request), draftIdOf(request), request.body as GrowthCheckReportShareCreateBody);
  return reply.code(result.replayed ? 200 : 201).header("Cache-Control", "no-store").send(result);
}

export async function listReportSharesHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await listGrowthCheckReportShares(request.company.id, draftIdOf(request)));
}

export async function revokeReportShareHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.send(await revokeGrowthCheckReportShare(actorOf(request), shareIdOf(request)));
}

export async function reportDeliveryHandler(request: FastifyRequest, _reply: FastifyReply) {
  return requestGrowthCheckReportDelivery(actorOf(request), shareIdOf(request), request.body as GrowthCheckReportDeliveryBody);
}
