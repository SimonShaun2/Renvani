"use client";

import { useEffect, useState } from "react";
import {
  CALL_OUTCOME_REGISTRY,
  CALL_RECORDING_CONSENT_MODE_REGISTRY,
  type CallRecord,
  type CallTrackingNumber,
  type CallTrackingSettings
} from "@fsm/types";

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

// Figma 366:4319 / 366:4597 / 366:4840 (Operator / 10b Growth Check · Call tracking) styles.
const card = "space-y-3.5 rounded-[14px] border border-[#e6dccb] bg-white p-5";
const cardTitle = "text-[17px] font-semibold text-[#0f1530]";
const help = "text-[12.5px] text-[#5e6684]";
const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] focus-visible:ring-offset-2";
const darkButton = `inline-flex h-11 items-center justify-center rounded-[10px] bg-[#0f1530] px-[18px] text-sm font-semibold text-white disabled:opacity-50 ${focusRing}`;
const secondaryButton = `inline-flex h-11 items-center justify-center rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-[13px] font-semibold text-[#0f1530] lg:h-10 ${focusRing}`;
const fieldLabel = "block text-[13px] font-medium text-[#2a3360]";
const input = "mt-1.5 block h-11 w-full rounded-[8px] border border-[#e6dccb] bg-white px-3 text-sm text-[#0f1530] outline-none placeholder:text-[#5e6684] focus:border-[#0f1530]";

function Pill({ tone, children }: { tone: "neutral" | "error"; children: React.ReactNode }) {
  const c = tone === "error" ? "bg-[#fbe3dc] text-[#b42318]" : "bg-[#eef0f5] text-[#2a3360]";
  return <span className={`inline-flex h-[22px] w-fit shrink-0 items-center rounded-full px-2.5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${c}`}>{children}</span>;
}

function Alert({ tone = "neutral", title, detail, children }: { tone?: "neutral" | "error"; title: string; detail?: string; children?: React.ReactNode }) {
  const [box, t, d] = tone === "error" ? ["bg-[#fbe3dc]", "text-[#b42318]", "text-[#b42318]"] : ["bg-[#eef0f5]", "text-[#0f1530]", "text-[#2a3360]"];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={`space-y-1.5 rounded-[10px] p-3.5 ${box}`}>
      <p className={`text-sm font-semibold ${t}`}>{title}</p>
      {detail ? <p className={`text-[13px] ${d}`}>{detail}</p> : null}
      {children}
    </div>
  );
}

