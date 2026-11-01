"use client";

import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useGoogleBusinessProfileStatus, useSetGoogleBusinessProfileOptIn } from "@/src/hooks/google-business-profile.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import { canManageGoogleBusinessProfile, describeConnection, describeOptIn, formatUpdatedAt } from "./google-business.utils";

// Styles from Figma 10:1678 "Operator / 13 Settings · Agents, policy & consent":
// card 10:1749 (white, #e6dccb border, radius 14), header strip 10:1750 (#fbf6ef, 10px medium #5e6684),
// row labels 10:1756 (13px semibold #0f1530) and copy 10:1757 (13px #2a3360), divider 10:1760 (#e6dccb).
// Buttons: primary 10:1748 (#f6b400) and secondary 10:1746 (white, #e6dccb border), 44px, 18px padding, radius 10, 14px semibold #0f1530.
// Pills from 10:2083: Live 10:2173 (#e4f1e8/#2f7d4f) and Draft 10:2185 (#eef0f5/#2a3360), 24px, radius 999.
const card = "rounded-[14px] border border-[#e6dccb] bg-white";
const strip = "bg-[#fbf6ef] px-5 py-2.5 text-[10px] font-medium uppercase tracking-wide text-[#5e6684] rounded-t-[14px]";
const rowLabel = "text-[13px] font-semibold text-[#0f1530]";
const rowCopy = "text-[13px] text-[#2a3360]";
const primaryButton =
  "inline-flex h-11 items-center justify-center rounded-[10px] bg-[#f6b400] px-[18px] text-sm font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButton =
  "inline-flex h-11 items-center justify-center rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-sm font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:opacity-50";
const pillOn = "inline-flex h-6 items-center rounded-full bg-[#e4f1e8] px-2.5 text-xs font-semibold text-[#2f7d4f]";
const pillOff = "inline-flex h-6 items-center rounded-full bg-[#eef0f5] px-2.5 text-xs font-semibold text-[#2a3360]";

export function GoogleBusinessProfileSettings() {
  const role = useAuthStore((s) => s.user?.role ?? null);
  const allowed = canManageGoogleBusinessProfile(role);
  const status = useGoogleBusinessProfileStatus(allowed);
  const setOptIn = useSetGoogleBusinessProfileOptIn();

  if (!allowed) {
    return (
      <p role="status" className="surface-card px-6 py-4 text-sm text-neutral-700">
        Only an owner or admin can manage the Google Business Profile connection.
      </p>
    );
  }
  if (status.isLoading) return <SkeletonCard />;
  if (status.isError || !status.data) {
    return <ErrorState title="Couldn't load your Google Business Profile settings" onRetry={() => void status.refetch()} />;
  }

  const s = status.data.googleBusinessProfile;
  const conn = describeConnection(s);
  const opt = describeOptIn(s);
  const updated = formatUpdatedAt(s.updatedAt);
  const busy = setOptIn.isPending || status.isFetching;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[#0f1530]">Google Business Profile</h2>
        <p className="mt-1 text-sm text-[#5e6684]">
          Let Renvani read your shop&apos;s Google listing (hours, services and reviews) so your HVAC, plumbing or electrical
          business shows up the same everywhere. Read-only: Renvani never posts to Google or replies to reviews from here.
        </p>
      </div>

      <section className={card} aria-label="Google Business Profile connection">
        <div className={strip}>Connection</div>
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="max-w-xl">
            <p className={rowLabel}>Google connection</p>
            <p className={rowCopy} data-testid="gbp-connection-detail">{conn.detail}</p>
          </div>
          <span data-testid="gbp-connection" className={conn.key === "connected" ? pillOn : pillOff}>{conn.label}</span>
        </div>
        <div className="h-px bg-[#e6dccb]" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="max-w-xl">
            <p className={rowLabel}>Your shop&apos;s opt-in</p>
            <p className={rowCopy}>
              {opt.on
                ? "You've opted in. Renvani may read your listing when the Google connection is on."
                : "You haven't opted in. Renvani will not read your Google listing."}
              {updated ? <span className="block text-[12px] text-[#5e6684]">Last changed {updated}</span> : null}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span data-testid="gbp-optin" className={opt.on ? pillOn : pillOff}>{opt.label}</span>
            {opt.on ? (
              <button type="button" className={secondaryButton} disabled={busy} onClick={() => setOptIn.mutate(false)}>
                {setOptIn.isPending ? "Saving…" : "Opt out"}
              </button>
            ) : (
              <button type="button" className={primaryButton} disabled={busy} onClick={() => setOptIn.mutate(true)}>
                {setOptIn.isPending ? "Saving…" : "Opt in"}
              </button>
            )}
          </div>
        </div>
      </section>

      {setOptIn.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[14px] border border-error/30 bg-white px-5 py-4 text-[13px] text-error">
          <span>Couldn&apos;t save your choice. Reload to see the current setting, then try again.</span>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setOptIn.reset();
              void status.refetch();
            }}
          >
            Reload
          </button>
        </div>
      ) : null}
    </div>
  );
}
