import type { FastifyPluginAsync } from "fastify";

import { env } from "@fsm/config";

import { verifySvixSignature } from "../../lib/svix-verify.js";
import {
  provisionClerkMembership,
  provisionClerkOrganization
} from "../../services/clerk-provisioning.service.js";

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

    const data = event.data ?? {};

    if (event.type === "organization.created") {
      const company = await provisionClerkOrganization({ organizationId: str(data.id), name: str(data.name) });
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
        clerkOrgRole: str(data.role) || null
      });
      return reply.send({ received: true, ...result });
    }

    // user.created carries no organization; the owner is provisioned on organizationMembership.created.
    return reply.send({ received: true, ignored: event.type ?? "unknown" });
  });
};

export default clerkWebhookRoutes;
