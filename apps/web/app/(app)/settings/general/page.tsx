"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Loader2, Save, UploadCloud } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import {
  SETTINGS_CURRENCY_OPTIONS,
  SETTINGS_TIMEZONE_OPTIONS
} from "@/src/components/settings/settings.constants";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import type { CompanyRecord } from "@/src/hooks/company.hooks";
import { ApiError } from "@/src/lib/api";
import { uploadFile, UploadValidationError } from "@/src/lib/upload";
import { useCompany, useUpdateCompany } from "@/src/hooks/company.hooks";
import { useUnsavedChanges } from "@/src/hooks/useUnsavedChanges";
import { showToast } from "@/src/stores/toast.store";

interface GeneralSettingsForm {
  name: string;
  tradingName: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  timezone: string;
  currency: string;
  logoUrl: string;
}

function normalizeForm(company: CompanyRecord): GeneralSettingsForm {
  return {
    name: company.name ?? "",
    tradingName: company.settings?.tradingName ?? "",
    email: company.email ?? "",
    phone: company.phone ?? "",
    website: company.website ?? "",
    addressLine1: company.addressLine1 ?? "",
    addressLine2: company.addressLine2 ?? "",
    city: company.city ?? "",
    state: company.state ?? "",
    zip: company.zip ?? "",
    timezone: company.timezone ?? "America/Chicago",
    currency: company.settings?.currency ?? "USD",
    logoUrl: company.logoUrl ?? ""
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function SettingsGeneralPage() {
  const companyQuery = useCompany();
  const updateCompany = useUpdateCompany();
  const [form, setForm] = useState<GeneralSettingsForm | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const company = companyQuery.data?.company ?? null;
  const initialForm = useMemo(() => (company ? normalizeForm(company) : null), [company]);
  const isDirty = form !== null && initialForm !== null && JSON.stringify(form) !== JSON.stringify(initialForm);

  useUnsavedChanges({ isDirty });

  useEffect(() => {
    if (!initialForm) {
      return;
    }

    setForm((current) => {
      if (!hasInitialized || !isDirty || current === null) {
        return initialForm;
      }

      return current;
    });
    setHasInitialized(true);
  }, [hasInitialized, initialForm, isDirty]);

  async function handleSave() {
    if (!form || !company || !isDirty) {
      return;
    }

    try {
      await updateCompany.mutateAsync({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        website: form.website.trim(),
        addressLine1: form.addressLine1.trim(),
        addressLine2: form.addressLine2.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        zip: form.zip.trim(),
        timezone: form.timezone,
        logoUrl: form.logoUrl.trim() || null,
        settings: {
          tradingName: form.tradingName.trim() || null,
          currency: form.currency
        }
      });

      showToast({
        tone: "success",
        title: "Company profile saved",
        description: "Your company details are ready for estimates, invoices, and public booking."
      });
    } catch (error) {
      const description =
        error instanceof ApiError ? error.message : "The company profile could not be saved.";

      showToast({
        tone: "error",
        title: "Save failed",
        description
      });
    }
  }

  async function handleLogoSelect(file: File | null) {
    if (!file || !company) {
      return;
    }

    setIsUploadingLogo(true);

    try {
      const attachment = await uploadFile({
        file,
        entityType: "company",
        entityId: company.id,
        caption: "Company logo"
      });

      setForm((current) => (current ? { ...current, logoUrl: attachment.fileUrl } : current));

      await updateCompany.mutateAsync({
        logoUrl: attachment.fileUrl
      });

      showToast({
        tone: "success",
        title: "Logo updated",
        description: "The company profile now uses the uploaded logo."
      });
    } catch (error) {
      const description =
        error instanceof UploadValidationError || error instanceof ApiError
          ? error.message
          : "The logo could not be uploaded.";

      showToast({
        tone: "error",
        title: "Upload failed",
        description
      });
    } finally {
      setIsUploadingLogo(false);
    }
  }

  if (companyQuery.isError || (!companyQuery.isLoading && !company)) {
    return (
      <PageLayout
        title="Company Profile"
        subtitle="Your company information shown to customers on estimates, invoices, and booking pages."
      >
        <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Company profile unavailable</h2>
          <p className="mt-3 text-sm text-neutral-500">Refresh and try again to load your current settings.</p>
        </section>
      </PageLayout>
    );
  }

  if (companyQuery.isLoading || form === null) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[96px]" />
        <SkeletonCard className="h-[640px]" />
      </div>
    );
  }

  const companyDisplayName = form.tradingName.trim() || form.name.trim() || "Renvani";

  return (
    <PageLayout
      title="Company Profile"
      subtitle="Your company information shown to customers on estimates, invoices, and booking pages."
      actions={
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={!isDirty || updateCompany.isPending}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {updateCompany.isPending ? "Saving..." : "Save Changes"}
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
          <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 px-5 py-5">
            <div className="flex flex-col gap-5 md:flex-row md:items-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-brand-accent text-xl font-semibold text-white">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt={companyDisplayName} className="h-full w-full rounded-[24px] object-cover" />
                ) : (
                  getInitials(companyDisplayName || "SR")
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-neutral-900">{companyDisplayName}</p>
                <p className="mt-1 text-sm text-neutral-500">Upload a square PNG or JPG logo to brand customer-facing screens.</p>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50">
                {isUploadingLogo ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                {isUploadingLogo ? "Uploading..." : "Upload Logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="hidden"
                  onChange={(event) => {
                    void handleLogoSelect(event.target.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Company name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => (current ? { ...current, name: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Trading name</span>
              <input
                value={form.tradingName}
                onChange={(event) => setForm((current) => (current ? { ...current, tradingName: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="Optional public-facing name"
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Email</span>
              <input
                value={form.email}
                onChange={(event) => setForm((current) => (current ? { ...current, email: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                type="email"
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Phone</span>
              <input
                value={form.phone}
                onChange={(event) => setForm((current) => (current ? { ...current, phone: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-neutral-700">Website</span>
              <input
                value={form.website}
                onChange={(event) => setForm((current) => (current ? { ...current, website: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="https://www.example.com"
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-neutral-700">Address line 1</span>
              <input
                value={form.addressLine1}
                onChange={(event) => setForm((current) => (current ? { ...current, addressLine1: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-semibold text-neutral-700">Address line 2</span>
              <input
                value={form.addressLine2}
                onChange={(event) => setForm((current) => (current ? { ...current, addressLine2: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                placeholder="Suite, unit, or floor"
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">City</span>
              <input
                value={form.city}
                onChange={(event) => setForm((current) => (current ? { ...current, city: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">State</span>
              <input
                value={form.state}
                onChange={(event) => setForm((current) => (current ? { ...current, state: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">ZIP code</span>
              <input
                value={form.zip}
                onChange={(event) => setForm((current) => (current ? { ...current, zip: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              />
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Timezone</span>
              <select
                value={form.timezone}
                onChange={(event) => setForm((current) => (current ? { ...current, timezone: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 bg-white px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              >
                {SETTINGS_TIMEZONE_OPTIONS.map((timezone) => (
                  <option key={timezone} value={timezone}>
                    {timezone}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-semibold text-neutral-700">Currency</span>
              <select
                value={form.currency}
                onChange={(event) => setForm((current) => (current ? { ...current, currency: event.target.value } : current))}
                onBlur={() => {
                  void handleSave();
                }}
                className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 bg-white px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
              >
                {SETTINGS_CURRENCY_OPTIONS.map((currency) => (
                  <option key={currency.value} value={currency.value}>
                    {currency.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-brand-accent" />
              <h2 className="text-base font-semibold text-neutral-900">Customer-facing preview</h2>
            </div>
            <div className="mt-4 rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-4">
              <p className="text-sm font-semibold text-neutral-900">{companyDisplayName}</p>
              <p className="mt-2 text-sm text-neutral-500">{form.phone || "Phone number not set"}</p>
              <p className="mt-1 text-sm text-neutral-500">{form.email || "Email address not set"}</p>
              <p className="mt-3 text-sm text-neutral-500">
                {[form.addressLine1, form.city, form.state, form.zip].filter((value) => value.trim()).join(", ") || "Business address not set"}
              </p>
            </div>
          </section>

          <section className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Tips</p>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-neutral-500">
              <li>Use your trading name when the brand customers recognize differs from the legal business name.</li>
              <li>Your logo upload goes through the attachment API and is stored alongside other company assets.</li>
              <li>Timezone and currency control estimate, invoice, and booking defaults throughout the app.</li>
            </ul>
          </section>
        </aside>
      </div>
    </PageLayout>
  );
}
