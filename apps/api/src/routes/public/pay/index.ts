import type { FastifyPluginAsync } from "fastify";

import { getPublicPaymentLinkHandler } from "./handlers.js";
import {
  getPublicInvoiceReceiptHandler,
  getPublicInvoiceReceiptPdfHandler
} from "./receipt-handlers.js";
import { getPublicInvoiceReceiptSchema, getPublicPaymentLinkSchema, publicPaymentValidation } from "./schemas.js";

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
};

export default publicPayRoutes;
