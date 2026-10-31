import { and, eq, isNull } from "drizzle-orm";

import { companies, db, emitEventWithExecutor } from "@fsm/db";

import { runTenantAwareTransaction } from "../lib/company-scoped-transaction.js";
import {
  AppError,
  ErrorCode,
  type CompanyNotificationSettings,
  type CompanySettings,
  type NotificationChannelPreferences
} from "@fsm/types";

type CompanyRecord = typeof companies.$inferSelect;
type NotificationChannelPreferenceInput = {
  email?: boolean | undefined;
  sms?: boolean | undefined;
};
type CompanyNotificationSettingsInput = {
  [K in keyof CompanyNotificationSettings]?: NotificationChannelPreferenceInput | null | undefined;
};
type CompanyVipMembershipSettingsInput = {
  maxPauseMonths?: number | null | undefined;
  pastDueGraceDays?: number | null | undefined;
};

type CompanySettingsInput = {
  tradingName?: string | null | undefined;
  currency?: string | null | undefined;
  notifications?: CompanyNotificationSettingsInput | undefined;
  vipMembership?: CompanyVipMembershipSettingsInput | undefined;
  invoicing?: { defaultPaymentTermsDays?: number | null | undefined } | undefined;
};

interface UpdateCompanyInput {
  name?: string | undefined;
  phone?: string | undefined;
  email?: string | undefined;
  website?: string | undefined;
  addressLine1?: string | undefined;
  addressLine2?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  zip?: string | undefined;
  timezone?: string | undefined;
  logoUrl?: string | undefined;
  settings?: CompanySettingsInput | undefined;
}

