"use client";

import { useMemo, useState } from "react";

import Link from "next/link";

import type { OperatorInboxItem } from "@fsm/types";

import { isRevenueProposal } from "@/src/components/revenue-agent/proposal.config";
import { ApiError } from "@/src/lib/api";
import { cn } from "@/src/lib/utils";
import {
  useApproveAgentAction,
  useEditOperatorInboxItem,
  useExecuteAgentAction,
  useOperatorInbox,
  useRejectAgentAction
} from "@/src/hooks/operator-inbox.hooks";

function riskBadgeClass(risk: OperatorInboxItem["risk"]): string {
  switch (risk) {
    case "high":
      return "bg-red-100 text-red-800";
    case "medium":
      return "bg-amber-100 text-amber-900";
    default:
      return "bg-emerald-100 text-emerald-900";
  }
}

function formatExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  return date.toLocaleString();
}

interface InboxDetailProps {
  item: OperatorInboxItem;
  onClose: () => void;
}

function InboxDetailPanel({ item, onClose }: InboxDetailProps) {
  const [body, setBody] = useState(item.proposedContent.body);
  const [subject, setSubject] = useState(item.proposedContent.subject ?? "");
  const editMutation = useEditOperatorInboxItem(item.id);
  const approveMutation = useApproveAgentAction(item.id);
  const rejectMutation = useRejectAgentAction(item.id);
  const executeMutation = useExecuteAgentAction(item.id);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canEdit = item.overridePaths.includes("edit");
  const canApprove = item.overridePaths.includes("approve");
  const canReject = item.overridePaths.includes("reject");
  const canExecute = item.overridePaths.includes("execute");

  async function runAction(action: "edit" | "approve" | "reject" | "execute") {
    setErrorMessage(null);

    try {
      if (action === "edit") {
        await editMutation.mutateAsync({
          body,
          ...(subject ? { subject } : {}),
          ...(item.proposedContent.channel ? { channel: item.proposedContent.channel } : {})
        });
      } else if (action === "approve") {
        await approveMutation.mutateAsync();
      } else if (action === "reject") {
        await rejectMutation.mutateAsync();
      } else {
        await executeMutation.mutateAsync();
      }
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Action failed");
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">Command Center</p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-900">{item.provenance.actionType}</h2>
          <p className="mt-1 text-sm text-neutral-600">State: {item.state}</p>
        </div>
        <button
          type="button"
          className="text-sm font-medium text-neutral-500 hover:text-neutral-800"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", riskBadgeClass(item.risk))}>
          Risk: {item.risk}
        </span>
        <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium text-neutral-700">
          Expires {formatExpiry(item.expiresAt)}
        </span>
      </div>

      <section className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900">Recipient</h3>
        <p className="text-sm text-neutral-700">{item.recipient.displayName}</p>
        {item.recipient.phone ? <p className="text-sm text-neutral-600">{item.recipient.phone}</p> : null}
        {item.recipient.email ? <p className="text-sm text-neutral-600">{item.recipient.email}</p> : null}
      </section>

      <section className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900">Proposed content</h3>
        {item.proposedContent.channel ? (
          <p className="text-xs uppercase tracking-wide text-neutral-500">Channel: {item.proposedContent.channel}</p>
        ) : null}
        {canEdit ? (
          <>
            {item.proposedContent.channel === "email" ? (
              <input
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject"
              />
            ) : null}
            <textarea
              className="min-h-[140px] w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </>
        ) : (
          <p className="whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-sm text-neutral-800">{body}</p>
        )}
      </section>

      <section className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900">Provenance</h3>
        <p className="text-sm text-neutral-700">
          {item.provenance.agentProduct} · policy {item.provenance.policyVersion}
        </p>
        {item.provenance.reason ? <p className="text-sm text-neutral-600">{item.provenance.reason}</p> : null}
        <ul className="space-y-2 text-sm text-neutral-600">
          {item.provenance.sourceEvents.map((event) => (
            <li key={event.id} className="rounded-lg border border-neutral-100 px-3 py-2">
              <span className="font-medium text-neutral-800">{event.eventType}</span> — {event.summary}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-6 space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900">Consequences</h3>
        <ul className="list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {item.consequences.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      {item.executionReceipt ? (
        <section className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold text-neutral-900">Audit evidence</h3>
          <pre className="overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs text-neutral-100">
            {JSON.stringify(item.executionReceipt, null, 2)}
          </pre>
        </section>
      ) : null}

      {errorMessage ? <p className="mt-4 text-sm text-red-600">{errorMessage}</p> : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {canEdit ? (
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
            onClick={() => runAction("edit")}
          >
            Save edits
          </button>
        ) : null}
        {canReject ? (
          <button
            type="button"
            className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700"
            onClick={() => runAction("reject")}
          >
            Reject
          </button>
        ) : null}
        {canApprove ? (
          <button
            type="button"
            className="rounded-lg bg-brand-accent px-4 py-2 text-sm font-semibold text-white"
            onClick={() => runAction("approve")}
          >
            Approve
          </button>
        ) : null}
        {canExecute ? (
          <button
            type="button"
            className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-semibold text-white"
            onClick={() => runAction("execute")}
          >
            Execute (dry run)
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CommandCenterClient() {
  const inboxQuery = useOperatorInbox("awaiting_approval");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const items = inboxQuery.data?.items ?? [];

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) ?? null,
    [items, selectedId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Command Center</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Operator approval and exception inbox — review provenance, edit proposed content, and execute approved actions
          only.
        </p>
        {/* Figma 10:104: Revenue Agent item in "Needs you" */}
        <Link
          href="/command-center/approvals"
          className="mt-3 inline-flex rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:border-neutral-300"
        >
          Revenue Agent · {inboxQuery.isLoading ? "—" : items.filter((item) => isRevenueProposal(item.provenance.actionType)).length} proposals waiting
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          {inboxQuery.isLoading ? <p className="text-sm text-neutral-600">Loading inbox…</p> : null}
          {items.length === 0 && !inboxQuery.isLoading ? (
            <p className="rounded-2xl border border-dashed border-neutral-200 bg-white p-6 text-sm text-neutral-600">
              No proposals awaiting approval.
            </p>
          ) : null}

          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                "w-full rounded-2xl border bg-white p-4 text-left shadow-sm transition",
                selectedId === item.id ? "border-brand-accent" : "border-neutral-200 hover:border-neutral-300"
              )}
              onClick={() => setSelectedId(item.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-neutral-900">{item.recipient.displayName}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", riskBadgeClass(item.risk))}>
                  {item.risk}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-neutral-600">{item.proposedContent.body}</p>
              <p className="mt-2 text-xs text-neutral-500">Expires {formatExpiry(item.expiresAt)}</p>
            </button>
          ))}
        </div>

        <div>
          {selectedItem ? (
            <InboxDetailPanel item={selectedItem} onClose={() => setSelectedId(null)} />
          ) : (
            <div className="rounded-2xl border border-dashed border-neutral-200 bg-white p-8 text-sm text-neutral-600">
              Select a proposal to review provenance, consequences, and override paths.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
