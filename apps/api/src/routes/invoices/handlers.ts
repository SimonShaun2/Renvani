import type { FastifyReply, FastifyRequest } from "fastify";

import type {
  AddInvoiceItemInput,
  CreateInvoiceInput,
  InvoiceDetail,
  InvoiceItem,
  InvoiceListItem,
  ListInvoicesQuery,
  ListPaymentsQuery,
  Payment,
  RecordPaymentInput,
  UpdateInvoiceInput,
  UpdateInvoiceItemInput
} from "@fsm/types";

import {
  createInvoice,
  getInvoice,
  getInvoiceChargePreview,
  listInvoices,
  recordPayment,
  resendInvoiceReminder,
  sendInvoice,
  updateInvoice,
  voidInvoice
} from "../../services/invoice.service.js";
import {
  addItem,
  removeItem,
  updateItem
} from "../../services/invoice-items.service.js";
import { listPayments } from "../../services/payment.service.js";
import type {
  InvoiceIdParams,
  InvoiceItemIdParams,
  VoidInvoiceBody
} from "./schemas.js";

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toInvoiceItemResponse(item: InvoiceItem) {
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    companyId: item.companyId,
    name: item.name,
    description: item.description,
    itemType: item.itemType,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: item.total,
    isTaxable: item.isTaxable,
    sortOrder: item.sortOrder,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
    deletedAt: toIsoString(item.deletedAt)
  };
}

function toPaymentResponse(payment: Payment) {
  return {
    id: payment.id,
    companyId: payment.companyId,
    invoiceId: payment.invoiceId,
    customerId: payment.customerId,
    collectedById: payment.collectedById,
    amount: payment.amount,
    serviceFeeAmount: payment.serviceFeeAmount,
    bookingFeeAmount: payment.bookingFeeAmount,
    feeRefundable: payment.feeRefundable,
    amountRefunded: payment.amountRefunded,
    refundableAmount: payment.refundableAmount,
    method: payment.method,
    status: payment.status,
    stripePaymentIntentId: payment.stripePaymentIntentId,
    stripeChargeId: payment.stripeChargeId,
    checkNumber: payment.checkNumber,
    referenceNumber: payment.referenceNumber,
    notes: payment.notes,
    paidAt: toIsoString(payment.paidAt),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    deletedAt: toIsoString(payment.deletedAt)
  };
}

function toInvoiceListItemResponse(invoice: InvoiceListItem) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.title,
    status: invoice.status,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    serviceFeeAmount: invoice.serviceFeeAmount ?? "0.00",
    bookingFeeAmount: invoice.bookingFeeAmount ?? "0.00",
    dueAt: toIsoString(invoice.dueAt),
    paidAt: toIsoString(invoice.paidAt),
    customer: invoice.customer,
    createdAt: invoice.createdAt.toISOString()
  };
}

function toInvoiceDetailResponse(invoice: InvoiceDetail) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.title,
    status: invoice.status,
    subtotal: invoice.subtotal,
    taxRate: invoice.taxRate,
    taxAmount: invoice.taxAmount,
    discountAmount: invoice.discountAmount,
    total: invoice.total,
    amountPaid: invoice.amountPaid,
    balanceDue: invoice.balanceDue,
    serviceFeeAmount: invoice.serviceFeeAmount ?? "0.00",
    bookingFeeAmount: invoice.bookingFeeAmount ?? "0.00",
    issuedAt: toIsoString(invoice.issuedAt),
    sentAt: toIsoString(invoice.sentAt),
    dueAt: toIsoString(invoice.dueAt),
    paidAt: toIsoString(invoice.paidAt),
    stripePaymentLinkUrl: invoice.stripePaymentLinkUrl,
    paymentToken: invoice.paymentToken,
    messageToCustomer: invoice.messageToCustomer,
    customer: invoice.customer,
    job: invoice.job,
    items: invoice.items.map((item) => toInvoiceItemResponse(item)),
    payments: invoice.payments.map((payment) => ({
      ...payment,
      paidAt: toIsoString(payment.paidAt)
    })),
    createdAt: invoice.createdAt.toISOString()
  };
}

export async function listInvoicesHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const result = await listInvoices(request.company.id, request.query as ListInvoicesQuery);

  return reply.send({
    data: result.data.map((invoice) => toInvoiceListItemResponse(invoice)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  });
}

export async function createInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const invoice = await createInvoice(request.company.id, request.user.id, request.body as CreateInvoiceInput);
  const detail = await getInvoice(request.company.id, invoice.id);

  return reply.status(201).send({
    invoice: toInvoiceDetailResponse(detail)
  });
}

export async function getInvoiceChargePreviewHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceIdParams;
  return reply.send(await getInvoiceChargePreview(request.company.id, params.id));
}

export async function getInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceIdParams;
  const invoice = await getInvoice(request.company.id, params.id);

  return reply.send({
    invoice: toInvoiceDetailResponse(invoice)
  });
}

export async function updateInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceIdParams;
  await updateInvoice(request.company.id, request.user.id, params.id, request.body as UpdateInvoiceInput);
  const detail = await getInvoice(request.company.id, params.id);

  return reply.send({
    invoice: toInvoiceDetailResponse(detail)
  });
}

export async function sendInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceIdParams;
  await sendInvoice(request.company.id, request.user.id, params.id);
  const detail = await getInvoice(request.company.id, params.id);

  return reply.send({
    invoice: toInvoiceDetailResponse(detail)
  });
}

export async function recordPaymentHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceIdParams;
  const payment = await recordPayment(
    request.company.id,
    request.user.id,
    params.id,
    request.body as RecordPaymentInput
  );
  const detail = await getInvoice(request.company.id, params.id);

  return reply.send({
    payment: toPaymentResponse(payment),
    invoice: toInvoiceDetailResponse(detail)
  });
}

export async function resendInvoiceReminderHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as InvoiceIdParams;
  await resendInvoiceReminder(request.company.id, request.user.id, params.id);
  const detail = await getInvoice(request.company.id, params.id);

  return reply.send({
    invoice: toInvoiceDetailResponse(detail)
  });
}

export async function voidInvoiceHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceIdParams;
  const body = request.body as VoidInvoiceBody;
  await voidInvoice(request.company.id, request.user.id, params.id, body.reason);
  const detail = await getInvoice(request.company.id, params.id);

  return reply.send({
    invoice: toInvoiceDetailResponse(detail)
  });
}

export async function addInvoiceItemHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceIdParams;
  const item = await addItem(request.company.id, params.id, request.body as AddInvoiceItemInput);

  return reply.status(201).send({
    item: toInvoiceItemResponse(item)
  });
}

export async function updateInvoiceItemHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceItemIdParams;
  const item = await updateItem(request.company.id, params.id, params.itemId, request.body as UpdateInvoiceItemInput);

  return reply.send({
    item: toInvoiceItemResponse(item)
  });
}

export async function deleteInvoiceItemHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceItemIdParams;
  await removeItem(request.company.id, params.id, params.itemId);

  return reply.status(204).send();
}

export async function listInvoicePaymentsHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const params = request.params as InvoiceIdParams;
  const invoice = await getInvoice(request.company.id, params.id);

  return reply.send({
    payments: invoice.payments.map((payment) => ({
      ...payment,
      paidAt: toIsoString(payment.paidAt)
    }))
  });
}

export async function listPaymentsHandler(request: FastifyRequest, reply: FastifyReply): Promise<FastifyReply> {
  const result = await listPayments(request.company.id, request.query as ListPaymentsQuery);

  return reply.send({
    data: result.data.map((payment) => toPaymentResponse(payment)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages
  });
}
