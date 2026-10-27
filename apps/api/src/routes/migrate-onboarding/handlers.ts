import type { FastifyReply, FastifyRequest } from "fastify";

import type {
  ApplyMigrateDedupeDecisionsBody,
  ConfirmImportFileLinkDecisionsBody,
  CreateMigrateOnboardingSessionBody,
  LinkMigrateOnboardingFilesBody,
  MigrateSourceSystemId,
  SetMigrateOnboardingSourceBody
} from "@fsm/types";

import {
  confirmMigrateImportFileLinkDecisions,
  getMigrateImportFileLinkPreview,
  runMigrateImportFileLink
} from "../../services/migrate-import-file-link.service.js";
import {
  acknowledgeMigrateOnboardingPreview,
  applyMigrateDedupeDecisions,
  commitMigrateOnboardingBundle,
  confirmMigrateOnboardingMappings,
  createMigrateOnboardingSession,
  getActiveMigrateOnboardingBundle,
  getMigrateDedupePreview,
  getMigrateRelationalPreview,
  getMigrateOnboardingBundle,
  linkMigrateOnboardingFiles,
  listMigrateOnboardingSources,
  setMigrateOnboardingSource
} from "../../services/migrate-onboarding.service.js";
import { getMigrateOnboardingIngestStatus } from "../../services/migrate-onboarding-ingest-status.service.js";

export async function listMigrateOnboardingSourcesHandler(
  _request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  return reply.send({ sources: listMigrateOnboardingSources() });
}

export async function createMigrateOnboardingSessionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const body = request.body as CreateMigrateOnboardingSessionBody;
  const bundle = await createMigrateOnboardingSession(
    request.company.id,
    request.user.id,
    body.resumeActive ?? false
  );
  return reply.code(201).send(bundle);
}

export async function getActiveMigrateOnboardingSessionHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const bundle = await getActiveMigrateOnboardingBundle(request.company.id);
  if (!bundle) {
    return reply.code(404).send({
      error: "NOT_FOUND",
      message: "No active onboarding session"
    });
  }
  return reply.send(bundle);
}

export async function getMigrateOnboardingBundleHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const bundle = await getMigrateOnboardingBundle(request.company.id, bundleId);
  return reply.send(bundle);
}

export async function setMigrateOnboardingSourceHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const body = request.body as SetMigrateOnboardingSourceBody;
  const bundle = await setMigrateOnboardingSource(
    request.company.id,
    request.user.id,
    bundleId,
    body.sourceSystem as MigrateSourceSystemId
  );
  return reply.send(bundle);
}

export async function linkMigrateOnboardingFilesHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const body = request.body as LinkMigrateOnboardingFilesBody;
  const bundle = await linkMigrateOnboardingFiles(request.company.id, request.user.id, bundleId, body);
  return reply.send(bundle);
}

export async function confirmMigrateOnboardingMappingsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const bundle = await confirmMigrateOnboardingMappings(request.company.id, request.user.id, bundleId);
  return reply.send(bundle);
}

export async function acknowledgeMigrateOnboardingPreviewHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const bundle = await acknowledgeMigrateOnboardingPreview(request.company.id, request.user.id, bundleId);
  return reply.send(bundle);
}

export async function getMigrateDedupePreviewHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const preview = await getMigrateDedupePreview(request.company.id, bundleId);
  return reply.send(preview);
}

export async function getMigrateRelationalPreviewHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const preview = await getMigrateRelationalPreview(request.company.id, bundleId);
  return reply.send(preview);
}

export async function applyMigrateDedupeDecisionsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const body = request.body as ApplyMigrateDedupeDecisionsBody;
  const bundle = await applyMigrateDedupeDecisions(request.company.id, request.user.id, bundleId, body);
  return reply.send(bundle);
}

export async function runMigrateImportFileLinkHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const preview = await runMigrateImportFileLink(request.company.id, request.user.id, bundleId);
  return reply.code(202).send(preview);
}

export async function getMigrateImportFileLinkPreviewHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const preview = await getMigrateImportFileLinkPreview(request.company.id, bundleId);
  return reply.send(preview);
}

export async function confirmMigrateImportFileLinkHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const body = request.body as ConfirmImportFileLinkDecisionsBody;
  const preview = await confirmMigrateImportFileLinkDecisions(
    request.company.id,
    request.user.id,
    bundleId,
    body
  );
  return reply.send(preview);
}

export async function getMigrateOnboardingIngestStatusHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const status = await getMigrateOnboardingIngestStatus(request.company.id, bundleId);
  return reply.send(status);
}

export async function commitMigrateOnboardingBundleHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const { bundleId } = request.params as { bundleId: string };
  const result = await commitMigrateOnboardingBundle(request.company.id, request.user.id, bundleId);
  return reply.send(result);
}
