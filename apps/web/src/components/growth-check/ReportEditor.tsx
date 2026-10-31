"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Copy, Lock, Send } from "lucide-react";

import {
  GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY,
  GROWTH_CHECK_REPORT_EVIDENCE_LABEL_REGISTRY,
  GROWTH_CHECK_REPORT_EXPORT_FORMATS,
  GROWTH_CHECK_REPORT_MAX_OPPORTUNITIES,
  type GrowthCheckReportDraft,
  type GrowthCheckReportExportFormat,
  type GrowthCheckReportOpportunityInput
} from "@fsm/types";

import { ConfirmDialog } from "@/src/components/ui/ConfirmDialog";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SkeletonCard } from "@/src/components/ui/SkeletonCard";
import {
  apiReason,
  downloadReportExport,
  reportKeys,
  useApproveReportDraft,
  useCreateReportDraft,
  useCreateReportShare,
  useEditReportDraft,
  useReportDraftDetail,
  useReportPreview,
  useReportShares,
  useRevokeReportShare,
  useScanReportDraft,
  type ReportEdit
} from "@/src/hooks/growth-check-report.hooks";
import { useScanFindings } from "@/src/hooks/growth-check-review.hooks";
import { ApiError } from "@/src/lib/api";

import { formatDateTime } from "./labels";

// Figma 366:4392 / 366:4653 / 366:4895 (Operator / 10c Growth Check · Report editor) styles.
const ring = "outline-none focus-visible:ring-2 focus-visible:ring-[#0f1530] focus-visible:ring-offset-2";
const btn = `inline-flex h-11 items-center justify-center rounded-[10px] border border-[#e6dccb] bg-white px-[18px] text-[13px] font-semibold text-[#0f1530] disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#eef0f5] disabled:text-[#5e6684] lg:h-10 ${ring}`;
const primary = `inline-flex h-11 items-center justify-center rounded-[10px] bg-[#0f1530] px-[18px] text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 lg:h-10 ${ring}`;
const input = "mt-1.5 block min-h-11 w-full rounded-[8px] border border-[#e6dccb] bg-white px-3 py-2.5 text-sm text-[#0f1530] outline-none placeholder:text-[#5e6684] focus:border-[#0f1530]";
const label = "block text-[13px] font-medium text-[#2a3360]";
const card = "space-y-3.5 rounded-[14px] border border-[#e6dccb] bg-white p-5";
const h15 = "text-[15px] font-semibold text-[#0f1530]";
const help = "text-[12.5px] text-[#5e6684]";
const PILL = {
  warn: "bg-[#fff4d6] text-[#0f1530]",
  success: "bg-[#e4f1e8] text-[#2f7d4f]",
  info: "bg-[#e5eafb] text-[#2b4acb]",
  error: "bg-[#fbe3dc] text-[#b42318]"
} as const;
function Pill({ tone, children }: { tone: keyof typeof PILL; children: React.ReactNode }) {
  return <span className={`inline-flex h-[22px] w-fit shrink-0 items-center rounded-full px-2.5 text-[10.5px] font-medium uppercase tracking-[0.06em] ${PILL[tone]}`}>{children}</span>;
}
const ALERT = { warn: ["bg-[#fff4d6]", "text-[#0f1530]", "text-[#2a3360]"], error: ["bg-[#fbe3dc]", "text-[#b42318]", "text-[#b42318]"] } as const;
function Alert({ tone, title, children, role }: { tone: keyof typeof ALERT; title: string; children?: React.ReactNode; role?: string }) {
  const [box, t, d] = ALERT[tone];
  return (
    <div role={role} className={`space-y-1.5 rounded-[10px] p-3.5 ${box}`}>
      <p className={`text-sm font-semibold ${t}`}>{title}</p>
      <div className={`space-y-2.5 text-[13px] ${d}`}>{children}</div>
    </div>
  );
}
const SCORE_WORD: Record<"Impact" | "Evidence" | "Actionability", Record<number, string>> = {
  Impact: { 1: "Low", 2: "Medium", 3: "High" },
  Evidence: { 1: "Weak", 2: "Hypothesis", 3: "Strong" },
  Actionability: { 1: "Hard", 2: "Moderate", 3: "Easy" }
};
const FORMAT_LABEL: Record<GrowthCheckReportExportFormat, string> = { markdown: "Markdown", html: "HTML", text: "Plain text", json: "JSON" };
export const SHARE_EXPIRY_DAYS = 30;

