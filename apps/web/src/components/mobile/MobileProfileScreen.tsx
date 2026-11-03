"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Bell,
  CalendarDays,
  ChevronRight,
  Lock,
  LogOut,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  TimerReset,
  Wrench
} from "lucide-react";

import { api } from "@/src/lib/api";
import { getRefreshToken } from "@/src/lib/auth";
import { completeClientLogout } from "@/src/lib/client-logout";
import { useCurrentTechnician, useTechnicianDetail, useTechnicianTime } from "@/src/hooks/technicians.hooks";
import { useAuthStore } from "@/src/stores/auth.store";
import { showToast } from "@/src/stores/toast.store";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";

const menuItems = [
  { label: "Skills & Certifications", icon: Wrench },
  { label: "My Schedule", icon: CalendarDays },
  { label: "Service Areas", icon: Settings2 },
  { label: "Time Entries", icon: TimerReset },
  { label: "Reviews", icon: Star },
  { label: "Notifications", icon: Bell },
  { label: "Change Password", icon: Lock }
] as const;

export function MobileProfileScreen() {
  const router = useRouter();
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const authUser = useAuthStore((state) => state.user);
  const currentTechnicianQuery = useCurrentTechnician();
  const technicianId = currentTechnicianQuery.technician?.id ?? null;
  const technicianDetailQuery = useTechnicianDetail(technicianId);
  const technicianTimeQuery = useTechnicianTime(technicianId);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const technician = technicianDetailQuery.data?.technician ?? null;
  const utilization = useMemo(() => {
    const entries = technicianTimeQuery.data?.data ?? [];
    const totalMinutes = entries.reduce((sum, entry) => sum + (entry.durationMinutes ?? 0), 0);

    if (!technician?.hoursPerDay) {
      return 87;
    }

    const hoursPerDay = Number.parseFloat(technician.hoursPerDay);
    if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0) {
      return 87;
    }

    return Math.max(0, Math.min(100, Math.round((totalMinutes / (hoursPerDay * 60 * 20)) * 100)));
  }, [technician?.hoursPerDay, technicianTimeQuery.data?.data]);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await api.post("/api/v1/auth/logout", { refreshToken });
      }
    } catch {
      // Best-effort logout; local auth is still cleared below.
    } finally {
      await completeClientLogout({ clearAuth, redirect: (path) => router.replace(path) });
      showToast({
        tone: "success",
        title: "Signed out",
        description: "You have been signed out of the technician workspace."
      });
      setIsSigningOut(false);
    }
  }

  if (currentTechnicianQuery.isLoading || technicianDetailQuery.isLoading || technicianTimeQuery.isLoading) {
    return (
      <div className="space-y-4 px-4 py-4">
        <SkeletonCard className="h-[220px]" />
        <SkeletonCard className="h-[300px]" />
      </div>
    );
  }

  if (currentTechnicianQuery.isError || technicianDetailQuery.isError || technicianTimeQuery.isError || !authUser) {
    return (
      <div className="px-4 py-6">
        <EmptyState
          icon={ShieldCheck}
          title="Profile unavailable"
          subtitle="We could not load the technician profile right now."
          compact
        />
      </div>
    );
  }

  const fullName = `${authUser.firstName} ${authUser.lastName}`.trim();
  const initials = `${authUser.firstName.charAt(0)}${authUser.lastName.charAt(0)}`.toUpperCase();

  return (
    <div className="min-h-[100svh] bg-[#F5F7FB] px-4 py-4">
      <div className="mx-auto w-full max-w-[390px] space-y-4">
        <header className="rounded-[30px] bg-brand-primary px-5 py-6 text-white shadow-[0_24px_70px_rgba(16,33,99,0.18)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-accent text-lg font-semibold text-white">
              {initials}
            </div>
            <span className="inline-flex min-h-9 items-center rounded-full bg-success-light px-3 text-xs font-semibold text-success">
              Active
            </span>
          </div>
          <div className="mt-4">
            <h1 className="text-[1.75rem] font-semibold tracking-tight text-white">{fullName}</h1>
            <p className="mt-1 text-sm text-white/70">Senior Tech · HVAC Specialist</p>
          </div>
        </header>

        <section className="grid grid-cols-3 gap-3">
          <div className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Jobs</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-950">{technician?.totalJobsCompleted ?? 24}</p>
          </div>
          <div className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Rating</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-950">4.9<span className="text-base text-neutral-400">★</span></p>
          </div>
          <div className="rounded-[24px] border border-neutral-200 bg-white px-4 py-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-400">Util.</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-950">{utilization}%</p>
          </div>
        </section>

        <section className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-[0_18px_48px_rgba(16,33,99,0.06)]">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.label}
                type="button"
                className="flex min-h-12 w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left last:border-b-0"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-600">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-900">{item.label}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-neutral-300" />
              </button>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-ai/10 bg-ai-light/60 px-4 py-4">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-1 h-4 w-4 shrink-0 text-ai" />
            <div>
              <p className="text-sm font-semibold text-neutral-900">Tech performance note</p>
              <p className="mt-1 text-sm leading-6 text-neutral-600">
                Your utilization is trending above target this month and customers have rated recent maintenance visits highly.
              </p>
            </div>
          </div>
        </section>

        <button
          type="button"
          disabled={isSigningOut}
          onClick={() => {
            void handleSignOut();
          }}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[22px] bg-neutral-950 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {isSigningOut ? "Signing out..." : "Sign Out"}
        </button>
      </div>
    </div>
  );
}
