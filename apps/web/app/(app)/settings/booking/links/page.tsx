"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

import { CurrencyDisplay } from "@/src/components/ui/CurrencyDisplay";
import { PageLayout } from "@/src/components/layout/PageLayout";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import { useBookingSettings, useBookingStats } from "@/src/hooks/booking.hooks";
import { showToast } from "@/src/stores/toast.store";

const PLATFORMS = [
  {
    id: "google",
    name: "Google Business Profile",
    icon: "G",
    instructions: "Google Business > Info > Appointments > Add booking link"
  },
  {
    id: "facebook",
    name: "Facebook Page",
    icon: "f",
    instructions: "Facebook Page > Edit > Add Action Button > Book Now"
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "I",
    instructions: "Instagram > Edit Profile > Link in Bio"
  },
  {
    id: "yelp",
    name: "Yelp",
    icon: "Y",
    instructions: "Yelp Business > Add booking button"
  },
  {
    id: "direct",
    name: "Direct / QR Code",
    icon: "•",
    instructions: "Use on website, email signatures, printed materials"
  }
] as const;

function PlatformBadge({ icon }: { icon: string }) {
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-accent-light text-sm font-semibold text-brand-accent">
      {icon}
    </div>
  );
}

export default function BookingLinksSettingsPage() {
  const settingsQuery = useBookingSettings();
  const statsQuery = useBookingStats(30);
  const qrWrapperRef = useRef<HTMLDivElement | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const bookingSlug = settingsQuery.data?.settings.bookingSlug ?? "booking";
  const masterUrl = useMemo(() => `${origin}/book/${bookingSlug}`, [bookingSlug, origin]);

  function buildPlatformUrl(platformId: string) {
    return `${masterUrl}?src=${platformId}`;
  }

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast({
        tone: "success",
        title: `${label} copied`,
        description: value
      });
    } catch (error) {
      showToast({
        tone: "error",
        title: "Clipboard unavailable",
        description: error instanceof Error ? error.message : "Copy this link manually."
      });
    }
  }

  function handleDownloadQr() {
    const canvas = qrWrapperRef.current?.querySelector("canvas");
    if (!canvas) {
      showToast({
        tone: "error",
        title: "QR code not ready",
        description: "Try again in a moment."
      });
      return;
    }

    const downloadLink = document.createElement("a");
    downloadLink.href = canvas.toDataURL("image/png");
    downloadLink.download = `booking-qr-${bookingSlug}.png`;
    downloadLink.click();
  }

  if (settingsQuery.isLoading || statsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonCard className="h-[96px]" />
        <SkeletonCard className="h-[480px]" />
      </div>
    );
  }

  const stats = statsQuery.data?.stats;

  return (
    <PageLayout
      title="Online Booking"
      subtitle="Share branded booking links from Google, Facebook, Instagram, and direct channels."
      actions={
        <a
          href={masterUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
        >
          <ExternalLink className="h-4 w-4" />
          Preview Booking Page
        </a>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[30px] border border-brand-accent/10 bg-white shadow-sm">
            <div className="border-b border-neutral-100 bg-brand-accent-light/55 px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-accent">Your Booking URL</p>
              <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-neutral-900">{masterUrl}</p>
                  <p className="mt-1 text-sm text-neutral-500">Share this anywhere customers can book directly.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleCopy(masterUrl, "Master booking URL");
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-brand-accent px-4 text-sm font-semibold text-white transition hover:bg-brand-primary"
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </button>
              </div>
            </div>

            <div className="grid gap-6 px-6 py-6 lg:grid-cols-[minmax(0,1fr)_212px]">
              <div className="space-y-4">
                {PLATFORMS.map((platform) => {
                  const url = buildPlatformUrl(platform.id);

                  return (
                    <details key={platform.id} className="group rounded-[24px] border border-neutral-200 bg-neutral-50 px-4 py-4">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <PlatformBadge icon={platform.icon} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-neutral-900">{platform.name}</p>
                            <p className="truncate text-xs text-neutral-500">{url}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            void handleCopy(url, platform.name);
                          }}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
                        >
                          <Copy className="h-4 w-4" />
                          Copy
                        </button>
                      </summary>
                      <div className="mt-4 rounded-[20px] bg-white px-4 py-4 text-sm leading-6 text-neutral-600">
                        <p className="font-semibold text-neutral-900">How to set it up</p>
                        <p className="mt-2">{platform.instructions}</p>
                      </div>
                    </details>
                  );
                })}
              </div>

              <div className="rounded-[28px] border border-neutral-200 bg-neutral-50 px-5 py-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <QrCode className="h-4 w-4 text-brand-accent" />
                  QR Code for Booking
                </div>
                <p className="mt-2 text-sm text-neutral-500">
                  Print this on invoices, vans, business cards, and service reports.
                </p>
                <div ref={qrWrapperRef} className="mt-5 flex justify-center rounded-[24px] bg-white px-4 py-4">
                  <QRCodeCanvas value={masterUrl} size={128} includeMargin />
                </div>
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-neutral-700 ring-1 ring-neutral-200 transition hover:bg-neutral-50"
                >
                  <Download className="h-4 w-4" />
                  Download PNG
                </button>
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Booking Performance</p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[22px] bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Total Bookings</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">{stats?.totalRequests ?? 0}</p>
              </div>
              <div className="rounded-[22px] bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Confirmed</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">{stats?.confirmedBookings ?? 0}</p>
              </div>
              <div className="rounded-[22px] bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Confirmation Rate</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">{stats?.confirmationRate ?? 0}%</p>
              </div>
              <div className="rounded-[22px] bg-neutral-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Est. Revenue</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
                  <CurrencyDisplay value={stats?.estimatedRevenue ?? "0"} />
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-neutral-200 bg-white px-5 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">By Source</p>
            <div className="mt-4 space-y-3">
              {(stats?.bySource ?? []).length > 0 ? (
                stats?.bySource.map((item) => (
                  <div key={item.source} className="rounded-[20px] bg-neutral-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-neutral-900">{item.source}</span>
                      <span className="text-sm font-semibold text-brand-accent">{item.count}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-neutral-500">No booking traffic yet in the selected window.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </PageLayout>
  );
}