const errText = (e: unknown, fallback: string) => (e instanceof ApiError && e.message ? e.message : fallback);

interface Form {
  title: string;
  businessName: string;
  serviceArea: string;
  intro: string;
  internalNotes: string;
  opportunities: GrowthCheckReportOpportunityInput[];
}
const formOf = (d: GrowthCheckReportDraft): Form => ({
  title: d.content.title,
  businessName: d.content.businessName ?? "",
  serviceArea: d.content.serviceArea ?? "",
  intro: d.content.intro ?? "",
  internalNotes: d.content.internalNotes ?? "",
  opportunities: d.content.opportunities
});
const nullable = (v: string) => (v.trim() === "" ? null : v.trim());

/** Only changed fields go in the PATCH (the API needs at least one). */
export function diffEdit(draft: GrowthCheckReportDraft, form: Form): ReportEdit {
  const edit: Record<string, unknown> = {};
  if (form.title.trim() !== draft.content.title) edit.title = form.title.trim();
  for (const key of ["businessName", "serviceArea", "intro", "internalNotes"] as const) {
    if (nullable(form[key]) !== draft.content[key]) edit[key] = nullable(form[key]);
  }
  if (JSON.stringify(form.opportunities) !== JSON.stringify(draft.content.opportunities)) edit.opportunities = form.opportunities;
  return edit as ReportEdit;
}

