import { z } from "zod";

import { withZodValidation } from "../../shared/validation.js";

export const PortalTokenParamsSchema = z
  .object({
    token: z.string().min(16)
  })
  .strict();

export type PortalTokenParams = z.infer<typeof PortalTokenParamsSchema>;

export const publicAgreementPortalValidation = withZodValidation({
  params: PortalTokenParamsSchema
});

export const getAgreementPortalSchema = {
  tags: ["public-agreements"],
  response: {
    200: {
      type: "object",
      additionalProperties: false,
      required: [
        "agreementName",
        "companyName",
        "brandName",
        "portalUrl",
        "amountDue",
        "dueDate",
        "paymentMethodLabel",
        "stripeStatus",
        "payOnRenvaniMessage"
      ],
      properties: {
        agreementName: { type: "string" },
        companyName: { type: "string" },
        brandName: { type: "string" },
        portalUrl: { type: "string" },
        amountDue: { type: ["string", "null"] },
        dueDate: { type: ["string", "null"] },
        paymentMethodLabel: { type: ["string", "null"] },
        stripeStatus: { type: "string" },
        payOnRenvaniMessage: { type: "string" }
      }
    }
  }
} as const;
