"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { SubmitFieldWorkSyncBatchBody, SubmitFieldWorkSyncBatchResponse } from "@fsm/types";

import "./mobile-field-work-motion.css";
import { api } from "@/src/lib/api";
import { enqueueNote, flushQueue, readQueue } from "@/src/lib/field-work-queue";

function postBatch(body: SubmitFieldWorkSyncBatchBody) {
  return api.post<SubmitFieldWorkSyncBatchResponse>("/api/v1/field-work/sync/batches", body);
}

export function MobileJobNoteComposer({ jobId }: { jobId: string }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshPending = useCallback(() => {
    setPending(readQueue().filter((operation) => operation.jobId === jobId).length);
  }, [jobId]);

  const sync = useCallback(async () => {
    if (readQueue().length === 0) {
      refreshPending();
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      refreshPending();
      return;
    }
    setIsSyncing(true);
    try {
      const result = await flushQueue(postBatch);
      if (result.rejected.length > 0) {
        setMessage(`${result.rejected.length} note${result.rejected.length === 1 ? "" : "s"} could not be saved.`);
      } else if (result.applied > 0) {
        setMessage("Notes synced.");
      }
      await queryClient.invalidateQueries({ queryKey: ["jobs"] });
    } catch {
      setMessage("Offline. Notes are saved on this phone and will sync when you reconnect.");
    } finally {
      setIsSyncing(false);
      refreshPending();
    }
  }, [queryClient, refreshPending]);

  useEffect(() => {
    void sync();
    const onOnline = () => void sync();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [sync]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) {
      return;
    }
    enqueueNote(jobId, content);
    setDraft("");
    setMessage(null);
    void sync();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3" aria-label="Add a job note">
      <label htmlFor={`job-note-${jobId}`} className="sr-only">
        Add a note
      </label>
      <textarea
        id={`job-note-${jobId}`}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={3}
        maxLength={10000}
        placeholder="Add a note for the office…"
        className="w-full rounded-[20px] border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800"
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Save note
        </button>
        {pending > 0 ? (
          <span data-field-work-reveal role="status" className="text-xs font-semibold text-warning">
            {isSyncing ? "Syncing…" : `${pending} waiting to sync`}
          </span>
        ) : null}
      </div>
      {message ? (
        <p data-field-work-reveal role="status" className="text-xs text-neutral-500">
          {message}
        </p>
      ) : null}
    </form>
  );
}
