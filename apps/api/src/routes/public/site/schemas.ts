import { z } from "zod";

import { SERVICE_INQUIRY_HONEYPOT_FIELD, type ServiceInquiryFieldError } from "../../../services/public-service-inquiry.logic.js";

/** Public shop slug: lowercase alnum + hyphen, 1-100 chars (input is trimmed and lowercased first). */
export const publicSiteSlugParamsSchema = z
  .object({
    slug: z.preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/u, "Invalid shop slug")
    )
  })
  .strict();

const optionalText = z.string({ invalid_type_error: "must be a string" }).nullable().optional();

/**
 * Strict shape gate for the public inquiry body. Unknown keys are rejected; per-field normalization
 * (trim, length, phone/email/ZIP format) stays in validateServiceInquiry.
 */
export const serviceInquiryBodySchema = z
  .object({
    name: optionalText,
    phone: optionalText,
    email: optionalText,
    message: optionalText,
    service: optionalText,
    zip: optionalText,
    [SERVICE_INQUIRY_HONEYPOT_FIELD]: z.unknown().optional()
  })
  .strict();

/** Map zod issues to the route's existing 400 `errors: [{ field, message }]` shape. */
export function zodIssuesToFieldErrors(error: z.ZodError): ServiceInquiryFieldError[] {
  const out: ServiceInquiryFieldError[] = [];
  for (const issue of error.issues) {
    if (issue.code === "unrecognized_keys") {
      for (const key of issue.keys) out.push({ field: key, message: "Unknown field" });
      continue;
    }
    const field = issue.path.length > 0 ? String(issue.path[0]) : "body";
    if (issue.code === "invalid_type" && field === "body") {
      out.push({ field, message: "Request body must be a JSON object" });
    } else if (issue.code === "invalid_type") {
      out.push({ field, message: `${field} must be a string` });
    } else {
      out.push({ field, message: issue.message });
    }
  }
  return out;
}
