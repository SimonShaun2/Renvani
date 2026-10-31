"use client";

import { useEffect, useState } from "react";
import { Lock, PhoneCall, PhoneMissed, PlugZap } from "lucide-react";
import {
  CALL_OUTCOME_REGISTRY,
  CALL_RECORDING_CONSENT_MODE_REGISTRY,
  type CallRecord,
  type CallTrackingNumber,
  type CallTrackingSettings
} from "@fsm/types";

import { PageLayout } from "@/src/components/layout/PageLayout";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import {
  CALL_LIMIT,
  useCallRecords,
  useCallTrackingNumbers,
  useCallTrackingSettings,
  useCreateTrackingNumber,
  useUpdateCallTrackingSettings
} from "@/src/hooks/call-tracking.hooks";
import { ApiError } from "@/src/lib/api";
import { useAuthStore } from "@/src/stores/auth.store";
import { showToast } from "@/src/stores/toast.store";

/** Mirrors the API's requireRole(["owner", "admin"]) on every call-tracking route. */
const CALL_TRACKING_ROLES = new Set(["owner", "admin"]);

const errorMessage = (error: unknown) =>
  error instanceof ApiError && error.status === 409
    ? "Someone else changed this. Reload and try again."
    : error instanceof Error
      ? error.message
      : "Something went wrong";

