import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { env } from "@fsm/config";
import { buildInvoiceReceiptPortalUrl } from "@fsm/config/agreement-portal-token";
import { RENVANI_STRIPE_BRAND } from "@fsm/config/stripe-branding";
import { AppError, ErrorCode, type PublicPayReceiptFees, type PublicPayViewFields } from "@fsm/types";

import { buildPublicPayReceiptFees, buildPublicPayViewFields } from "../lib/public-pay-view.js";
import { loadPublicInvoicePayment } from "./invoice.service.js";

export interface InvoiceReceiptView extends PublicPayViewFields, PublicPayReceiptFees {
  invoiceNumber: string;
  totalDue: string;
  invoiceAmount: string;
  platformFeeAmount: string;
  receiptPortalUrl: string;
  pdfDownloadUrl: string;
  brandName: string;
}

export async function getInvoiceReceiptView(paymentToken: string): Promise<InvoiceReceiptView> {
  const { link: payment, context } = await loadPublicInvoicePayment(paymentToken);
  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const receiptPortalUrl = buildInvoiceReceiptPortalUrl(appBaseUrl, paymentToken);

  return {
    invoiceNumber: payment.invoiceNumber,
    totalDue: payment.totalDue,
    invoiceAmount: payment.invoiceAmount,
    platformFeeAmount: payment.platformFeeAmount,
    receiptPortalUrl,
    pdfDownloadUrl: `${appBaseUrl}/api/v1/public/pay/${paymentToken}/receipt.pdf`,
    brandName: RENVANI_STRIPE_BRAND.platformName,
    ...buildPublicPayViewFields(context),
    ...buildPublicPayReceiptFees(context)
  };
}

export async function renderInvoiceReceiptPdf(paymentToken: string): Promise<Uint8Array> {
  const view = await getInvoiceReceiptView(paymentToken);
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let y = 740;
  const draw = (text: string, size: number, useBold = false) => {
    page.drawText(text, {
      x: 48,
      y,
      size,
      font: useBold ? bold : font,
      color: rgb(0.06, 0.13, 0.38)
    });
    y -= size + 10;
  };

  draw(`${view.brandName} receipt`, 20, true);
  draw(`Invoice ${view.invoiceNumber}`, 14, true);
  draw(`Service amount: $${view.invoiceAmount}`, 12);
  if (Number(view.platformFeeAmount) > 0) {
    draw(`Platform fee: $${view.platformFeeAmount}`, 12);
  }
  draw(`Total paid: $${view.totalDue}`, 12, true);
  draw("Payments processed by Renvani on behalf of your service provider.", 10);
  draw(view.receiptPortalUrl, 9);

  const bytes = await pdf.save();
  if (bytes.byteLength === 0) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, "Failed to generate receipt PDF");
  }

  return bytes;
}
