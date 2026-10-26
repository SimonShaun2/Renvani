import type { FastifyReply, FastifyRequest } from "fastify";

import type {
  CreateVipMembershipTierInput,
  UpdateVipMembershipTierInput,
  VipMembershipPolicyInput
} from "@fsm/types";

import {
  createVipMembershipTier,
  deleteVipMembershipTier,
  listVipMembershipTiers,
  updateVipMembershipTier
} from "../../services/vip-membership-tier.service.js";
import { loadVipMembershipPolicy, updateVipMembershipPolicy } from "../../services/vip-membership-policy.service.js";
import {
  cancelVipMembership,
  createVipMembershipCheckout,
  createVipMembershipJoinLink,
  listVipMemberships,
  pauseVipMembership
} from "../../services/vip-membership.service.js";

function serializeTier(tier: Awaited<ReturnType<typeof listVipMembershipTiers>>[number]) {
  return {
    ...tier,
    createdAt: tier.createdAt.toISOString(),
    updatedAt: tier.updatedAt.toISOString(),
    deletedAt: tier.deletedAt ? tier.deletedAt.toISOString() : null
  };
}

export async function listTiersHandler(request: FastifyRequest, reply: FastifyReply) {
  const tiers = await listVipMembershipTiers(request.company.id);
  return reply.send({ tiers: tiers.map(serializeTier) });
}

export async function createTierHandler(request: FastifyRequest, reply: FastifyReply) {
  const tier = await createVipMembershipTier(
    request.company.id,
    request.user.id,
    request.body as CreateVipMembershipTierInput
  );
  return reply.code(201).send({ tier: serializeTier(tier) });
}

export async function updateTierHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const tier = await updateVipMembershipTier(
    request.company.id,
    request.user.id,
    params.id,
    request.body as UpdateVipMembershipTierInput
  );
  return reply.send({ tier: serializeTier(tier) });
}

export async function deleteTierHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  await deleteVipMembershipTier(request.company.id, request.user.id, params.id);
  return reply.code(204).send();
}

export async function getPolicyHandler(request: FastifyRequest, reply: FastifyReply) {
  const policy = await loadVipMembershipPolicy(request.company.id);
  return reply.send({ policy });
}

export async function updatePolicyHandler(request: FastifyRequest, reply: FastifyReply) {
  const policy = await updateVipMembershipPolicy(
    request.company.id,
    request.user.id,
    request.body as VipMembershipPolicyInput
  );
  return reply.send({ policy });
}

export async function listMembershipsHandler(request: FastifyRequest, reply: FastifyReply) {
  const memberships = await listVipMemberships(request.company.id);
  return reply.send({ memberships });
}

export async function createCheckoutHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as { customerId: string; vipTierId: string };
  const result = await createVipMembershipCheckout(
    request.company.id,
    body.customerId,
    body.vipTierId
  );
  return reply.code(201).send(result);
}

export async function createJoinLinkHandler(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as { customerId: string; vipTierId: string };
  const result = await createVipMembershipJoinLink(
    request.company.id,
    body.customerId,
    body.vipTierId
  );
  return reply.code(201).send(result);
}

export async function pauseMembershipHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  await pauseVipMembership(request.company.id, request.user.id, params.id);
  return reply.code(204).send();
}

export async function cancelMembershipHandler(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string };
  const body = (request.body ?? {}) as { cancelImmediately?: boolean };
  await cancelVipMembership(
    request.company.id,
    request.user.id,
    params.id,
    body.cancelImmediately ?? false
  );
  return reply.code(204).send();
}
