import type { FastifyPluginAsync, FastifyReply } from "fastify";

import { env } from "@fsm/config";

import { verifySvixSignature } from "../../lib/svix-verify.js";
import { claimWebhookMessage, completeWebhookMessage, releaseWebhookMessage } from "../../lib/webhook-dedupe.js";
import {
  provisionClerkMembership,
  provisionClerkOrganization
} from "../../services/clerk-provisioning.service.js";
import {
  deactivateClerkMembership,
  deactivateClerkUser,
  readVerifiedPrimaryEmail,
  syncClerkUserUpdated
} from "../../services/clerk-user-sync.service.js";

interface ClerkWebhookEvent {
  type?: string;
  data?: Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const clerkWebhookRoutes: FastifyPluginAsync = async (fastify) => {
  // Keep the raw body: svix signs the exact bytes.
  fastify.addContentTypeParser("application/json", { parseAs: "string" }, (_request, body, done) => {
    done(null, body);
  });

  fastify.post("/clerk", async (request, reply) => {
    const secret = (process.env.CLERK_WEBHOOK_SECRET ?? env.CLERK_WEBHOOK_SECRET ?? "").trim();
    const rawBody = typeof request.body === "string" ? request.body : "";
    const header = (name: string): string | undefined => {
      const value = request.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };

    if (!secret) {
      return reply.status(503).send({ error: "WEBHOOK_DISABLED", message: "Clerk webhook is not configured" });
    }

    const valid = verifySvixSignature(
      secret,
      { id: header("svix-id"), timestamp: header("svix-timestamp"), signature: header("svix-signature") },
      rawBody
    );
    if (!valid) {
      return reply.status(400).send({ error: "INVALID_SIGNATURE", message: "Invalid webhook signature" });
    }

    let event: ClerkWebhookEvent;
    try {
      event = JSON.parse(rawBody) as ClerkWebhookEvent;
    } catch {
      return reply.status(400).send({ error: "INVALID_PAYLOAD", message: "Invalid JSON" });
    }

    const svixId = header("svix-id") ?? "";
    const claim = await claimWebhookMessage("clerk", svixId);
    if (claim.status === "duplicate") {
      return reply.send({ received: true, duplicate: true });
    }
    if (claim.status === "in_progress" || !claim.token) {
      // Another delivery of this message is still processing: non-2xx so the sender retries later.
      return reply.status(409).send({ error: "IN_PROGRESS", message: "Webhook message is already being processed" });
    }
    const token = claim.token;
    try {
      const result = await handleEvent(event, reply);
      await completeWebhookMessage("clerk", svixId, token);
      return result;
    } catch (error) {
      await releaseWebhookMessage("clerk", svixId, token);
      throw error;
    }
  });
};

async function handleEvent(event: ClerkWebhookEvent, reply: FastifyReply) {
  const data = event.data ?? {};

  if (event.type === "organization.created") {
    const company = await provisionClerkOrganization({ organizationId: str(data.id), name: str(data.name) });
    if (!company) {
      return reply.send({ received: true, skipped: true });
    }
    return reply.send({ received: true, companyId: company.id });
  }

  if (event.type === "organizationMembership.created") {
    const organization = (data.organization ?? {}) as Record<string, unknown>;
    const member = (data.public_user_data ?? {}) as Record<string, unknown>;
    const email = str(member.identifier);
    if (!str(organization.id) || !email) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD", message: "Missing organization or email" });
    }
    const result = await provisionClerkMembership({
      organizationId: str(organization.id),
      name: str(organization.name),
      email,
      firstName: str(member.first_name),
      lastName: str(member.last_name),
      clerkOrgRole: str(data.role) || null,
      clerkUserId: str(member.user_id) || null,
      // organizationMembership payloads carry no email-verification proof: never link existing users by email here.
      emailVerified: false
    });
    return reply.send({ received: true, ...result });
  }

  if (event.type === "user.updated") {
    const clerkUserId = str(data.id);
    if (!clerkUserId) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD", message: "Missing user id" });
    }
    const result = await syncClerkUserUpdated({ clerkUserId, verifiedPrimaryEmail: readVerifiedPrimaryEmail(data) });
    return reply.send({ received: true, ...result });
  }

  if (event.type === "user.deleted") {
    const clerkUserId = str(data.id);
    if (!clerkUserId) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD", message: "Missing user id" });
    }
    const result = await deactivateClerkUser(clerkUserId);
    return reply.send({ received: true, ...result });
  }

  if (event.type === "organizationMembership.deleted") {
    const organization = (data.organization ?? {}) as Record<string, unknown>;
    const member = (data.public_user_data ?? {}) as Record<string, unknown>;
    if (!str(organization.id) || !str(member.user_id)) {
      return reply.status(400).send({ error: "INVALID_PAYLOAD", message: "Missing organization or user id" });
    }
    const result = await deactivateClerkMembership(str(organization.id), str(member.user_id));
    return reply.send({ received: true, ...result });
  }

  // user.created carries no organization; the owner is provisioned on organizationMembership.created.
  return reply.send({ received: true, ignored: event.type ?? "unknown" });
}

export default clerkWebhookRoutes;
