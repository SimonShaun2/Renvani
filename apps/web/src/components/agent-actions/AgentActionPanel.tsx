"use client";

import { useState } from "react";

import type { OperatorInboxItem } from "@fsm/types";

import { ProposalDetail } from "@/src/components/revenue-agent/ProposalDetail";
import {
  type AgentActionResult,
  agentActionErrorMessage,
  useApproveAgentAction,
  useEditOperatorInboxItem,
  useExecuteAgentAction,
  useRejectAgentAction
} from "@/src/hooks/operator-inbox.hooks";
import { cn } from "@/src/lib/utils";

import { ACTION_TONE_CLASS, agentActionsFor, receiptRows, type AgentActionKey } from "./agent-actions.config";
import "./agent-actions-motion.css";

/** Detail + every allowed action for one inbox item (Figma 10:379 detail, 10:425 audit trail, 10:430–434 buttons). */
/**
 * `onDone` gets the action row the API returned (approve / execute / reject), so callers show its real state
 * (`executing` = queued, `succeeded`, `failed`) instead of assuming success. "Approve & send" only approves.
 */
export function AgentActionPanel({ item, onDone }: { item: OperatorInboxItem; onDone?: (result?: AgentActionResult) => void }) {
  const approve = useApproveAgentAction(item);
  const reject = useRejectAgentAction(item.id);
  const execute = useExecuteAgentAction(item);
  const edit = useEditOperatorInboxItem(item);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(item.proposedContent.body);
  const [subject, setSubject] = useState(item.proposedContent.subject ?? "");
  const [error, setError] = useState<string | null>(null);
  const busy = approve.isPending || reject.isPending || execute.isPending || edit.isPending;
  const actions = agentActionsFor(item);
  const receipt = receiptRows(item.executionReceipt);
  const isEmail = item.proposedContent.channel === "email";

  async function attempt(fn: () => Promise<unknown>, done = true) {
    setError(null);
    try {
      const result = await fn();
      if (done) onDone?.(isActionResult(result) ? result : undefined);
      return true;
    } catch (err) {
      setError(agentActionErrorMessage(err));
      return false;
    }
  }

  const runners: Record<Exclude<AgentActionKey, "edit">, () => Promise<unknown>> = {
    approve: () => approve.mutateAsync(),
    reject: () => reject.mutateAsync(),
    execute: () => execute.mutateAsync()
  };

  async function save() {
    const ok = await attempt(
      () =>
        edit.mutateAsync({
          body,
          ...(isEmail ? { subject: subject.trim() || null } : {}),
          ...(item.proposedContent.channel ? { channel: item.proposedContent.channel } : {})
        }),
      false
    );
    if (ok) setEditing(false);
  }

  return (
    <div data-agent-panel className="space-y-5" data-testid="agent-action-panel">
      <ProposalDetail item={item} />

      {receipt.length > 0 ? (
        <section className="space-y-2" data-testid="execution-receipt">
          <h3 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#5e6684]">Execution receipt</h3>
          <dl className="space-y-1 font-mono text-xs text-[#0f1530]">
            {receipt.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-[#5e6684]">{k}</dt>
                <dd className="break-all text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {editing ? (
        <div className="space-y-2" data-testid="agent-edit-form">
          {isEmail ? (
            <input
              aria-label="Email subject"
              className="min-h-11 w-full rounded-lg border border-[#e6dccb] px-3 py-2 text-sm"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
            />
          ) : null}
          <textarea
            aria-label="Message"
            className="min-h-[120px] w-full rounded-lg border border-[#e6dccb] px-3 py-2 text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy || !body.trim()} onClick={() => void save()} className={cn("h-11 rounded-[10px] px-3.5 text-[13px] font-semibold disabled:opacity-50", ACTION_TONE_CLASS.secondary)}>
              Save edits
            </button>
            <button type="button" onClick={() => setEditing(false)} className={cn("h-11 rounded-[10px] px-3.5 text-[13px] font-semibold", ACTION_TONE_CLASS.ghost)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p role="alert" className="text-sm text-[#b42318]">{error}</p> : null}

      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              data-agent-action={a.key}
              disabled={busy}
              onClick={() => (a.key === "edit" ? setEditing(true) : void attempt(runners[a.key]))}
              className={cn("h-11 rounded-[10px] px-4 text-sm font-semibold disabled:opacity-50", ACTION_TONE_CLASS[a.tone])}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function isActionResult(value: unknown): value is AgentActionResult {
  return typeof value === "object" && value !== null && typeof (value as { id?: unknown }).id === "string" && typeof (value as { state?: unknown }).state === "string";
}
