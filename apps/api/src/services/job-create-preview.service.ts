import { and, eq, isNull } from "drizzle-orm";

import { companies, customers, db } from "@fsm/db";
import { AppError, ErrorCode, type JobCreatePreview, type JobCreatePreviewInput } from "@fsm/types";

import { buildChargePreview } from "../lib/charge-preview.js";
import { generateJobNumber } from "../lib/job-number.js";
import { priceJobProductInputs } from "./job-products.service.js";

/** Read-only: next job number (not reserved), priced line items, Service Fee/total, card-on-file. */
export async function previewJobCreate(companyId: string, input: JobCreatePreviewInput): Promise<JobCreatePreview> {
  const [company] = await db
    .select({ settings: companies.settings })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }

  let cardOnFile: boolean | null = null;
  if (input.customerId) {
    const [customer] = await db
      .select({ stripeCustomerId: customers.stripeCustomerId })
      .from(customers)
      .where(and(eq(customers.companyId, companyId), eq(customers.id, input.customerId), isNull(customers.deletedAt)))
      .limit(1);
    if (!customer) {
      throw new AppError(ErrorCode.NOT_FOUND, "Customer not found");
    }
    cardOnFile = Boolean(customer.stripeCustomerId);
  }

  const priced = await priceJobProductInputs(companyId, input.products ?? []);
  const jobNumberPreview = await generateJobNumber(companyId, { select: db.select.bind(db) });

  return {
    ...buildChargePreview(company, priced.subtotal),
    jobNumberPreview,
    lines: priced.lines,
    cardOnFile
  };
}
