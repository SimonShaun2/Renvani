import { and, eq, isNull } from "drizzle-orm";

import { companies, db, emitEventWithExecutor } from "@fsm/db";
import { AppError, ErrorCode, type StripeConnectStatus } from "@fsm/types";

import { readRenvaniSubscriptionPlan, resolveCompanyServiceFeePercent } from "../lib/company-renvani-plan.js";

import { featureFlags } from "@fsm/config/feature-flags";

import { syncRenvaniStripePlatformPolicies } from "../lib/stripe-platform-settings.js";
import {
  applyConnectAccountBranding,
  createConnectAccountSession,
  createConnectOnboardingLink,
  createExpressConnectedAccount,
  createExpressDashboardLink,
  retrieveConnectedAccount,
  type ConnectEmbeddedComponent,
  type StripeConnectAccountSnapshot
} from "../lib/stripe.js";

type CompanyRow = typeof companies.$inferSelect;
type SelectExecutor = Pick<typeof db, "select">;
type TransactionExecutor = Pick<typeof db, "select" | "update" | "insert">;

interface StripeConnectSettings {
  chargesEnabled?: boolean;
  payoutsEnabled?: boolean;
  detailsSubmitted?: boolean;
}

type CompanySettings = Record<string, unknown> & {
  stripeConnect?: StripeConnectSettings;
};

function normalizeCompanySettings(settings: CompanyRow["settings"]): CompanySettings {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }

  return { ...(settings as Record<string, unknown>) };
}

function getStoredStripeConnectSettings(company: CompanyRow): StripeConnectSettings {
  const settings = normalizeCompanySettings(company.settings);
  const stripeConnect = settings.stripeConnect;

  if (!stripeConnect || typeof stripeConnect !== "object" || Array.isArray(stripeConnect)) {
    return {};
  }

  return { ...(stripeConnect as StripeConnectSettings) };
}

function buildStripeConnectStatus(
  company: CompanyRow,
  snapshot?: StripeConnectAccountSnapshot
): StripeConnectStatus {
  if (!company.stripeAccountId) {
    return {
      connected: false
    };
  }

  if (snapshot) {
    return {
      connected: snapshot.chargesEnabled,
      chargesEnabled: snapshot.chargesEnabled,
      payoutsEnabled: snapshot.payoutsEnabled,
      detailsSubmitted: snapshot.detailsSubmitted,
      stripeAccountId: company.stripeAccountId,
      accountName: snapshot.accountName,
      payoutSchedule: snapshot.payoutSchedule,
      lastPayoutAmount: snapshot.lastPayoutAmount,
      lastPayoutAt: snapshot.lastPayoutAt,
      platformFeePercent: resolveCompanyServiceFeePercent(company),
      renvaniPlanTier: readRenvaniSubscriptionPlan(company)
    };
  }

  const storedSettings = getStoredStripeConnectSettings(company);

  return {
    connected: storedSettings.chargesEnabled ?? false,
    chargesEnabled: storedSettings.chargesEnabled ?? false,
    payoutsEnabled: storedSettings.payoutsEnabled ?? false,
    detailsSubmitted: storedSettings.detailsSubmitted ?? false,
    stripeAccountId: company.stripeAccountId,
    platformFeePercent: resolveCompanyServiceFeePercent(company),
    renvaniPlanTier: readRenvaniSubscriptionPlan(company)
  };
}

async function getCompanyRecord(companyId: string, executor: SelectExecutor): Promise<CompanyRow> {
  const [company] = await executor
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }

  return company;
}

async function updateStripeConnectSnapshot(
  executor: TransactionExecutor,
  company: CompanyRow,
  snapshot: StripeConnectAccountSnapshot
): Promise<CompanyRow> {
  const settings = normalizeCompanySettings(company.settings);
  const updatedSettings: CompanySettings = {
    ...settings,
    stripeConnect: {
      chargesEnabled: snapshot.chargesEnabled,
      payoutsEnabled: snapshot.payoutsEnabled,
      detailsSubmitted: snapshot.detailsSubmitted
    }
  };

  const updatedCompanies = await executor
    .update(companies)
    .set({
      settings: updatedSettings,
      updatedAt: new Date()
    })
    .where(and(eq(companies.id, company.id), isNull(companies.deletedAt)))
    .returning();
  const updatedCompany = updatedCompanies[0];

  if (!updatedCompany) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }

  return updatedCompany;
}

