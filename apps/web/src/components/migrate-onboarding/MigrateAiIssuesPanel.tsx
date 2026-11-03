"use client";

import { AlertCircle, Sparkles } from "lucide-react";

import type { PlainLanguageImportIssue } from "@/src/lib/migrate-onboarding-plain-language";
import { summarizeImportIssues } from "@/src/lib/migrate-onboarding-plain-language";

interface MigrateAiIssuesPanelProps {
  issues: PlainLanguageImportIssue[];
  isLoading: boolean;
}

export function MigrateAiIssuesPanel({ issues, isLoading }: MigrateAiIssuesPanelProps) {
  const summary = summarizeImportIssues(
    issues.map((issue) => ({
      row: issue.row,
      field: issue.field,
      message: issue.detail,
      value: ""
    }))
  );

  return (
    <section
      className="rounded-lg border border-brand-accent/30 bg-brand-accent/5 p-4"
      aria-labelledby="migrate-ai-issues-heading"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 id="migrate-ai-issues-heading" className="text-sm font-semibold text-neutral-900">
            Plain-language validation summary
          </h3>
          <p className="mt-1 text-sm text-neutral-700">{isLoading ? "Checking uploaded files…" : summary}</p>
          {!isLoading && issues.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {issues.slice(0, 8).map((issue) => (
                <li key={issue.id} className="flex gap-2 text-sm text-neutral-800">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                  <span>
                    <span className="font-medium">{issue.headline}</span>
                    <span className="block text-neutral-600">{issue.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {!isLoading && issues.length > 8 ? (
            <p className="mt-2 text-xs text-neutral-500">Showing 8 of {issues.length} issues.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
