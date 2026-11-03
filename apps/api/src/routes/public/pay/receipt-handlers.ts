import type { FastifyReply, FastifyRequest } from "fastify";

import {
  getInvoiceReceiptView,
  renderInvoiceReceiptPdf
} from "../../../services/invoice-receipt.service.js";
import type { TokenParams } from "./schemas.js";

export async function getPublicInvoiceReceiptHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as TokenParams;
  const receipt = await getInvoiceReceiptView(params.token);
  return reply.send(receipt);
}

export async function getPublicInvoiceReceiptPdfHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<FastifyReply> {
  const params = request.params as TokenParams;
  const pdfBytes = await renderInvoiceReceiptPdf(params.token);
  return reply
    .header("Content-Type", "application/pdf")
    .header("Content-Disposition", `inline; filename="renvani-receipt.pdf"`)
    .send(Buffer.from(pdfBytes));
}
