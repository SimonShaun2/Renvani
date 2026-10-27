"use client";

import "./crm-motion.css";
import { StickyNote } from "lucide-react";

import { useCustomerNotes } from "@/src/hooks/customer-crm.hooks";

import { EmptyState } from "../ui/EmptyState";
import { SkeletonCard } from "../ui/SkeletonCard";
import { TimeAgo } from "../ui/TimeAgo";

export function CustomerNotesPanel({ customerId }: { customerId: string }) {
  const notesQuery = useCustomerNotes(customerId);
  const notes = notesQuery.data?.notes ?? [];

  return (
    <section className="surface-card px-5 py-5" data-crm-reveal>
      <h2 className="text-base font-semibold text-neutral-900">Notes</h2>
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
