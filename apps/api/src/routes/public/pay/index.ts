import type { FastifyPluginAsync } from "fastify";

import { getPublicPaymentLinkHandler } from "./handlers.js";
import { createPublicHostedCheckoutHandler } from "./hosted-checkout-handler.js";
import {
  getPublicInvoiceReceiptHandler,
  getPublicInvoiceReceiptPdfHandler
} from "./receipt-handlers.js";
import {
  createPublicHostedCheckoutSchema,
  getPublicInvoiceReceiptSchema,
  getPublicPaymentLinkSchema,
  publicPaymentValidation
} from "./schemas.js";

const publicPayRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/:token", {
    preValidation: publicPaymentValidation,
    schema: getPublicPaymentLinkSchema
  }, getPublicPaymentLinkHandler);

  fastify.get("/:token/receipt", {
    preValidation: publicPaymentValidation,
    schema: getPublicInvoiceReceiptSchema
  }, getPublicInvoiceReceiptHandler);

  fastify.get("/:token/receipt.pdf", {
    preValidation: publicPaymentValidation
  }, getPublicInvoiceReceiptPdfHandler);

  // Stripe-hosted Checkout fallback (embedded unusable, e.g. no publishable key, or payer opts in).
  fastify.post("/:token/hosted-checkout", {
    preValidation: publicPaymentValidation,
    schema: createPublicHostedCheckoutSchema
  }, createPublicHostedCheckoutHandler);
};

export default publicPayRoutes;