/** Switch-styled checkbox (Figma "Switch / off"); stays a native checkbox for a11y and tests. */
function Switch({ checked, onChange, disabled, children, describedBy }: { checked: boolean; onChange?: (v: boolean) => void; disabled?: boolean; children: React.ReactNode; describedBy?: string }) {
  return (
    <label className={`flex min-h-11 items-center gap-3 text-[13.5px] ${disabled ? "text-[#5e6684]" : "text-[#0f1530]"}`}>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className={`peer h-6 w-10 cursor-pointer appearance-none rounded-full border border-[#5e6684] bg-[#eef0f5] checked:border-[#0f1530] checked:bg-[#0f1530] disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
          checked={checked}
          disabled={disabled}
          aria-describedby={describedBy}
          onChange={(e) => onChange?.(e.target.checked)}
        />
        <span aria-hidden className="pointer-events-none absolute left-1 top-1 h-4 w-4 rounded-full bg-[#5e6684] transition-transform peer-checked:translate-x-4 peer-checked:bg-white" />
      </span>
      <span>{children}</span>
    </label>
  );
}

function ConflictCard({ onReload }: { onReload: () => void }) {
  return (
    <section aria-label="Could not save" className={card}>
      <Pill tone="error">Conflict</Pill>
      <Alert tone="error" title="Someone else changed this." detail="Reload and try again.">
        <div className="pt-1">
          <button type="button" className={secondaryButton} onClick={onReload}>Reload</button>
        </div>
      </Alert>
    </section>
  );
}

function SettingsCard({ settings, onConflict }: { settings: CallTrackingSettings; onConflict: () => void }) {
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
        onError: (error) => {
          // Figma "State / Could not save": inline CONFLICT card with Reload instead of a toast.
          if (error instanceof ApiError && error.status === 409) onConflict();
          else showToast({ tone: "error", title: "Could not save settings", description: errorMessage(error) });
        }
      }
    );

  return (
    <section aria-labelledby="ct-settings" className={card}>
      <h2 id="ct-settings" className={cardTitle}>Call recording</h2>
      <Switch checked={settings.enabled} disabled describedBy="ct-enabled-help">Track calls from my marketing numbers</Switch>
      <p id="ct-enabled-help" className={help}>
        {settings.providerReady ? "Tracking is controlled by your connected provider." : "Available once a phone provider is enabled."}
      </p>
      <Switch checked={disclosure} onChange={setDisclosure}>
        Play a recording disclosure to every caller before the call connects (required to record)
      </Switch>
      <label className={fieldLabel}>
        Consent rule
        <select className={input} value={consentMode} onChange={(e) => setConsentMode(e.target.value)}>
          {Object.entries(CALL_RECORDING_CONSENT_MODE_REGISTRY).map(([id, { label }]) => (
            <option key={id} value={id}>{label}</option>
          ))}
        </select>
      </label>
      <label className={fieldLabel}>
        State whose recording notice applies
        <input
          className={`${input} uppercase placeholder:normal-case`}
          maxLength={2}
          placeholder="No state recording notice set yet."
          value={noticeState}
          onChange={(e) => setNoticeState(e.target.value)}
        />
      </label>
      {settings.recordingNoticeState ? (
        <p role="note" className={help}>
          Recording notice on file for {settings.recordingNoticeState}. Callers hear it before the call reaches your shop.
        </p>
      ) : null}
      <Switch checked={effectiveRecording} disabled={!canRecord} onChange={setRecording} describedBy="ct-recording-help">
        Record calls
      </Switch>
      <p id="ct-recording-help" className={help}>
        Call recording stays off until the recording disclosure is on and you set the state whose recording notice applies.
      </p>
      <button type="button" onClick={save} disabled={update.isPending} className={`${darkButton} w-full md:h-12 lg:h-11 lg:w-auto`}>
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
  const field = input.replace("mt-1.5 ", "");
  return (
    <form onSubmit={submit} className="grid gap-2 sm:grid-cols-2" aria-label="Add tracking number">
      <input className={field} aria-label="Tracking number" placeholder="+15125550100" value={form.trackingNumber} onChange={set("trackingNumber")} required />
      <input className={field} aria-label="Label" placeholder="Google Business Profile" value={form.label} onChange={set("label")} required />
      <input className={field} aria-label="Marketing source" placeholder="google_business_profile" value={form.marketingSource} onChange={set("marketingSource")} required />
      <input className={field} aria-label="Rings to" placeholder="+15125550199" value={form.forwardingNumber} onChange={set("forwardingNumber")} required />
      <button type="submit" disabled={create.isPending} className={`${darkButton} w-fit lg:h-10`}>
        Add tracking number
      </button>
    </form>
  );
}

function NumbersCard({ providerReady }: { providerReady: boolean }) {
  const q = useCallTrackingNumbers(true);
  return (
    <section aria-labelledby="ct-numbers" className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="ct-numbers" className={cardTitle}>Tracking numbers</h2>
        {!providerReady ? <Pill tone="neutral">Provider not enabled</Pill> : null}
      </div>
      <p className="text-[13.5px] text-[#2a3360]">One number per marketing source (yard signs, truck wraps, Google Business Profile, mailers) so you can see which source books jobs.</p>
      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState compact title="Could not load tracking numbers" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />
      ) : (q.data?.numbers.length ?? 0) === 0 ? (
        <Alert
          title="No tracking numbers yet"
          detail={providerReady ? "Add a number for each marketing source." : "Numbers can be added once a phone provider is enabled."}
        />
      ) : (
        <ul className="divide-y divide-[#e6dccb] text-sm">
          {q.data!.numbers.map((n: CallTrackingNumber) => (
            <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
              <span className="font-medium text-[#0f1530]">{n.label}</span>
              <span className="text-[#2a3360]">{n.trackingNumber} → {n.forwardingNumber}</span>
              <span className="text-[#5e6684]">{n.marketingSource}{n.active ? "" : " · paused"}</span>
            </li>
          ))}
        </ul>
      )}
      {providerReady ? (
        <AddNumberForm />
      ) : (
        <button type="button" disabled className="inline-flex h-11 w-fit cursor-not-allowed items-center rounded-[10px] bg-[#eef0f5] px-[18px] text-[13px] font-semibold text-[#5e6684] lg:h-10">
          Add tracking number
        </button>
      )}
      <p className={help}>Before a tracking number goes live, you will need to verify that your shop owns the number it forwards to.</p>
    </section>
  );
}

function CallsCard({ providerReady }: { providerReady: boolean }) {
  const q = useCallRecords(true);
  const numbers = useCallTrackingNumbers(true);
  const labelFor = (id: string) => numbers.data?.numbers.find((n) => n.id === id)?.label ?? "Tracking number";
  return (
    <section aria-labelledby="ct-calls" className={card}>
      <h2 id="ct-calls" className={cardTitle}>Calls</h2>
      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError ? (
        <ErrorState compact title="Could not load calls" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />
      ) : (q.data?.calls.length ?? 0) === 0 ? (
        <Alert
          title="No calls logged yet"
          detail={providerReady ? "Calls to your tracking numbers, including missed calls, will show here." : "Calls will show here once a phone provider is enabled."}
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-[#0f1530]">
              <thead className="text-xs text-[#5e6684]">
                <tr><th>When</th><th>Source</th><th>Caller</th><th>Duration</th><th>Outcome</th><th>Booked from call</th></tr>
              </thead>
              <tbody>
                {q.data!.calls.map((c: CallRecord) => (
                  <tr key={c.id} className="border-t border-[#e6dccb]">
                    <td>{formatDateTime(c.startedAt)}</td>
                    <td>{labelFor(c.trackingNumberId)}</td>
                    <td>{c.callerMasked}</td>
                    <td>{formatDuration(c.durationSeconds)}</td>
                    <td className={c.outcome === "missed" ? "font-medium text-[#b42318]" : undefined}>{CALL_OUTCOME_REGISTRY[c.outcome]?.label ?? c.outcome}</td>
                    <td>{c.leadAttribution ? "Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {q.data!.calls.length >= CALL_LIMIT ? <p className={help}>Showing the latest {CALL_LIMIT} calls.</p> : null}
        </>
      )}
    </section>
  );
}

export function CallTrackingClient() {
  const role = useAuthStore((state) => state.user?.role ?? null);
  const allowed = role !== null && CALL_TRACKING_ROLES.has(role);
  const settings = useCallTrackingSettings(allowed);
  const [conflict, setConflict] = useState(false);

  return (
    <div className="space-y-4 md:space-y-5 lg:space-y-6">
      <header className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#2b4acb]">Call tracking</p>
        <h1 className="text-2xl font-semibold tracking-tight text-[#0f1530] md:text-[28px] lg:text-[30px]">Call tracking</h1>
        <p className="text-[15px] text-[#5e6684]">See which marketing source made the phone ring, which calls were missed and which calls booked a job.</p>
      </header>
      <div className="border-t border-[#e6dccb]" />
      {!allowed ? (
        <Alert title="Owners and admins only" detail="Ask your shop owner for access to call tracking." />
      ) : settings.isLoading ? (
        <SkeletonCard />
      ) : settings.isError || !settings.data ? (
        <ErrorState title="Could not load call tracking" onRetry={() => void settings.refetch()} isRetrying={settings.isFetching} />
      ) : (
        <div className="grid gap-4 md:gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
          <NumbersCard providerReady={settings.data.settings.providerReady} />
          <SettingsCard settings={settings.data.settings} onConflict={() => setConflict(true)} />
          <CallsCard providerReady={settings.data.settings.providerReady} />
          {conflict ? (
            <ConflictCard
              onReload={() => {
                setConflict(false);
                void settings.refetch();
              }}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
