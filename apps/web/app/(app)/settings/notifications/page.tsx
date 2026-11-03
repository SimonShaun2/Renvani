"use client";

import { useEffect, useMemo, useState } from "react";
import type { CompanyNotificationSettings, NotificationChannelPreferences } from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { COMPANY_NOTIFICATION_EVENT_COPY } from "@/src/components/settings/settings.constants";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useCompany, useUpdateCompany } from "@/src/hooks/company.hooks";
import { useUnsavedChanges } from "@/src/hooks/useUnsavedChanges";
import { ApiError } from "@/src/lib/api";
import { showToast } from "@/src/stores/toast.store";

type NotificationSettingKey = (typeof COMPANY_NOTIFICATION_EVENT_COPY)[number]["key"];

type NotificationSettingsForm = Record<NotificationSettingKey, NotificationChannelPreferences>;

const DEFAULT_CHANNEL_PREFERENCES: NotificationChannelPreferences = {
  email: true,
  sms: false
};

function normalizeNotifications(settings: CompanyNotificationSettings | null | undefined): NotificationSettingsForm {
  return {
    estimateFollowUp: settings?.estimateFollowUp ?? DEFAULT_CHANNEL_PREFERENCES,
    invoiceRecovery: settings?.invoiceRecovery ?? DEFAULT_CHANNEL_PREFERENCES,
    reviewRequest: settings?.reviewRequest ?? DEFAULT_CHANNEL_PREFERENCES,
    bookingRequest: settings?.bookingRequest ?? DEFAULT_CHANNEL_PREFERENCES,
    paymentReceived: settings?.paymentReceived ?? DEFAULT_CHANNEL_PREFERENCES,
    serviceDueAlert: settings?.serviceDueAlert ?? DEFAULT_CHANNEL_PREFERENCES
  };
}

export default function SettingsNotificationsPage() {
  const companyQuery = useCompany();
  const updateCompany = useUpdateCompany();
  const company = companyQuery.data?.company ?? null;
  const initialForm = useMemo(
    () => normalizeNotifications(company?.settings?.notifications),
    [company?.settings?.notifications]
  );
  const [form, setForm] = useState<NotificationSettingsForm>(initialForm);
  const [hasInitialized, setHasInitialized] = useState(false);
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialForm);

  useUnsavedChanges({ isDirty });

  useEffect(() => {
    if (!hasInitialized || !isDirty) {
      setForm(initialForm);
    }

    setHasInitialized(true);
  }, [hasInitialized, initialForm, isDirty]);

  async function handleSave() {
    if (!company || !isDirty) {
      return;
    }

    try {
      await updateCompany.mutateAsync({
        settings: {
          notifications: form
        }
      });

      showToast({
        tone: "success",
        title: "Notification preferences saved",
        description: "Renvani will use the updated channel preferences for future events."
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Save failed",
        description: error instanceof ApiError ? error.message : "Notification preferences could not be saved."
      });
    }
  }

  if (companyQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[96px]" />
        <SkeletonCard className="h-[560px]" />
      </div>
    );
  }

  if (companyQuery.isError || !company) {
    return (
      <PageLayout
        title="Notifications"
        subtitle="Choose which alerts the office receives by email or SMS for key business events."
      >
        <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-12 text-center shadow-sm">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Notification settings unavailable</h2>
          <p className="mt-3 text-sm text-neutral-500">Refresh and try again to load the current preferences.</p>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Notifications"
      subtitle="Choose which alerts the office receives by email or SMS for key business events."
      actions={
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={!isDirty || updateCompany.isPending}
          className="inline-flex min-h-11 items-center rounded-full bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updateCompany.isPending ? "Saving..." : "Save Preferences"}
        </button>
      }
    >
      <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
        <div className="grid grid-cols-[minmax(0,1.4fr)_120px_120px] gap-3 border-b border-neutral-100 pb-3 text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">
          <span>Event</span>
          <span>Email</span>
          <span>SMS</span>
        </div>

        <div className="mt-2 space-y-2">
          {COMPANY_NOTIFICATION_EVENT_COPY.map((item) => (
            <div
              key={item.key}
              className="grid grid-cols-[minmax(0,1.4fr)_120px_120px] gap-3 rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-4"
            >
              <div>
                <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
                <p className="mt-1 text-sm text-neutral-500">{item.description}</p>
              </div>

              <label className="flex items-center gap-3 text-sm font-semibold text-neutral-700">
                <input
                  type="checkbox"
                  checked={form[item.key].email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [item.key]: {
                        ...current[item.key],
                        email: event.target.checked
                      }
                    }))
                  }
                  onBlur={() => {
                    void handleSave();
                  }}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                Email
              </label>

              <label className="flex items-center gap-3 text-sm font-semibold text-neutral-700">
                <input
                  type="checkbox"
                  checked={form[item.key].sms}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      [item.key]: {
                        ...current[item.key],
                        sms: event.target.checked
                      }
                    }))
                  }
                  onBlur={() => {
                    void handleSave();
                  }}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                SMS
              </label>
            </div>
          ))}
        </div>
      </section>
    </PageLayout>
  );
}