function Score({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="text-[12.5px] text-[#2a3360]">
      {label}
      <select aria-label={label} className="ml-1 h-9 rounded-[8px] border border-[#e6dccb] bg-white px-2" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {[1, 2, 3].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

function DraftForm({ draft, scanId, approveSlot }: { draft: GrowthCheckReportDraft; scanId: string; approveSlot?: React.ReactNode }) {
  const edit = useEditReportDraft(draft.id);
  const qc = useQueryClient();
  const findings = useScanFindings(scanId);
  const [form, setForm] = useState<Form>(() => formOf(draft));
  useEffect(() => setForm(formOf(draft)), [draft]);
  const changes = diffEdit(draft, form);
  const dirty = Object.keys(changes).length > 0;
  const stale = apiReason(edit.error) === "stale_version";
  const used = new Set(form.opportunities.map((o) => o.findingId));
  const addable = (findings.data?.findings ?? []).filter((f) => !used.has(f.id));
  const setOpp = (i: number, patch: Partial<GrowthCheckReportOpportunityInput>) =>
    setForm((f) => ({ ...f, opportunities: f.opportunities.map((o, j) => (j === i ? { ...o, ...patch } : o)) }));

  return (
    <form
      aria-label="Edit report"
      className="space-y-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirty) edit.mutate({ expectedVersion: draft.version, edit: changes });
      }}
    >
      {(["title", "businessName", "serviceArea"] as const).map((key) => (
        <label key={key} className={label}>
          {key === "title" ? "Report title" : key === "businessName" ? "Business name" : "Service area"}
          <input className={input} value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
        </label>
      ))}
      <label className={label}>
        Intro
        <textarea className={input} rows={3} value={form.intro} onChange={(e) => setForm((f) => ({ ...f, intro: e.target.value }))} />
      </label>
      <label className={label}>
        Internal notes <span className="font-normal text-[#5e6684]">(staff only — never in the preview, export or shares)</span>
        <textarea className={input} rows={2} value={form.internalNotes} onChange={(e) => setForm((f) => ({ ...f, internalNotes: e.target.value }))} />
      </label>

      <fieldset className="space-y-3.5">
        <legend className={`mb-3.5 ${h15}`}>
          Top opportunities{" "}
          <span className="text-[12.5px] font-normal text-[#5e6684]">
            ({form.opportunities.length}/{GROWTH_CHECK_REPORT_MAX_OPPORTUNITIES})
          </span>
        </legend>
        {form.opportunities.map((o, i) => (
          <div key={o.findingId} className="space-y-2 rounded-[10px] border border-[#e6dccb] p-3">
            <p className="text-sm font-medium text-[#0f1530]">{o.headline || "Untitled opportunity"}</p>
            <div className="flex flex-wrap gap-1.5" aria-label={`Opportunity ${i + 1} scores`}>
              <Pill tone="success">Impact · {SCORE_WORD.Impact[o.impact]}</Pill>
              <Pill tone="warn">Evidence · {SCORE_WORD.Evidence[o.evidence]}</Pill>
              <Pill tone="info">Actionability · {SCORE_WORD.Actionability[o.actionability]}</Pill>
            </div>
            <input aria-label={`Opportunity ${i + 1} headline`} className={input} value={o.headline} onChange={(e) => setOpp(i, { headline: e.target.value })} />
            <input aria-label={`Opportunity ${i + 1} next step`} className={input} value={o.nextStep} onChange={(e) => setOpp(i, { nextStep: e.target.value })} />
            <div className="flex flex-wrap items-center gap-3">
              <Score label="Impact" value={o.impact} onChange={(v) => setOpp(i, { impact: v })} />
              <Score label="Evidence" value={o.evidence} onChange={(v) => setOpp(i, { evidence: v })} />
              <Score label="Actionability" value={o.actionability} onChange={(v) => setOpp(i, { actionability: v })} />
              <button
                type="button"
                className={`ml-auto text-[12.5px] font-medium text-[#b42318] hover:underline ${ring}`}
                onClick={() => setForm((f) => ({ ...f, opportunities: f.opportunities.filter((_, j) => j !== i) }))}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
        {form.opportunities.length < GROWTH_CHECK_REPORT_MAX_OPPORTUNITIES && addable.length > 0 ? (
          <label className={label}>
          Add opportunity from a finding
          <select
            className={input}
            value=""
            onChange={(e) => {
              const f = addable.find((x) => x.id === e.target.value);
              if (!f) return;
              const label = f.checkLabel ?? f.checkId;
              setForm((s) => ({
                ...s,
                opportunities: [...s.opportunities, { findingId: f.id, headline: label, nextStep: "", impact: 2, evidence: 2, actionability: 2 }]
              }));
            }}
          >
            <option value="">Add an opportunity from a finding…</option>
            {addable.map((f) => (
              <option key={f.id} value={f.id}>
                {f.checkLabel ?? f.checkId}
              </option>
            ))}
          </select>
          </label>
        ) : null}
        <p className={help}>Add 1–3 opportunities to finish the report.</p>
      </fieldset>

      {stale ? (
        <div className="space-y-2">
          <Pill tone="error">Stale</Pill>
          <Alert tone="error" role="alert" title="The report changed since you opened it.">
            <p>
              Someone else changed this report (now version {(edit.error as ApiError).payload.fields?.currentVersion ?? "newer"}). Refresh to load the latest, then reapply your edits.
            </p>
            <button
              type="button"
              className={btn}
              onClick={() => {
                edit.reset();
                void qc.invalidateQueries({ queryKey: reportKeys.all });
              }}
            >
              Refresh
            </button>
          </Alert>
        </div>
      ) : edit.isError ? (
        <p role="alert" className="text-sm text-[#b42318]">
          {errText(edit.error, "Couldn’t save your changes.")}
        </p>
      ) : null}
      {draft.approved && dirty ? (
        <Alert tone="warn" title="Saving clears approval.">
          <p>You’ll need to approve again before exporting or sharing.</p>
        </Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btn} disabled={!dirty || edit.isPending || stale}>
          {edit.isPending ? "Saving…" : "Save changes"}
        </button>
        {approveSlot}
      </div>
    </form>
  );
}

function Preview({ draftId, version }: { draftId: string; version: number }) {
  const q = useReportPreview(draftId, version);
  if (q.isLoading) return <SkeletonCard />;
  if (q.isError || !q.data) return <ErrorState compact title="Couldn’t load the preview" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />;
  const r = q.data.report;
  const evidence = (k: string) => GROWTH_CHECK_REPORT_EVIDENCE_LABEL_REGISTRY[k] ?? k;
  return (
    <article aria-label="Report preview" className="space-y-3.5 text-[13.5px] text-[#2a3360]">
      <h3 className="text-[19px] font-semibold text-[#0f1530]">{r.title}</h3>
      <p className="text-[#5e6684]">
        {[r.business.name, r.business.serviceArea, r.business.website].filter(Boolean).join(" · ")}
      </p>
      {r.intro ? <p>{r.intro}</p> : null}
      <section>
        <h4 className="text-sm font-semibold text-[#0f1530]">What’s working</h4>
        {r.whatsWorking.length === 0 ? <p className="text-[#5e6684]">Nothing listed yet.</p> : null}
        <ul className="list-disc pl-5">
          {r.whatsWorking.map((w) => (
            <li key={w.findingId}>
              {w.checkLabel}: {w.summary} <span className="text-[12.5px] text-[#5e6684]">({evidence(w.evidenceLabel)})</span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="text-sm font-semibold text-[#0f1530]">Top opportunities</h4>
        {r.opportunities.length === 0 ? <p className="text-[#5e6684]">Add 1–3 opportunities to finish the report.</p> : null}
        <ol className="list-decimal pl-5">
          {r.opportunities.map((o) => (
            <li key={o.findingId}>
              <span className="font-medium">{o.headline}</span> — next step: {o.nextStep || "—"}{" "}
              <span className="text-[12.5px] text-[#5e6684]">
                ({evidence(o.evidenceLabel)} · score {o.score.total})
              </span>
            </li>
          ))}
        </ol>
      </section>
      {r.needsConfirmationCount > 0 ? <p className="text-xs text-amber-800">{r.needsConfirmationCount} item(s) still need your confirmation.</p> : null}
      <p className="text-[12.5px] text-[#5e6684]">
        Version {q.data.version} · {q.data.approved ? "approved" : "not approved"} · hash {q.data.contentHash.slice(0, 12)}
      </p>
    </article>
  );
}

function ExportPanel({ draft, onCopyText }: { draft: GrowthCheckReportDraft; onCopyText: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [notApproved, setNotApproved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const blocked = !draft.approved || notApproved;
  useEffect(() => setNotApproved(false), [draft.version]);
  async function run(key: string, fn: () => Promise<void>) {
    setError(null);
    setBusy(key);
    try {
      await fn();
    } catch (e) {
      if (apiReason(e) === "not_approved") setNotApproved(true);
      else setError(errText(e, "Export failed. Try again."));
    } finally {
      setBusy(null);
    }
  }
  return (
    <div className="space-y-2">
      {blocked ? (
        <p role="status" className={help}>
          <Lock className="mr-1 inline h-3.5 w-3.5" aria-hidden /> Approve the current version to export or copy this report.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {GROWTH_CHECK_REPORT_EXPORT_FORMATS.map((f) => (
          <button key={f} type="button" className={btn} disabled={blocked || busy !== null} onClick={() => void run(f, () => downloadReportExport(draft.id, f))}>
            {busy === f ? "Exporting…" : FORMAT_LABEL[f]}
          </button>
        ))}
        <button type="button" className={btn} disabled={blocked || busy !== null} onClick={() => void run("copy", onCopyText)}>
          <Copy className="mr-1 inline h-4 w-4" aria-hidden />
          Copy text
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-[#b42318]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SharesPanel({ draft }: { draft: GrowthCheckReportDraft }) {
  const q = useReportShares(draft.id);
  const create = useCreateReportShare(draft.id);
  const revoke = useRevokeReportShare();
  const [token, setToken] = useState<string | null>(null);
  const [replayed, setReplayed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [revokeId, setRevokeId] = useState<string | null>(null);
  const reason = apiReason(create.error);

  return (
    <div className="space-y-3">
      <button
        type="button"
        className={btn}
        disabled={!draft.approved || create.isPending}
        onClick={() =>
          create.mutate(
            { expectedVersion: draft.version, expiresInDays: SHARE_EXPIRY_DAYS },
            {
              onSuccess: (res) => {
                setToken(res.token);
                setReplayed(res.token === null);
                setCopied(false);
              }
            }
          )
        }
      >
        {create.isPending ? "Creating…" : `Create share link (expires in ${SHARE_EXPIRY_DAYS} days)`}
      </button>
      {!draft.approved ? <p className="text-[12.5px] text-[#5e6684]">Approve the current version before sharing.</p> : null}
      {token ? (
        <Alert tone="warn" role="alert" title="Copy this share code now. It won’t be shown again.">
          <code className="block break-all rounded-[8px] bg-white px-2 py-1 text-xs text-[#0f1530]">{token}</code>
          <div className="flex gap-2">
            <button
              type="button"
              className={btn}
              onClick={() => void navigator.clipboard?.writeText(token).then(() => setCopied(true))}
            >
              {copied ? "Copied" : "Copy code"}
            </button>
            <button type="button" className={btn} onClick={() => setToken(null)}>
              Done
            </button>
          </div>
        </Alert>
      ) : replayed ? (
        <p role="status" className="text-sm text-neutral-600">
          This share was already created. Its code can’t be shown again; revoke it and create a new one if you lost it.
        </p>
      ) : null}
      {create.isError ? (
        <p role="alert" className="text-sm text-[#b42318]">
          {reason === "not_approved"
            ? "Approve the current version before sharing."
            : reason === "stale_version"
              ? "The report changed. Refresh and try again."
              : errText(create.error, "Couldn’t create the share.")}
        </p>
      ) : null}

      {q.isLoading ? (
        <SkeletonCard />
      ) : q.isError || !q.data ? (
        <ErrorState compact title="Couldn’t load shares" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />
      ) : q.data.shares.length === 0 ? (
        <p className="text-[12.5px] text-[#5e6684]">No shares yet.</p>
      ) : (
        <ul aria-label="Shares" className="divide-y divide-[#e6dccb] text-[13px] text-[#2a3360]">
          {q.data.shares.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <span>
                Version {s.draftVersion} · created {formatDateTime(s.createdAt)}
                {s.expiresAt ? ` · expires ${formatDateTime(s.expiresAt)}` : ""} ·{" "}
                <span className="font-medium">{s.status === "active" ? "Active" : s.status === "revoked" ? "Revoked" : "Expired"}</span>
              </span>
              {s.status === "active" ? (
                <button type="button" className={`text-[12.5px] font-medium text-[#b42318] hover:underline ${ring}`} onClick={() => setRevokeId(s.id)}>
                  Revoke
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {revoke.isError ? (
        <p role="alert" className="text-sm text-[#b42318]">
          {errText(revoke.error, "Couldn’t revoke the share.")}
        </p>
      ) : null}

      <div role="status" className="space-y-2.5 rounded-[10px] bg-[#eef0f5] p-3.5 text-[13px] text-[#2a3360]">
        <Send className="mr-1 inline h-4 w-4" aria-hidden /> Delivery isn’t enabled yet. Email and text delivery are turned off, so nothing is sent to anyone.
        <div className="flex flex-wrap gap-2">
          {GROWTH_CHECK_REPORT_DELIVERY_CHANNEL_REGISTRY.map((c) => (
            <button key={c.key} type="button" className={btn} disabled>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={revokeId !== null}
        title="Revoke this share?"
        description="Anyone holding this share code loses access. This can’t be undone."
        confirmLabel="Revoke"
        confirmTone="danger"
        isPending={revoke.isPending}
        onCancel={() => setRevokeId(null)}
        onConfirm={() => {
          if (revokeId) revoke.mutate(revokeId, { onSettled: () => setRevokeId(null) });
        }}
      />
    </div>
  );
}

function DraftWorkspace({ draftId, scanId }: { draftId: string; scanId: string }) {
  const q = useReportDraftDetail(draftId);
  const approve = useApproveReportDraft(draftId);
  const preview = useReportPreview(draftId, q.data?.draft.version ?? 0);
  const [confirming, setConfirming] = useState(false);
  const [copyNote, setCopyNote] = useState<string | null>(null);
  if (q.isLoading) return <SkeletonCard />;
  if (q.isError || !q.data) return <ErrorState compact title="Couldn’t load the report" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />;
  const { draft, history } = q.data;
  const approveStale = apiReason(approve.error) === "stale_version";

  const approveButton = !draft.approved ? (
    <button type="button" className={primary} disabled={approve.isPending} onClick={() => setConfirming(true)}>
      Approve
    </button>
  ) : null;

  return (
    <div className="grid gap-4 md:gap-5 lg:grid-cols-[minmax(0,640fr)_minmax(0,440fr)] lg:items-start lg:gap-6">
      <section aria-labelledby="gcr-edit" className={card}>
        <div className="flex items-center justify-between gap-3">
          <h3 id="gcr-edit" className="text-[17px] font-semibold text-[#0f1530]">Edit report</h3>
          {draft.approved ? <Pill tone="success">Approved</Pill> : <Pill tone="warn">Draft · not approved</Pill>}
        </div>
        <p className={help}>Version {draft.version}</p>
        <DraftForm draft={draft} scanId={scanId} approveSlot={approveButton} />
        <div aria-labelledby="gcr-approve" role="group" className="space-y-2">
          <h4 id="gcr-approve" className="sr-only">Approval</h4>
          {draft.approved ? (
            <p className="text-[13px] text-[#2f7d4f]">Version {draft.version} approved{draft.approvedAt ? ` ${formatDateTime(draft.approvedAt)}` : ""}.</p>
          ) : (
            <p className={help}>
              {draft.approvedVersion ? `Edited since version ${draft.approvedVersion} was approved. ` : ""}Nothing can be exported or shared until you approve this version.
            </p>
          )}
          {approve.isError ? (
            approveStale ? (
              <div className="space-y-2">
                <Pill tone="error">Stale</Pill>
                <Alert tone="error" role="alert" title="The report changed since you opened it.">
                  <p>Refresh and review it before approving.</p>
                  <button
                    type="button"
                    className={btn}
                    onClick={() => {
                      approve.reset();
                      void q.refetch();
                    }}
                  >
                    Refresh
                  </button>
                </Alert>
              </div>
            ) : (
              <p role="alert" className="text-sm text-[#b42318]">{errText(approve.error, "Couldn’t approve.")}</p>
            )
          ) : null}
        </div>
        <section aria-labelledby="gcr-history" className="space-y-1 border-t border-[#e6dccb] pt-3.5">
          <h4 id="gcr-history" className={h15}>History</h4>
          <ul className="text-[12.5px] text-[#5e6684]">
            {history.map((h) => (
              <li key={h.id}>
                v{h.version} · {h.action === "approve" ? "Approved" : h.action === "create" ? "Created" : `Edited ${h.changedFields.join(", ")}`} · {formatDateTime(h.createdAt)}
              </li>
            ))}
          </ul>
        </section>
      </section>
      <section aria-labelledby="gcr-preview" className={card}>
        <h3 id="gcr-preview" className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#2b4acb]">
          Report preview
        </h3>
        <Preview draftId={draft.id} version={draft.version} />
        <div className="border-t border-[#e6dccb]" />
        <section aria-labelledby="gcr-export" className="space-y-2.5">
          <h4 id="gcr-export" className={h15}>Export &amp; share</h4>
          <ExportPanel
            draft={draft}
            onCopyText={async () => {
              if (!preview.data?.approved) throw new Error("Preview not ready");
              await navigator.clipboard.writeText(preview.data.text);
              setCopyNote("Report text copied.");
            }}
          />
          {copyNote ? <p className="text-[12.5px] text-[#2f7d4f]">{copyNote}</p> : null}
          <h5 id="gcr-share" className="sr-only">Shares</h5>
          <SharesPanel draft={draft} />
        </section>
      </section>
      <ConfirmDialog
        open={confirming}
        title={`Approve version ${draft.version}?`}
        description="Once approved, this version can be exported and shared. Any later edit clears approval."
        confirmLabel="Approve"
        isPending={approve.isPending}
        onCancel={() => setConfirming(false)}
        onConfirm={() => approve.mutate(draft.version, { onSettled: () => setConfirming(false) })}
      />
    </div>
  );
}

/** FS-57 owner report editor for one scan (owner/admin; the page gates role, the API enforces it and tenant scope). */
export function ReportEditor({ scanId }: { scanId: string }) {
  const q = useScanReportDraft(scanId);
  const create = useCreateReportDraft(scanId);
  if (q.isLoading) return <SkeletonCard />;
  if (q.isError) return <ErrorState compact title="Couldn’t load the report" onRetry={() => void q.refetch()} isRetrying={q.isFetching} />;
  if (!q.data) {
    return (
      <div className="space-y-2">
        <div className="space-y-1.5 rounded-[10px] bg-[#eef0f5] p-3.5">
          <p className="text-sm font-semibold text-[#0f1530]">No report yet</p>
          <p className="text-[13px] text-[#2a3360]">Start a report from this check’s reviewed findings. Nothing is sent to anyone.</p>
        </div>
        <button type="button" className={primary} disabled={create.isPending} onClick={() => create.mutate()}>
          {create.isPending ? "Starting…" : "Start report"}
        </button>
        {create.isError ? (
          <p role="alert" className="text-sm text-[#b42318]">
            {apiReason(create.error) === "draft_exists" ? "A report already exists for this check. Refresh to open it." : errText(create.error, "Couldn’t start the report.")}
          </p>
        ) : null}
      </div>
    );
  }
  return <DraftWorkspace draftId={q.data.id} scanId={scanId} />;
}
