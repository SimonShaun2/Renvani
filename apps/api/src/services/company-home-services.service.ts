import { and, eq, isNull } from "drizzle-orm";
import { companies, db, emitEventWithExecutor } from "@fsm/db";
import {
  AppError,
  ErrorCode,
  buildLocalBusinessJsonLd,
  getGbpCategoriesForTrade,
  readEmergencyServiceSettings,
  resolveEmergencyRequest,
  serializeJsonLdForScript,
  readServiceAreaSettings,
  type EmergencyServiceSettings,
  type ServiceAreaSettings,
  type UpdateEmergencyServiceBody,
  type UpdateServiceAreaBody
} from "@fsm/types";

import { env } from "@fsm/config";

import { runTenantAwareTransaction } from "../lib/company-scoped-transaction.js";
import {
  checkZipCoverageForBookingSettings,
  getPublicBookingCompany,
  getPublicBookingContext,
  getPublicBookingSettingsBySlug
} from "./booking.service.js";

/**
 * Atomic single-key settings write: locks the company row inside the tenant transaction, re-reads settings
 * there and replaces only `key`, so concurrent saves of other settings keys are never lost.
 */
async function writeCompanySettingsKey(
  companyId: string,
  actorId: string,
  key: "serviceArea" | "emergencyService",
  value: Record<string, unknown>,
  summary: string
): Promise<unknown> {
  return runTenantAwareTransaction(companyId, async (tx) => {
    const [company] = await tx
      .select()
      .from(companies)
      .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
      .for("update")
      .limit(1);
    if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
    const current =
      company.settings && typeof company.settings === "object" && !Array.isArray(company.settings)
        ? (company.settings as Record<string, unknown>)
        : {};
    const nextSettings = { ...current, [key]: value };
    await tx.update(companies).set({ settings: nextSettings, updatedAt: new Date() }).where(eq(companies.id, companyId));
    await emitEventWithExecutor(tx, {
      companyId,
      eventType: "company.updated",
      actorId,
      entityType: "company",
      entityId: companyId,
      payload: { settingsKey: key },
      summary: `${company.name} ${summary}`
    });
    return nextSettings;
  });
}

async function loadCompanySettings(companyId: string): Promise<unknown> {
  const [company] = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.deletedAt)))
    .limit(1);
  if (!company) throw new AppError(ErrorCode.NOT_FOUND, "Company not found");
  return company.settings;
}

export async function getServiceArea(companyId: string): Promise<ServiceAreaSettings> {
  return readServiceAreaSettings(await loadCompanySettings(companyId));
}

export async function setServiceArea(companyId: string, actorId: string, body: UpdateServiceAreaBody): Promise<ServiceAreaSettings> {
  const zips = Array.from(new Set(body.zips)).sort();
  const value: ServiceAreaSettings = { zips, radiusMiles: body.radiusMiles ?? null };
  const next = await writeCompanySettingsKey(companyId, actorId, "serviceArea", { ...value }, `service area updated (${zips.length} ZIPs)`);
  return readServiceAreaSettings(next);
}

export async function getEmergencyService(companyId: string): Promise<EmergencyServiceSettings> {
  return readEmergencyServiceSettings(await loadCompanySettings(companyId));
}

export async function setEmergencyService(
  companyId: string,
  actorId: string,
  body: UpdateEmergencyServiceBody
): Promise<EmergencyServiceSettings> {
  const value: EmergencyServiceSettings = { enabled: body.enabled, hoursText: body.hoursText ?? null };
  const next = await writeCompanySettingsKey(
    companyId,
    actorId,
    "emergencyService",
    { ...value },
    `24/7 emergency service ${body.enabled ? "enabled" : "disabled"}`
  );
  return readEmergencyServiceSettings(next);
}

/**
 * Public "do you serve this ZIP?": answers only in/out. Unknown or disabled shop -> 404 (same as the booking page).
 * Uses the shop's configured ZIP list; with no list configured it falls back to existing coverage (service areas,
 * technician ZIPs, allowZipOverflow). Never returns the ZIP list, counts or technician data.
 */
export async function publicServesZip(slug: string, zip: string): Promise<{ served: boolean }> {
  const { company, settings } = await getPublicBookingContext(slug);
  const area = readServiceAreaSettings(company.settings);
  if (area.zips.length > 0) return { served: area.zips.includes(zip) };
  const coverage = await checkZipCoverageForBookingSettings(settings, zip);
  return { served: coverage.covered };
}

function readTrade(settings: unknown): string | null {
  // settings.trade comes from #318; read defensively.
  const trade = settings && typeof settings === "object" ? (settings as Record<string, unknown>).trade : null;
  return typeof trade === "string" ? trade : null;
}

/**
 * Public schema.org LocalBusiness JSON-LD for the shop site. Only public fields (name, site URL, public phone,
 * locality, public ZIP list, hours, public profile links); no emails, street address or technician data.
 */
export async function getPublicStructuredData(slug: string): Promise<{ jsonLd: Record<string, unknown>; script: string }> {
  const company = await getPublicBookingCompany(slug);
  const publicSettings = await getPublicBookingSettingsBySlug(slug);
  const trade = readTrade(company.settings);
  const area = readServiceAreaSettings(company.settings);
  const emergency = resolveEmergencyRequest(true, readEmergencyServiceSettings(company.settings), trade);
  const siteUrl = `${env.APP_URL.replace(/\/$/u, "")}/site/${encodeURIComponent(publicSettings.bookingSlug)}`;
  const jsonLd = buildLocalBusinessJsonLd({
    name: publicSettings.companyName,
    trade,
    url: siteUrl,
    telephone: publicSettings.phone,
    logoUrl: publicSettings.logoUrl,
    address: { city: company.city, state: company.state, zip: company.zip },
    areaServedZips: area.zips.length > 0 ? area.zips : publicSettings.serviceAreaZipCodes,
    availableDays: publicSettings.availableDays,
    availableHoursStart: publicSettings.availableHoursStart,
    availableHoursEnd: publicSettings.availableHoursEnd,
    emergency24x7: emergency.accepted,
    sameAs: [
      company.website,
      publicSettings.googleReviewUrl,
      publicSettings.yelpReviewUrl,
      publicSettings.facebookReviewUrl,
      publicSettings.customReviewUrl
    ]
  });
  return { jsonLd, script: serializeJsonLdForScript(jsonLd) };
}

export async function getCompanyGbpCategories(companyId: string): Promise<ReturnType<typeof getGbpCategoriesForTrade>> {
  return getGbpCategoriesForTrade(readTrade(await loadCompanySettings(companyId)));
}
