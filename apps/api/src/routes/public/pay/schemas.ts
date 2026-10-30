import { z } from "zod";

import { PUBLIC_PAY_VIEW_FIELD_SCHEMA } from "../../../lib/public-pay-view.js";
import { withZodValidation } from "../../shared/validation.js";

const errorResponseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["error", "message", "requestId"],
  properties: {
    error: { type: "string" },
    message: { type: "string" },
    requestId: { type: "string" }
  }
} as const;

export const TokenParamsSchema = z
  .object({
    token: z.string().min(32)
  })
  .strict();

export type TokenParams = z.infer<typeof TokenParamsSchema>;

export const publicPaymentValidation = withZodValidation({
  params: TokenParamsSchema
});

export const getPublicPaymentLinkSchema = {
  tags: ["public-payments"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: [
        "invoiceNumber",
        "paymentLinkUrl",
        "checkoutClientSecret",
        "invoiceAmount",
        "platformFeeAmount",
        "totalDue",
        "platformFeePaidByCustomer",
        "platformFeeDisclosure"
      ],
      properties: {
        invoiceNumber: { type: "string" },
        paymentLinkUrl: { type: "string" },
        checkoutClientSecret: { type: ["string", "null"] },
        invoiceAmount: { type: "string" },
        platformFeeAmount: { type: "string" },
        totalDue: { type: "string" },
        serviceFeeAmount: { type: "string" },
        bookingFeeAmount: { type: "string" },
        invoiceAmountCents: { type: "integer" },
        serviceFeeCents: { type: "integer" },
        bookingFeeCents: { type: "integer" },
        totalDueCents: { type: "integer" },
        feeRefundable: { type: "boolean" },
        platformFeePercent: { type: ["number", "null"] },
        platformFeePaidByCustomer: { type: "boolean" },
        platformFeeDisclosure: { type: ["string", "null"] },
        ...PUBLIC_PAY_VIEW_FIELD_SCHEMA
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;

export const getPublicInvoiceReceiptSchema = {
  tags: ["public-payments"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: ["invoiceNumber", "totalDue", "invoiceAmount", "platformFeeAmount", "receiptPortalUrl", "pdfDownloadUrl", "brandName"],
      properties: {
        invoiceNumber: { type: "string" },
        totalDue: { type: "string" },
        invoiceAmount: { type: "string" },
        platformFeeAmount: { type: "string" },
        receiptPortalUrl: { type: "string" },
        pdfDownloadUrl: { type: "string" },
        brandName: { type: "string" },
        ...PUBLIC_PAY_VIEW_FIELD_SCHEMA,
        serviceFeeLabel: { type: ["string", "null"] },
        serviceFeeAmount: { type: "string" },
        serviceFeeCents: { type: "integer" },
        bookingFeeAmount: { type: "string" },
        bookingFeeCents: { type: "integer" },
        feeRefundable: { type: "boolean" }
      }
    },
    400: errorResponseSchema,
    404: errorResponseSchema,
    409: errorResponseSchema
  }
} as const;
