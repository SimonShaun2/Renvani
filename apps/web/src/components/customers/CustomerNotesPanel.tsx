"use client";

import "./crm-motion.css";
import { useState } from "react";
import { StickyNote } from "lucide-react";

import {
  CUSTOMER_NOTE_AUTHOR_ROLES,
  CUSTOMER_NOTE_MAX_LENGTH,
  useCreateCustomerNote,
  useCustomerNotes,
  validateCustomerNote
} from "@/src/hooks/customer-crm.hooks";
import { useAuthStore } from "@/src/stores/auth.store";

import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";
import { TimeAgo } from "../ui/TimeAgo";

export function CustomerNotesPanel({ customerId }: { customerId: string }) {
  const notesQuery = useCustomerNotes(customerId);
  const notes = notesQuery.data?.notes ?? [];
  const role = useAuthStore((state) => state.user?.role);
  const canAuthor = Boolean(role && (CUSTOMER_NOTE_AUTHOR_ROLES as readonly string[]).includes(role));

  return (
    <section className="surface-card px-5 py-5" data-crm-reveal>
      <h2 className="text-base font-semibold text-neutral-900">Notes</h2>
      {canAuthor ? <AddCustomerNoteForm customerId={customerId} /> : null}
      <div className="mt-4">
        {notesQuery.isLoading ? (
          <SkeletonCard className="h-[96px]" />
        ) : notesQuery.isError ? (
          <p className="rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
            Notes could not be loaded.
          </p>
        ) : notes.length === 0 ? (
          <EmptyState icon={StickyNote} title="No notes yet" subtitle="Imported and office notes for this customer appear here." compact />
        ) : (
          <ul className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
            {notes.map((note) => (
              <li key={note.id} className="rounded-[22px] border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="whitespace-pre-line text-sm leading-6 text-neutral-700">{note.content}</p>
                <p className="mt-2 text-xs font-medium text-neutral-400">
                  {note.isInternal ? "Internal · " : ""}
                  <TimeAgo value={note.notedAt ?? note.createdAt} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AddCustomerNoteForm({ customerId }: { customerId: string }) {
  const createNote = useCreateCustomerNote(customerId);
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  function submit() {
    const problem = validateCustomerNote(content);
    setValidation(problem);
    if (problem) return;
    createNote.mutate(
      { content, ...(isInternal ? { isInternal: true } : {}) },
      {
        onSuccess: () => {
          setContent("");
          setIsInternal(false);
        }
      }
    );
  }

  return (
    <form
      className="mt-4 space-y-2"
      aria-label="Add a customer note"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <label htmlFor={`customer-note-${customerId}`} className="sr-only">
        New note
      </label>
      <textarea
        id={`customer-note-${customerId}`}
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          if (validation) setValidation(null);
        }}
        rows={3}
        maxLength={CUSTOMER_NOTE_MAX_LENGTH + 1}
        placeholder="Add a note about this customer…"
        aria-invalid={validation ? true : undefined}
        className="w-full rounded-[20px] border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-800"
      />
      {validation ? (
        <p role="alert" className="text-xs text-error">
          {validation}
        </p>
      ) : null}
      {createNote.isError ? (
        <div role="alert" data-crm-reveal className="flex items-center justify-between gap-3 rounded-2xl bg-error-light px-3 py-2 text-sm text-error">
          <span>Note could not be saved. {createNote.error instanceof Error ? createNote.error.message : ""}</span>
          <button type="button" onClick={submit} disabled={createNote.isPending} className="font-semibold underline">
            Retry
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-xs font-medium text-neutral-600">
          <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} />
          Internal note
        </label>
        <button
          type="submit"
          disabled={createNote.isPending}
          className="rounded-full bg-neutral-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {createNote.isPending ? "Saving…" : "Add note"}
        </button>
      </div>
    </form>
  );
}