const formatDuration = (s: number) => `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function ProviderNotice({ settings }: { settings: CallTrackingSettings }) {
  if (settings.providerReady) return null;
  return (
    <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="flex items-center gap-2 font-semibold">
        <PlugZap className="h-4 w-4" aria-hidden /> Call tracking provider not enabled
      </p>
      <p className="mt-1">
        No phone provider is connected yet, so no tracking numbers ring through and no calls are logged. Nothing below is sample data.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Before a tracking number goes live, you will need to verify that your shop owns the number it forwards to.</li>
        <li>Call recording stays off until the recording disclosure is on and you set the state whose recording notice applies.</li>
      </ul>
    </div>
  );
}

function SettingsCard({ settings }: { settings: CallTrackingSettings }) {
  const update = useUpdateCallTrackingSettings();
  const [disclosure, setDisclosure] = useState(settings.recordingDisclosureEnabled);
  const [noticeState, setNoticeState] = useState(settings.recordingNoticeState ?? "");
  const [consentMode, setConsentMode] = useState(settings.consentMode);
  const [recording, setRecording] = useState(settings.recordingEnabled);

  useEffect(() => {
    setDisclosure(settings.recordingDisclosureEnabled);
    setNoticeState(settings.recordingNoticeState ?? "");
    setConsentMode(settings.consentMode);
    setRecording(settings.recordingEnabled);
  }, [settings]);

  const stateValid = /^[A-Za-z]{2}$/.test(noticeState.trim());
  const canRecord = disclosure && stateValid;
  const effectiveRecording = recording && canRecord;

  const save = () =>
    update.mutate(
      {
        expectedVersion: settings.version,
        recordingDisclosureEnabled: disclosure,
        consentMode,
        recordingNoticeState: noticeState.trim() ? noticeState.trim().toUpperCase() : null,
        recordingEnabled: effectiveRecording
      },
      {
        onSuccess: () => showToast({ tone: "success", title: "Call tracking settings saved" }),
        onError: (error) => showToast({ tone: "error", title: "Could not save settings", description: errorMessage(error) })
      }
    );

  return (
    <section aria-labelledby="ct-settings" className="space-y-4 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 id="ct-settings" className="text-base font-semibold text-neutral-900">Settings</h2>
      <label className="flex items-center gap-2 text-sm text-neutral-500">
        <input type="checkbox" checked={settings.enabled} disabled aria-describedby="ct-enabled-help" />
        Track calls from my marketing numbers
      </label>
      <p id="ct-enabled-help" className="text-xs text-neutral-500">
        {settings.providerReady ? "Tracking is controlled by your connected provider." : "Available once a phone provider is enabled."}
      </p>

      <fieldset className="space-y-3 border-t border-neutral-100 pt-4">
        <legend className="text-sm font-semibold text-neutral-900">Call recording</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={disclosure} onChange={(e) => setDisclosure(e.target.checked)} />
          <span>Play a recording disclosure to every caller before the call connects (required to record)</span>
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700">Consent rule</span>
          <select className="mt-1 block rounded-md border border-neutral-300 px-2 py-1" value={consentMode} onChange={(e) => setConsentMode(e.target.value)}>
            {Object.entries(CALL_RECORDING_CONSENT_MODE_REGISTRY).map(([id, { label }]) => (
              <option key={id} value={id}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-neutral-700">State whose recording notice applies</span>
          <input
            className="mt-1 block w-20 rounded-md border border-neutral-300 px-2 py-1 uppercase"
            maxLength={2}
            placeholder="TX"
            value={noticeState}
            onChange={(e) => setNoticeState(e.target.value)}
          />
        </label>
        {settings.recordingNoticeState ? (
          <p role="note" className="text-xs text-neutral-600">
            Recording notice on file for {settings.recordingNoticeState}. Callers hear it before the call reaches your shop.
          </p>
        ) : (
          <p role="note" className="text-xs text-neutral-600">No state recording notice set yet.</p>
        )}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={effectiveRecording}
            disabled={!canRecord}
            onChange={(e) => setRecording(e.target.checked)}
            aria-describedby="ct-recording-help"
          />
          Record calls
        </label>
        {!canRecord ? (
          <p id="ct-recording-help" className="text-xs text-amber-800">
            Turn on the recording disclosure and set the notice state before recording can be enabled.
          </p>
        ) : null}
      </fieldset>

      <button
        type="button"
        onClick={save}
        disabled={update.isPending}
        className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {update.isPending ? "Saving…" : "Save settings"}
      </button>
    </section>
  );
}

function AddNumberForm() {
  const create = useCreateTrackingNumber();
  const [form, setForm] = useState({ trackingNumber: "", label: "", marketingSource: "", forwardingNumber: "" });
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    create.mutate(form, {
      onSuccess: () => {
        showToast({ tone: "success", title: "Tracking number added" });
        setForm({ trackingNumber: "", label: "", marketingSource: "", forwardingNumber: "" });
      },
      onError: (error) => showToast({ tone: "error", title: "Could not add number", description: errorMessage(error) })
    });
  };
  const field = "rounded-md border border-neutral-300 px-2 py-1 text-sm";
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-5" aria-label="Add tracking number">
      <input className={field} aria-label="Tracking number" placeholder="+15125550100" value={form.trackingNumber} onChange={set("trackingNumber")} required />
      <input className={field} aria-label="Label" placeholder="Google Business Profile" value={form.label} onChange={set("label")} required />
      <input className={field} aria-label="Marketing source" placeholder="google_business_profile" value={form.marketingSource} onChange={set("marketingSource")} required />
      <input className={field} aria-label="Rings to" placeholder="+15125550199" value={form.forwardingNumber} onChange={set("forwardingNumber")} required />
      <button type="submit" disabled={create.isPending} className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
        Add number
      </button>
    </form>
  );
}

function NumbersCard({ providerReady }: { providerReady: boolean }) {
  const q = useCallTrackingNumbers(true);
  return (
    <section aria-labelledby="ct-numbers" className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 id="ct-numbers" className="text-base font-semibold text-neutral-900">Tracking numbers</h2>
      <p className="text-xs text-neutral-500">One number per marketing source (yard signs, truck wraps, Google Business Profile, mailers) so you can see which source books jobs.</p>
      {providerReady ? <AddNumberForm /> : null}
      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState compact title="Could not load tracking numbers" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />
      ) : (q.data?.numbers.length ?? 0) === 0 ? (
        <EmptyState
          compact
          icon={PhoneCall}
          title="No tracking numbers yet"
          subtitle={providerReady ? "Add a number for each marketing source." : "Numbers can be added once a phone provider is enabled."}
        />
      ) : (
        <ul className="divide-y divide-neutral-100 text-sm">
          {q.data!.numbers.map((n: CallTrackingNumber) => (
            <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-medium">{n.label}</span>
              <span className="text-neutral-600">{n.trackingNumber} → {n.forwardingNumber}</span>
              <span className="text-neutral-500">{n.marketingSource}{n.active ? "" : " · paused"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CallsCard({ providerReady }: { providerReady: boolean }) {
  const q = useCallRecords(true);
  const numbers = useCallTrackingNumbers(true);
  const labelFor = (id: string) => numbers.data?.numbers.find((n) => n.id === id)?.label ?? "Tracking number";
  return (
    <section aria-labelledby="ct-calls" className="space-y-3 rounded-xl border border-neutral-200 bg-white p-5">
      <h2 id="ct-calls" className="text-base font-semibold text-neutral-900">Calls</h2>
      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState compact title="Could not load calls" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />
      ) : (q.data?.calls.length ?? 0) === 0 ? (
        <EmptyState
          compact
          icon={PhoneMissed}
          title="No calls logged yet"
          subtitle={providerReady ? "Calls to your tracking numbers, including missed calls, will show here." : "Calls will show here once a phone provider is enabled."}
        />
      ) : (
        <>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-neutral-500">
              <tr><th>When</th><th>Source</th><th>Caller</th><th>Duration</th><th>Outcome</th><th>Booked from call</th></tr>
            </thead>
            <tbody>
              {q.data!.calls.map((c: CallRecord) => (
                <tr key={c.id} className="border-t border-neutral-100">
                  <td>{formatDateTime(c.startedAt)}</td>
                  <td>{labelFor(c.trackingNumberId)}</td>
                  <td>{c.callerMasked}</td>
                  <td>{formatDuration(c.durationSeconds)}</td>
                  <td className={c.outcome === "missed" ? "font-medium text-red-700" : undefined}>{CALL_OUTCOME_REGISTRY[c.outcome]?.label ?? c.outcome}</td>
                  <td>{c.leadAttribution ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {q.data!.calls.length >= CALL_LIMIT ? <p className="text-xs text-neutral-500">Showing the latest {CALL_LIMIT} calls.</p> : null}
        </>
      )}
    </section>
  );
}

export function CallTrackingClient() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const allowed = role !== null && CALL_TRACKING_ROLES.has(role);
  const settings = useCallTrackingSettings(allowed);

  return (
    <PageLayout title="Call tracking" subtitle="See which marketing source made the phone ring, which calls were missed and which calls booked a job.">
      {!allowed ? (
        <EmptyState icon={Lock} title="Owners and admins only" subtitle="Ask your shop owner for access to call tracking." />
      ) : settings.isLoading ? (
        <SkeletonCard />
      ) : settings.isError || !settings.data ? (
        <ErrorState title="Could not load call tracking" onRetry={() => void settings.refetch()} isRetrying={settings.isFetching} />
      ) : (
        <div className="space-y-5">
          <ProviderNotice settings={settings.data.settings} />
          <SettingsCard settings={settings.data.settings} />
          <NumbersCard providerReady={settings.data.settings.providerReady} />
          <CallsCard providerReady={settings.data.settings.providerReady} />
        </div>
      )}
    </PageLayout>
  );
}