function requireResult<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new AppError(ErrorCode.INTERNAL_ERROR, message);
  }

  return value;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeCurrency(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim().toUpperCase();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function normalizeOptionalSettingString(value: string | null): string | null {
  if (value === null) {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

function buildActorName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

function normalizeCompanySettings(settings: CompanyRecord["settings"]): CompanySettings {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return {};
  }

  return { ...(settings as CompanySettings) };
}

function normalizeNotificationPreference(
  currentValue: NotificationChannelPreferences | null | undefined,
  inputValue: NotificationChannelPreferenceInput | null | undefined
): NotificationChannelPreferences | null | undefined {
  if (inputValue === undefined) {
    return currentValue;
  }

  if (inputValue === null) {
    return null;
  }

  return {
    email: inputValue.email ?? currentValue?.email ?? false,
    sms: inputValue.sms ?? currentValue?.sms ?? false
  };
}

function normalizeNotificationSettings(
  currentValue: CompanyNotificationSettings | null | undefined,
  inputValue: CompanyNotificationSettingsInput | undefined
): CompanyNotificationSettings | null | undefined {
  if (inputValue === undefined) {
    return currentValue;
  }

  return {
    ...(inputValue.bookingRequest !== undefined
      ? { bookingRequest: normalizeNotificationPreference(currentValue?.bookingRequest, inputValue.bookingRequest) ?? null }
      : currentValue?.bookingRequest !== undefined
        ? { bookingRequest: currentValue.bookingRequest }
        : {}),
    ...(inputValue.estimateFollowUp !== undefined
      ? { estimateFollowUp: normalizeNotificationPreference(currentValue?.estimateFollowUp, inputValue.estimateFollowUp) ?? null }
      : currentValue?.estimateFollowUp !== undefined
        ? { estimateFollowUp: currentValue.estimateFollowUp }
        : {}),
    ...(inputValue.invoiceRecovery !== undefined
      ? { invoiceRecovery: normalizeNotificationPreference(currentValue?.invoiceRecovery, inputValue.invoiceRecovery) ?? null }
      : currentValue?.invoiceRecovery !== undefined
        ? { invoiceRecovery: currentValue.invoiceRecovery }
        : {}),
    ...(inputValue.paymentReceived !== undefined
      ? { paymentReceived: normalizeNotificationPreference(currentValue?.paymentReceived, inputValue.paymentReceived) ?? null }
      : currentValue?.paymentReceived !== undefined
        ? { paymentReceived: currentValue.paymentReceived }
        : {}),
    ...(inputValue.reviewRequest !== undefined
      ? { reviewRequest: normalizeNotificationPreference(currentValue?.reviewRequest, inputValue.reviewRequest) ?? null }
      : currentValue?.reviewRequest !== undefined
        ? { reviewRequest: currentValue.reviewRequest }
        : {}),
    ...(inputValue.serviceDueAlert !== undefined
      ? { serviceDueAlert: normalizeNotificationPreference(currentValue?.serviceDueAlert, inputValue.serviceDueAlert) ?? null }
      : currentValue?.serviceDueAlert !== undefined
        ? { serviceDueAlert: currentValue.serviceDueAlert }
        : {})
  };
}

function buildCompanySettingsUpdate(
  currentSettings: CompanyRecord["settings"],
  input: CompanySettingsInput | undefined
): CompanySettings | undefined {
  if (input === undefined) {
    return undefined;
  }

  const nextSettings = normalizeCompanySettings(currentSettings);

  if (input.tradingName !== undefined) {
    nextSettings.tradingName = normalizeOptionalSettingString(input.tradingName);
  }

  if (input.currency !== undefined) {
    nextSettings.currency = normalizeCurrency(input.currency);
  }

  if (input.notifications !== undefined) {
    nextSettings.notifications = normalizeNotificationSettings(nextSettings.notifications, input.notifications) ?? null;
  }

  if (input.vipMembership !== undefined) {
    const current = nextSettings.vipMembership ?? {};
    nextSettings.vipMembership = {
      ...current,
      ...(input.vipMembership.maxPauseMonths !== undefined
        ? { maxPauseMonths: input.vipMembership.maxPauseMonths }
        : {}),
      ...(input.vipMembership.pastDueGraceDays !== undefined
        ? { pastDueGraceDays: input.vipMembership.pastDueGraceDays }
        : {})
    };
  }

  if (input.invoicing?.defaultPaymentTermsDays !== undefined) {
    nextSettings.invoicing = {
      ...(nextSettings.invoicing ?? {}),
      defaultPaymentTermsDays: input.invoicing.defaultPaymentTermsDays
    };
  }

  return nextSettings;
}

export async function getCompany(companyId: string): Promise<CompanyRecord> {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);

  if (!company) {
    throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  }

  return company;
}

export async function updateCompany(
  companyId: string,
  actorId: string,
  input: UpdateCompanyInput
): Promise<CompanyRecord> {
  const existingCompany = await getCompany(companyId);
  const actor = await db.query.users.findFirst({
    where: (userTable, { and: andOperator, eq: eqOperator, isNull: isNullOperator }) =>
      andOperator(eqOperator(userTable.id, actorId), eqOperator(userTable.companyId, companyId), isNullOperator(userTable.deletedAt))
  });

  const updateValues = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.phone !== undefined ? { phone: input.phone } : {}),
    ...(input.email !== undefined ? { email: normalizeEmail(input.email) } : {}),
    ...(input.website !== undefined ? { website: input.website } : {}),
    ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
    ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
    ...(input.city !== undefined ? { city: input.city } : {}),
    ...(input.state !== undefined ? { state: input.state } : {}),
    ...(input.zip !== undefined ? { zip: input.zip } : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
    ...(input.settings !== undefined
      ? { settings: buildCompanySettingsUpdate(existingCompany.settings, input.settings) ?? existingCompany.settings }
      : {})
  };

  if (Object.keys(updateValues).length === 0) {
    return existingCompany;
  }

  return runTenantAwareTransaction(companyId, async (tx) => {
    const updatedCompanies = await tx
      .update(companies)
      .set({
        ...updateValues,
        updatedAt: new Date()
      })
      .where(eq(companies.id, companyId))
      .returning();
    const updatedCompany = requireResult(updatedCompanies[0], "Failed to update company");

    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "company.updated",
      actorId,
      actorName: actor ? buildActorName(actor.firstName, actor.lastName) : undefined,
      entityType: "company",
      entityId: companyId,
      payload: updateValues,
      summary: `${updatedCompany.name} company profile updated`
    });

    return updatedCompany;
  });
}
