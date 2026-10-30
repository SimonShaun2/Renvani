import type { FastifyPluginAsync, preHandlerHookHandler } from "fastify";

import { requireRole } from "../../lib/authorize.js";
import { technicianOwnInvoiceJob } from "../../lib/technician-scope.js";

import {
  addInvoiceItemHandler,
  createInvoiceHandler,
  deleteInvoiceItemHandler,
  getInvoiceHandler,
  listInvoicePaymentsHandler,
  listInvoicesHandler,
  listPaymentsHandler,
  recordPaymentHandler,
  resendInvoiceReminderHandler,
  sendInvoiceHandler,
  updateInvoiceHandler,
  updateInvoiceItemHandler,
  voidInvoiceHandler
} from "./handlers.js";
import {
  addInvoiceItemSchema,
  addInvoiceItemValidation,
  createInvoiceSchema,
  createInvoiceValidation,
  deleteInvoiceItemSchema,
  getInvoiceSchema,
  invoiceIdValidation,
  invoiceItemIdValidation,
  listInvoicePaymentsSchema,
  listInvoicesSchema,
  listInvoicesValidation,
  listPaymentsSchema,
  listPaymentsValidation,
  recordPaymentSchema,
  recordPaymentValidation,
  resendInvoiceReminderSchema,
  sendInvoiceSchema,
  updateInvoiceItemRouteSchema,
  updateInvoiceItemValidation,
  updateInvoiceSchema,
  updateInvoiceValidation,
  voidInvoiceRouteSchema,
  voidInvoiceValidation
} from "./schemas.js";

const invoiceRoutes: FastifyPluginAsync = async (fastify) => {
  const authenticate = fastify.authenticate;

  // Security: every /invoices* route is staff-only; technicians get 403.
  // Appended after `authenticate` so unauthenticated requests still get 401.
  // Exception: routes that carry their own technician scope (technicianOwnInvoiceJob, #252) keep it.
  const invoiceRoles = requireRole(["owner", "admin", "dispatcher", "office"]);
  fastify.addHook("onRoute", (routeOptions) => {
    if (!routeOptions.url.includes("/invoices")) {
      return;
    }
    const existing = routeOptions.preHandler;
    const handlers: preHandlerHookHandler[] = existing
      ? (Array.isArray(existing) ? [...existing] : [existing]) as preHandlerHookHandler[]
      : [];
    if (handlers.includes(technicianOwnInvoiceJob)) {
      return;
    }
    routeOptions.preHandler = [...handlers, invoiceRoles];
  });

  fastify.get("/invoices", {
    preHandler: authenticate,
    preValidation: listInvoicesValidation,
    schema: listInvoicesSchema
  }, listInvoicesHandler);

  fastify.post("/invoices", {
    preHandler: authenticate,
    preValidation: createInvoiceValidation,
    schema: createInvoiceSchema
  }, createInvoiceHandler);

  fastify.get("/invoices/:id", {
    preHandler: authenticate,
    preValidation: invoiceIdValidation,
    schema: getInvoiceSchema
  }, getInvoiceHandler);

  fastify.patch("/invoices/:id", {
    preHandler: authenticate,
    preValidation: updateInvoiceValidation,
    schema: updateInvoiceSchema
  }, updateInvoiceHandler);

  fastify.post("/invoices/:id/send", {
    preHandler: authenticate,
    preValidation: invoiceIdValidation,
    schema: sendInvoiceSchema
  }, sendInvoiceHandler);

  fastify.post("/invoices/:id/record-payment", {
    preHandler: authenticate,
    preValidation: recordPaymentValidation,
    schema: recordPaymentSchema
  }, recordPaymentHandler);

  fastify.post("/invoices/:id/payments", {
    preHandler: authenticate,
    preValidation: recordPaymentValidation,
    schema: recordPaymentSchema
  }, recordPaymentHandler);

  fastify.post("/invoices/:id/void", {
    preHandler: authenticate,
    preValidation: voidInvoiceValidation,
    schema: voidInvoiceRouteSchema
  }, voidInvoiceHandler);

  fastify.post("/invoices/:id/remind", {
    preHandler: authenticate,
    preValidation: invoiceIdValidation,
    schema: resendInvoiceReminderSchema
  }, resendInvoiceReminderHandler);

  fastify.post("/invoices/:id/items", {
    preHandler: authenticate,
    preValidation: addInvoiceItemValidation,
    schema: addInvoiceItemSchema
  }, addInvoiceItemHandler);

  fastify.patch("/invoices/:id/items/:itemId", {
    preHandler: authenticate,
    preValidation: updateInvoiceItemValidation,
    schema: updateInvoiceItemRouteSchema
  }, updateInvoiceItemHandler);

  fastify.delete("/invoices/:id/items/:itemId", {
    preHandler: authenticate,
    preValidation: invoiceItemIdValidation,
    schema: deleteInvoiceItemSchema
  }, deleteInvoiceItemHandler);

  fastify.get("/invoices/:id/payments", {
    preHandler: [authenticate, technicianOwnInvoiceJob],
    preValidation: invoiceIdValidation,
    schema: listInvoicePaymentsSchema
  }, listInvoicePaymentsHandler);

  fastify.get("/payments", {
    preHandler: [authenticate, requireRole(["owner", "admin", "dispatcher", "office"])],
    preValidation: listPaymentsValidation,
    schema: listPaymentsSchema
  }, listPaymentsHandler);
};

export default invoiceRoutes;
