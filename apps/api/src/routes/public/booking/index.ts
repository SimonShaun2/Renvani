import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";

import {
  checkPublicBookingIpRateLimit,
  checkPublicBookingManageTokenRateLimit,
  checkPublicSlotHoldIpAndCompanyRateLimit,
  checkPublicSlotHoldReferenceRateLimit
} from "../../../lib/public-booking-rate-limit.js";
import {
  captureBookingInterestHandler,
  checkZipCoverageHandler,
  getBookingConfirmationHandler,
  getPublicAvailabilityHandler,
  getPublicBookingSettingsHandler,
  confirmPublicBookingSlotHandler,
  holdPublicBookingSlotHandler,
  inspectPublicBookingHoldTokenHandler,
  submitBookingRequestHandler
} from "./handlers.js";
import {
  cancelBookingSelfServiceHandler,
  getBookingSelfServiceAvailabilityHandler,
  getBookingSelfServiceHandler,
  holdBookingSelfServiceSlotHandler,
  rescheduleBookingSelfServiceHandler
} from "./manage-handlers.js";
import {
  bookingManageAvailabilityValidation,
  bookingManageCancelValidation,
  bookingManageHoldValidation,
  bookingManageRescheduleValidation,
  bookingManageTokenValidation
} from "./manage-schemas.js";
import {
  availabilityRouteSchema,
  availabilityValidation,
  bookingConfirmationRouteSchema,
  bookingConfirmationValidation,
  bookingSlugValidation,
  emailCaptureRouteSchema,
  emailCaptureValidation,
  publicBookingRouteSchema,
  publicConfirmBookingSlotRouteSchema,
  publicConfirmBookingSlotValidation,
  publicHoldBookingSlotValidation,
  publicInspectHoldTokenRouteSchema,
  publicInspectHoldTokenValidation,
  publicSlotHoldRouteSchema,
  submitBookingRouteSchema,
  submitBookingValidation,
  zipCheckRouteSchema,
  zipCheckValidation
} from "./schemas.js";

async function bookingRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.method !== "POST") {
    return;
  }

  const allowed = await checkPublicBookingIpRateLimit(request.ip);

  if (!allowed) {
    await reply.status(429).send({
      error: "RATE_LIMITED",
      message: "Too many booking submissions. Please try again later.",
      requestId: request.id
    });
    return;
  }
}

async function bookingManageRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const allowed = await checkPublicBookingManageTokenRateLimit(request.ip);

  if (!allowed) {
    await reply.status(429).send({
      error: "RATE_LIMITED",
      message: "Too many manage-link requests. Please try again later.",
      requestId: request.id
    });
    return;
  }
}

async function bookingSlotHoldReferenceRateLimit(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (request.method !== "POST") {
    return;
  }

  const params = request.params as { slug?: string; ref?: string };
  const slug = params.slug?.trim() ?? "";
  const ref = params.ref?.trim() ?? "";

  if (slug.length === 0 || ref.length === 0) {
    return;
  }

  const allowed = await checkPublicSlotHoldReferenceRateLimit(slug, ref);

  if (!allowed) {
    await reply.status(429).send({
      error: "RATE_LIMITED",
      message: "Too many slot hold attempts for this booking reference. Please try again later.",
      requestId: request.id
    });
    return;
  }
}

/** FS-66 — per-IP and per-company limits on slot-hold/confirm, with Retry-After. */
async function bookingSlotHoldIpCompanyRateLimit(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (request.method !== "POST") {
    return;
  }

  const params = request.params as { slug?: string };
  const slug = params.slug?.trim() ?? "";

  if (slug.length === 0) {
    return;
  }

  const result = await checkPublicSlotHoldIpAndCompanyRateLimit(request.ip, slug);

  if (!result.allowed) {
    reply.header("Retry-After", String(result.retryAfterSeconds));
    await reply.status(429).send({
      error: "RATE_LIMITED",
      message: "Too many slot hold attempts. Please try again later.",
      requestId: request.id
    });
    return;
  }
}

const publicBookingRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/:slug", {
    preValidation: [bookingSlugValidation],
    schema: publicBookingRouteSchema
  }, getPublicBookingSettingsHandler);

  fastify.post("/:slug/check-zip", {
    preValidation: [bookingRateLimit, zipCheckValidation],
    schema: zipCheckRouteSchema
  }, checkZipCoverageHandler);

  fastify.post("/:slug/email-capture", {
    preValidation: [bookingRateLimit, emailCaptureValidation],
    schema: emailCaptureRouteSchema
  }, captureBookingInterestHandler);

  fastify.get("/:slug/availability", {
    preValidation: [availabilityValidation],
    schema: availabilityRouteSchema
  }, getPublicAvailabilityHandler);

  fastify.post("/:slug/submit", {
    preValidation: [bookingRateLimit, submitBookingValidation],
    schema: submitBookingRouteSchema
  }, submitBookingRequestHandler);

  fastify.get("/:slug/confirmation/:ref", {
    preValidation: [bookingConfirmationValidation],
    schema: bookingConfirmationRouteSchema
  }, getBookingConfirmationHandler);

  fastify.post("/:slug/requests/:ref/slot-hold", {
    preValidation: [bookingRateLimit, bookingSlotHoldIpCompanyRateLimit, bookingSlotHoldReferenceRateLimit, publicHoldBookingSlotValidation],
    schema: publicSlotHoldRouteSchema
  }, holdPublicBookingSlotHandler);

  fastify.post("/:slug/requests/:ref/confirm", {
    preValidation: [bookingRateLimit, bookingSlotHoldIpCompanyRateLimit, bookingSlotHoldReferenceRateLimit, publicConfirmBookingSlotValidation],
    schema: publicConfirmBookingSlotRouteSchema
  }, confirmPublicBookingSlotHandler);

  fastify.post("/:slug/hold-token/inspect", {
    preValidation: [bookingRateLimit, publicInspectHoldTokenValidation],
    schema: publicInspectHoldTokenRouteSchema
  }, inspectPublicBookingHoldTokenHandler);

  fastify.get("/manage/:token", {
    preValidation: [bookingManageRateLimit, bookingManageTokenValidation]
  }, getBookingSelfServiceHandler);

  fastify.get("/manage/:token/availability", {
    preValidation: [bookingManageRateLimit, bookingManageAvailabilityValidation]
  }, getBookingSelfServiceAvailabilityHandler);

  fastify.post("/manage/:token/slot-hold", {
    preValidation: [bookingManageRateLimit, bookingManageHoldValidation]
  }, holdBookingSelfServiceSlotHandler);

  fastify.post("/manage/:token/reschedule", {
    preValidation: [bookingManageRateLimit, bookingManageRescheduleValidation]
  }, rescheduleBookingSelfServiceHandler);

  fastify.post("/manage/:token/cancel", {
    preValidation: [bookingManageRateLimit, bookingManageCancelValidation]
  }, cancelBookingSelfServiceHandler);
};

export default publicBookingRoutes;
