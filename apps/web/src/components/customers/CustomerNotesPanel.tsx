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
import { formatMonthDay } from "./profile/customer-profile.utils";
import { ProfileCard, ProfileMonoLabel, profileButtonClass } from "./profile/ProfileUi";

export function CustomerNotesPanel({ customerId }: { customerId: string }) {
  const notesQuery = useCustomerNotes(customerId);
  const notes = notesQuery.data?.notes ?? [];
  const role = useAuthStore((state) => state.user?.role);
  const canAuthor = Boolean(role && (CUSTOMER_NOTE_AUTHOR_ROLES as readonly string[]).includes(role));

  return (
    <ProfileCard title="Customer notes" data-crm-reveal>
      <div>
        {notesQuery.isLoading ? (
          <SkeletonCard className="h-[96px]" />
        ) : notesQuery.isError ? (
          <p className="rounded-3xl border border-error/15 bg-error-light px-4 py-4 text-sm text-error">
            Notes could not be loaded.
          </p>
        ) : notes.length === 0 ? (
          <EmptyState icon={StickyNote} title="No notes yet" subtitle="Imported and office notes for this customer appear here." compact />
        ) : (
          <ul className="max-h-[320px] overflow-y-auto">
            {notes.map((note) => (
              <li key={note.id} className="flex flex-col gap-1 border-t border-[#e6dccb] py-2.5">
                <ProfileMonoLabel>
                  {[formatMonthDay(note.notedAt ?? note.createdAt), note.isInternal ? "Internal" : null].filter(Boolean).join(" · ")}
                </ProfileMonoLabel>
                <p className="whitespace-pre-line text-[13px] text-[#0f1530]">{note.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      {canAuthor ? <AddCustomerNoteForm customerId={customerId} /> : null}
    </ProfileCard>
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
      className="space-y-2 border-t border-[#e6dccb] pt-3"
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
        className="w-full rounded-[10px] border border-[#e6dccb] bg-white px-3 py-2.5 text-[13px] text-[#0f1530]"
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
          className={profileButtonClass()}
        >
          {createNote.isPending ? "Saving…" : "Add note"}
        </button>
      </div>
    </form>
  );
}