export async function createOnboardingLink(companyId: string): Promise<{ url: string }> {
  const company = await getCompanyRecord(companyId, db);
  const accountId =
    company.stripeAccountId ?? (await createExpressConnectedAccount(companyId, company.name)).id;

  const persistedCompany = company.stripeAccountId
    ? company
    : await db.transaction(async (tx) => {
        const updatedCompanies = await tx
          .update(companies)
          .set({
            stripeAccountId: accountId,
            updatedAt: new Date()
          })
          .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
          .returning();
        const updatedCompany = updatedCompanies[0];

        if (!updatedCompany) {
          throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
        }

        await emitEventWithExecutor(tx, {
          companyId,
          eventType: "company.stripe_onboarding_started",
          entityType: "company",
          entityId: updatedCompany.id,
          payload: {
            stripeAccountId: accountId
          },
          summary: `Stripe Connect onboarding started for ${updatedCompany.name}`
        });

        return updatedCompany;
      });

  if (company.stripeAccountId) {
    await emitEventWithExecutor(db, {
      companyId,
      eventType: "company.stripe_onboarding_started",
      entityType: "company",
      entityId: persistedCompany.id,
      payload: {
        stripeAccountId: accountId
      },
      summary: `Stripe Connect onboarding restarted for ${persistedCompany.name}`
    });
  }

  await applyConnectAccountBranding(accountId, persistedCompany.name);

  if (featureFlags.stripeRenvaniPlatformSync) {
    await syncRenvaniStripePlatformPolicies().catch(() => undefined);
  }

  return createConnectOnboardingLink(accountId);
}

export async function createEmbeddedConnectSession(
  companyId: string,
  components: ConnectEmbeddedComponent[]
): Promise<{ clientSecret: string }> {
  if (!featureFlags.stripeRenvaniConnectEmbedded) {
    throw new AppError(ErrorCode.CONFLICT, "Embedded Connect is disabled");
  }

  const company = await getCompanyRecord(companyId, db);
  const accountId =
    company.stripeAccountId ?? (await createExpressConnectedAccount(companyId, company.name)).id;

  if (!company.stripeAccountId) {
    await db.transaction(async (tx) => {
      const updatedCompanies = await tx
        .update(companies)
        .set({
          stripeAccountId: accountId,
          updatedAt: new Date()
        })
        .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
        .returning();
      const updatedCompany = updatedCompanies[0];

      if (!updatedCompany) {
        throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
      }

      await emitEventWithExecutor(tx, {
        companyId,
        eventType: "company.stripe_onboarding_started",
        entityType: "company",
        entityId: updatedCompany.id,
        payload: {
          stripeAccountId: accountId,
          embedded: true
        },
        summary: `Stripe Connect embedded onboarding started for ${updatedCompany.name}`
      });
    });
  }

  await applyConnectAccountBranding(accountId, company.name);

  return createConnectAccountSession(accountId, components);
}

export async function handleOnboardingReturn(companyId: string): Promise<StripeConnectStatus> {
  const company = await getCompanyRecord(companyId, db);

  if (!company.stripeAccountId) {
    return {
      connected: false
    };
  }

  const previousSettings = getStoredStripeConnectSettings(company);
  const snapshot = await retrieveConnectedAccount(company.stripeAccountId);
  await applyConnectAccountBranding(company.stripeAccountId, company.name);
  const updatedCompany = await db.transaction(async (tx) => {
    const persistedCompany = await updateStripeConnectSnapshot(tx, company, snapshot);

    if (snapshot.chargesEnabled && previousSettings.chargesEnabled !== true) {
      await emitEventWithExecutor(tx, {
        companyId,
        eventType: "company.stripe_onboarding_completed",
        entityType: "company",
        entityId: persistedCompany.id,
        payload: {
          stripeAccountId: persistedCompany.stripeAccountId,
          chargesEnabled: snapshot.chargesEnabled,
          payoutsEnabled: snapshot.payoutsEnabled,
          detailsSubmitted: snapshot.detailsSubmitted
        },
        summary: `Stripe Connect onboarding completed for ${persistedCompany.name}`
      });
    }

    return persistedCompany;
  });

  return buildStripeConnectStatus(updatedCompany, snapshot);
}

export async function getConnectStatus(companyId: string): Promise<StripeConnectStatus> {
  const company = await getCompanyRecord(companyId, db);

  if (!company.stripeAccountId) {
    return {
      connected: false
    };
  }

  const snapshot = await retrieveConnectedAccount(company.stripeAccountId);
  return buildStripeConnectStatus(company, snapshot);
}

export async function createDashboardLink(companyId: string): Promise<{ url: string }> {
  const company = await getCompanyRecord(companyId, db);

  if (!company.stripeAccountId) {
    throw new AppError(ErrorCode.CONFLICT, "Company must complete Stripe onboarding first");
  }

  const snapshot = await retrieveConnectedAccount(company.stripeAccountId);

  if (!snapshot.chargesEnabled) {
    throw new AppError(ErrorCode.CONFLICT, "Company must complete Stripe onboarding first");
  }

  return createExpressDashboardLink(company.stripeAccountId);
}
