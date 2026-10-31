"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Link2, Save } from "lucide-react";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { StatBadge } from "@/src/components/ui/StatBadge";
import {
  useReviewSettings,
  useUpdateReviewSettings
} from "@/src/hooks/review-requests.hooks";
import { ApiError } from "@/src/lib/api";
import { getStoredSession } from "@/src/lib/auth";
import { useAuthStore } from "@/src/stores/auth.store";
import { showToast } from "@/src/stores/toast.store";

type ReviewLinksForm = {
  googleReviewUrl: string;
  yelpReviewUrl: string;
  facebookReviewUrl: string;
  customReviewUrl: string;
};

function ReviewPlatformCard({
  label,
  description,
  value,
  onChange
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const isActive = value.trim().length > 0;

  return (
    <div className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-neutral-900">{label}</h2>
          <p className="mt-1 text-sm leading-6 text-neutral-500">{description}</p>
        </div>
        <StatBadge label={isActive ? "Active" : "Inactive"} tone={isActive ? "green" : "gray"} />
      </div>

      <label className="mt-5 block">
        <span className="text-sm font-semibold text-neutral-700">Review URL</span>
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`Paste the ${label} review link`}
          className="mt-2 min-h-12 w-full rounded-[22px] border border-neutral-200 px-4 text-sm text-neutral-700 outline-none transition focus:border-brand-accent"
        />
      </label>

      <div className="mt-4 flex items-center justify-between gap-3 rounded-[22px] bg-neutral-50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Preview</p>
          <p className="mt-1 truncate text-sm text-neutral-500">{isActive ? value : "Not configured yet"}</p>
        </div>
        <a
          href={isActive ? value : "#"}
          target="_blank"
          rel="noreferrer"
          className={[
            "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition",
            isActive
              ? "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50"
              : "pointer-events-none bg-neutral-100 text-neutral-300"
          ].join(" ")}
        >
          <ExternalLink className="h-4 w-4" />
          Open
        </a>
      </div>
    </div>
  );
}

export function ReviewLinkSettingsClient() {
  const authUser = useAuthStore((state) => state.user);
  const settingsQuery = useReviewSettings();
  const updateSettings = useUpdateReviewSettings();
  const fallbackSession = useMemo(() => (authUser ? null : getStoredSession()), [authUser]);
  const role = authUser?.role ?? fallbackSession?.role ?? null;
  const canEdit =
    role === "owner" || role === "admin" || role === "dispatcher" || role === "office";
  const [form, setForm] = useState<ReviewLinksForm>({
    googleReviewUrl: "",
    yelpReviewUrl: "",
    facebookReviewUrl: "",
    customReviewUrl: ""
  });

  useEffect(() => {
    const settings = settingsQuery.data?.settings;
    if (!settings) {
      return;
    }

    setForm({
      googleReviewUrl: settings.googleReviewUrl ?? "",
      yelpReviewUrl: settings.yelpReviewUrl ?? "",
      facebookReviewUrl: settings.facebookReviewUrl ?? "",
      customReviewUrl: settings.customReviewUrl ?? ""
    });
  }, [settingsQuery.data?.settings]);

  async function handleSave() {
    if (!canEdit) {
      showToast({
        tone: "error",
        title: "Settings are read only",
        description: "Technician accounts cannot update review destinations."
      });
      return;
    }

    try {
      await updateSettings.mutateAsync({
        googleReviewUrl: form.googleReviewUrl.trim() || null,
        yelpReviewUrl: form.yelpReviewUrl.trim() || null,
        facebookReviewUrl: form.facebookReviewUrl.trim() || null,
        customReviewUrl: form.customReviewUrl.trim() || null
      });
      showToast({
        tone: "success",
        title: "Review links saved",
        description: "New review requests will use the updated destinations."
      });
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Review links could not be saved.";
      showToast({
        tone: "error",
        title: "Save failed",
        description: message
      });
    }
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[96px]" />
        <SkeletonCard className="h-[520px]" />
      </div>
    );
  }

  if (settingsQuery.isError || !settingsQuery.data?.settings) {
    return (
      <PageLayout
        title="Review Link Settings"
        subtitle="Choose where satisfied customers land after leaving feedback from a review request."
      >
        <section className="surface-card px-5 py-12 text-center">
          <h2 className="text-xl font-semibold tracking-tight text-neutral-900">Review links unavailable</h2>
          <p className="mt-3 text-sm leading-6 text-neutral-500">
            We couldn&apos;t load the current review destinations. Refresh and try again.
          </p>
        </section>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Review Link Settings"
      subtitle="Choose where satisfied customers land after leaving feedback from a review request."
      actions={(
        <button
          type="button"
          onClick={() => {
            void handleSave();
          }}
          disabled={updateSettings.isPending}
          className="inline-flex items-center gap-2 rounded-full bg-brand-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-primary disabled:cursor-not-allowed disabled:opacity-70"
        >
          <Save className="h-4 w-4" />
          {updateSettings.isPending ? "Saving..." : "Save Review Links"}
        </button>
      )}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <ReviewPlatformCard
            label="Google"
            description="Most customers expect to leave a Google review first. Use your direct review URL here."
            value={form.googleReviewUrl}
            onChange={(value) => setForm((current) => ({ ...current, googleReviewUrl: value }))}
          />
          <ReviewPlatformCard
            label="Yelp"
            description="Great for residential service customers who already find you through local search."
            value={form.yelpReviewUrl}
            onChange={(value) => setForm((current) => ({ ...current, yelpReviewUrl: value }))}
          />
          <ReviewPlatformCard
            label="Facebook"
            description="Useful when your social audience is a major source of repeat calls and referrals."
            value={form.facebookReviewUrl}
            onChange={(value) => setForm((current) => ({ ...current, facebookReviewUrl: value }))}
          />
          <ReviewPlatformCard
            label="Custom"
            description="Use a branded landing page or niche review destination when that fits your follow-up flow better."
            value={form.customReviewUrl}
            onChange={(value) => setForm((current) => ({ ...current, customReviewUrl: value }))}
          />
        </div>

        <aside className="space-y-6">
          <section className="surface-card px-5 py-5">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-brand-accent" />
              <h2 className="text-base font-semibold text-neutral-900">How this is used</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm leading-6 text-neutral-500">
              <p>1. A completed job sends a review request by SMS or email.</p>
              <p>2. The customer taps the review link and leaves an internal rating first.</p>
              <p>3. After submission, Renvani opens your preferred public review destination in a new tab.</p>
            </div>
          </section>

          <section className="surface-card px-5 py-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Active Destinations</p>
            <div className="mt-4 space-y-3">
              {[
                { label: "Google", url: form.googleReviewUrl },
                { label: "Yelp", url: form.yelpReviewUrl },
                { label: "Facebook", url: form.facebookReviewUrl },
                { label: "Custom", url: form.customReviewUrl }
              ].map((platform) => (
                <div
                  key={platform.label}
                  className="rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-neutral-900">{platform.label}</p>
                      <p className="mt-1 truncate text-xs text-neutral-500">
                        {platform.url.trim() || "Not configured"}
                      </p>
                    </div>
                    <StatBadge
                      label={platform.url.trim() ? "Active" : "Inactive"}
                      tone={platform.url.trim() ? "green" : "gray"}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </PageLayout>
  );
}
