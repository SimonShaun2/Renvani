import type { FastifyPluginAsync, FastifyRequest } from "fastify";

import {
  getCustomerPortalAccount,
  listCustomerPortalEstimates,
  listCustomerPortalInvoices,
  listCustomerPortalVisits
} from "../../../services/customer-portal.service.js";
import {
  listCustomerPortalSections,
  loadCustomerPortalSection
} from "../../../services/customer-portal-sections.service.js";
import {
  getCustomerPortalAccountSchema,
  listCustomerPortalEstimatesSchema,
  getCustomerPortalNamedSectionSchema,
  getCustomerPortalSectionSchema,
  listCustomerPortalInvoicesSchema,
  listCustomerPortalSectionsSchema,
  listCustomerPortalVisitsSchema,
  parseCustomerPortalToken
} from "./schemas.js";

/**
 * The portal token travels in a header (not the path) so it never lands in access logs or
 * Referer headers, and stays clear of Fastify's 100-char path-param limit.
 */
export const CUSTOMER_PORTAL_TOKEN_HEADER = "x-customer-portal-token";
const tokenOf = (request: FastifyRequest) => parseCustomerPortalToken(request.headers[CUSTOMER_PORTAL_TOKEN_HEADER]);

/** FS-168: token-scoped customer portal reads. Every query is scoped to the token's company + customer. */
const publicCustomerPortalRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/me",
    { schema: getCustomerPortalAccountSchema },
    async (request, reply) => reply.send({ account: await getCustomerPortalAccount(tokenOf(request)) })
  );
  fastify.get(
    "/me/visits",
    { schema: listCustomerPortalVisitsSchema },
    async (request, reply) => reply.send({ visits: await listCustomerPortalVisits(tokenOf(request)) })
  );
  fastify.get(
    "/me/estimates",
    { schema: listCustomerPortalEstimatesSchema },
    async (request, reply) => reply.send({ estimates: await listCustomerPortalEstimates(tokenOf(request)) })
  );
  fastify.get(
    "/me/invoices",
    { schema: listCustomerPortalInvoicesSchema },
    async (request, reply) => reply.send({ invoices: await listCustomerPortalInvoices(tokenOf(request)) })
  );

  // Registry-driven portal sections (registerPortalSection): history, invoices, memberships, rebook, ...
  fastify.get(
    "/me/sections",
    { schema: listCustomerPortalSectionsSchema },
    async (request, reply) => reply.send({ sections: await listCustomerPortalSections(tokenOf(request)) })
  );
  fastify.get<{ Params: { key: string } }>(
    "/me/sections/:key",
    { schema: getCustomerPortalSectionSchema },
    async (request, reply) => reply.send(await loadCustomerPortalSection(tokenOf(request), request.params.key))
  );
  for (const key of ["history", "memberships", "rebook"]) {
    fastify.get(`/me/${key}`, { schema: getCustomerPortalNamedSectionSchema }, async (request, reply) =>
      reply.send(await loadCustomerPortalSection(tokenOf(request), key))
    );
  }
  fastify.get("/me/open-invoices", { schema: getCustomerPortalNamedSectionSchema }, async (request, reply) =>
    reply.send(await loadCustomerPortalSection(tokenOf(request), "invoices"))
  );
};

export default publicCustomerPortalRoutes;
