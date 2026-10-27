import { and, eq, isNull } from "drizzle-orm";

import { env } from "@fsm/config";
import {
  buildAgreementRetryPortalUrl,
  verifyAgreementPortalToken
} from "@fsm/config/agreement-portal-token";
import { RENVANI_STRIPE_BRAND } from "@fsm/config/stripe-branding";
import { companies, db, maintenancePlans } from "@fsm/db";
import { AppError, ErrorCode } from "@fsm/types";

import { retrieveServiceAgreementSubscriptionSnapshot } from "../lib/stripe.js";

export interface AgreementPortalView {
  agreementName: string;
  companyName: string;
  brandName: string;
  portalUrl: string;
  amountDue: string | null;
  dueDate: string | null;
  paymentMethodLabel: string | null;
  stripeStatus: string;
  payOnRenvaniMessage: string;
}

export async function getAgreementPortalView(portalToken: string): Promise<AgreementPortalView> {
  const parsed = verifyAgreementPortalToken(portalToken);

  if (!parsed) {
    throw new AppError(ErrorCode.NOT_FOUND, "Link not found");
  }

  const [plan] = await db
    .select()
    .from(maintenancePlans)
    .where(
      and(
        eq(maintenancePlans.id, parsed.agreementId),
        eq(maintenancePlans.companyId, parsed.companyId),
        isNull(maintenancePlans.deletedAt)
      )
    )
    .limit(1);

  if (!plan) {
    throw new AppError(ErrorCode.NOT_FOUND, "Link not found");
  }

  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, parsed.companyId), isNull(companies.deletedAt)))
    .limit(1);

  if (!company || !plan.stripeSubscriptionId) {
    throw new AppError(ErrorCode.CONFLICT, "Billing portal is unavailable for this agreement");
  }

  const snapshot = await retrieveServiceAgreementSubscriptionSnapshot(plan.stripeSubscriptionId, {
    companyId: plan.companyId,
    agreementId: plan.id
  });

  const appBaseUrl = env.APP_URL.replace(/\/$/, "");
  const portalUrl = buildAgreementRetryPortalUrl(appBaseUrl, portalToken);

  return {
    agreementName: plan.name,
    companyName: company.name,
    brandName: RENVANI_STRIPE_BRAND.platformName,
    portalUrl,
    amountDue: snapshot.latestInvoiceAmountDue,
    dueDate: snapshot.latestInvoiceDueDate,
    paymentMethodLabel: snapshot.paymentMethodLabel,
    stripeStatus: snapshot.status,
    payOnRenvaniMessage:
      "Update your payment method and pay on Renvani. Stripe is only used for secure card processing."
  };
}
