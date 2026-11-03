"use client";

import { useEffect, useMemo, useState } from "react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useBookingSettings, useUpdateBookingSettings } from "@/src/hooks/booking.hooks";
import { useUnsavedChanges } from "@/src/hooks/useUnsavedChanges";
import { ApiError } from "@/src/lib/api";
import { showToast } from "@/src/stores/toast.store";

export default function BookingAppearanceSettingsPage() {
  const settingsQuery = useBookingSettings();
  const updateSettings = useUpdateBookingSettings();
  const settings = settingsQuery.data?.settings ?? null;
  const initialTagline = useMemo(() => settings?.tagline ?? "", [settings?.tagline]);
  const [tagline, setTagline] = useState(initialTagline);
  const [hasInitialized, setHasInitialized] = useState(false);
  const isDirty = tagline !== initialTagline;

  useUnsavedChanges({ isDirty });

  useEffect(() => {
    if (!hasInitialized || !isDirty) {
      setTagline(initialTagline);
    }

    setHasInitialized(true);
  }, [hasInitialized, initialTagline, isDirty]);

  async function handleSave() {
    if (!isDirty) {
      return;
    }

    try {
      await updateSettings.mutateAsync({
        tagline: tagline.trim() || null
      });

      showToast({
        tone: "success",
        title: "Booking appearance saved",
        description: "The public booking page will use the updated tagline."
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Save failed",
        description: error instanceof ApiError ? error.message : "Booking appearance could not be saved."
      });
    }
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[96px]" />
        <SkeletonCard className="h-[300px]" />
      </div>
    );
  }

  return (
    <PageLayout
      title="Booking Appearance"
      subtitle="Set the short public tagline shown on the branded online booking page."
      actions={
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={!isDirty || updateSettings.isPending}
          className="inline-flex min-h-11 items-center rounded-full bg-brand-accent px-5 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updateSettings.isPending ? "Saving..." : "Save Appearance"}
        </button>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="rounded-[30px] border border-neutral-200 bg-white px-6 py-6 shadow-sm">
          <label className="block">
            <span className="text-sm font-semibold text-neutral-700">Booking page tagline</span>
            <input
              value={tagline}
              onChange={(event) => setTagline(event.target.value)}
              onBlur={() => {
                void handleSave();
              }}
              placeholder="Fast service, smarter follow-up, and zero scheduling friction."
              className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
            />
          </label>
        </section>

        <aside className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Preview</p>
          <div className="mt-4 rounded-[24px] border border-neutral-200 bg-brand-primary px-5 py-5 text-white">
            <p className="text-sm font-semibold">Renvani online booking</p>
            <p className="mt-2 text-sm text-white/75">{tagline.trim() || "Your tagline will appear here once saved."}</p>
          </div>
        </aside>
      </div>
    </PageLayout>
  );
}
