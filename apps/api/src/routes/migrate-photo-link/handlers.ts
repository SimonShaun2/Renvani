import type { FastifyReply, FastifyRequest } from "fastify";

import type { ApplyMigratePhotoLinkDecisionsBody } from "@fsm/types";

import { uploadMigratePhotoBatch, getMigratePhotoUploadStatus } from "../../services/migrate-photo-batch-upload.service.js";
import {
  applyMigratePhotoLinkDecisions,
  commitMigratePhotoLinks,
  getMigratePhotoLinkPreview
} from "../../services/migrate-photo-link-commit.service.js";

export async function getPhotoUploadStatusHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { bundleId: string };
  const status = await getMigratePhotoUploadStatus(request.company.id, request.user.id, params.bundleId);
  return reply.send(status);
}

export async function uploadPhotoBatchHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { bundleId: string };
  const query = request.query as { clientBatchId: string };
  const files: Array<{ relativePath: string; mimeType: string; buffer: Buffer }> = [];

  for await (const part of request.parts()) {
    if (part.type !== "file") {
      continue;
    }

    const relativePath =
      typeof part.fieldname === "string" && part.fieldname.length > 0
        ? part.fieldname
        : part.filename;
    const buffer = await part.toBuffer();

    files.push({
      relativePath,
      mimeType: part.mimetype,
      buffer
    });
  }

  const status = await uploadMigratePhotoBatch(
    request.company.id,
    request.user.id,
    params.bundleId,
    query.clientBatchId,
    files
  );

  return reply.code(201).send(status);
}

export async function getPhotoLinkPreviewHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { bundleId: string };
  const preview = await getMigratePhotoLinkPreview(request.company.id, params.bundleId);
  return reply.send(preview);
}

export async function applyPhotoLinkDecisionsHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { bundleId: string };
  const body = request.body as ApplyMigratePhotoLinkDecisionsBody;
  const preview = await applyMigratePhotoLinkDecisions(request.company.id, params.bundleId, body);
  return reply.send(preview);
}

export async function commitPhotoLinksHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { bundleId: string };
  const result = await commitMigratePhotoLinks(request.company.id, request.user.id, params.bundleId);
  return reply.send(result);
}
