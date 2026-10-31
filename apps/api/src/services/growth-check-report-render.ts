/**
 * FS-57 pure report builder and renderers. No I/O.
 *
 * Owner output is built only from reviewed findings (FS-56 effective state) and owner-facing draft fields.
 * internalNotes, finding review notes and revision reasons are never read here, so they cannot leak.
 */
import { createHash } from "node:crypto";

import {
  GROWTH_CHECK_REPORT_EVIDENCE_LABEL_REGISTRY,
  type GrowthCheckFindingView,
  type GrowthCheckReportDocument,
  type GrowthCheckReportDraftContent,
  type GrowthCheckReportEvidenceLabel,
  type GrowthCheckReportItem,
  type GrowthCheckReportOpportunity
} from "@fsm/types";

import { canonicalJson } from "../lib/canonical-json.js";

export interface GrowthCheckReportScanSource {
  id: string;
  targetUrl: string;
  rubricId: string;
  rubricVersion: string;
  createdAt: Date;
}

/** Review states that keep a finding out of the owner report. */
const HIDDEN_REVIEW_STATES = new Set(["dismissed", "not_applicable"]);

export function evidenceLabelFor(finding: GrowthCheckFindingView): GrowthCheckReportEvidenceLabel {
  if (finding.current.ownerConfirmedFact) return "owner_confirmed";
  if (finding.machine.confidence === "high" && finding.current.reviewState === "machine") return "observed";
  return "needs_confirmation";
}

function toItem(finding: GrowthCheckFindingView): GrowthCheckReportItem {
  return {
    findingId: finding.id,
    areaId: finding.areaId,
    checkLabel: finding.checkLabel ?? finding.checkId,
    summary: finding.current.summary,
    evidenceLabel: evidenceLabelFor(finding),
    sourceUrl: finding.sourceUrl
  };
}

export function isReportableFinding(finding: GrowthCheckFindingView, excluded: ReadonlySet<string>): boolean {
  return !excluded.has(finding.id) && !HIDDEN_REVIEW_STATES.has(finding.current.reviewState) && finding.current.ownerValidation !== "rejected";
}

export function buildGrowthCheckReportDocument(
  content: GrowthCheckReportDraftContent,
  scan: GrowthCheckReportScanSource,
  findings: GrowthCheckFindingView[],
  draftVersion: number
): GrowthCheckReportDocument {
  const excluded = new Set(content.excludedFindingIds);
  const reportable = findings.filter((f) => isReportableFinding(f, excluded));
  const byId = new Map(reportable.map((f) => [f.id, f]));

  const opportunities: GrowthCheckReportOpportunity[] = content.opportunities
    .map((input, order) => ({ input, order, finding: byId.get(input.findingId) }))
    .filter((entry): entry is typeof entry & { finding: GrowthCheckFindingView } => entry.finding !== undefined)
    .map((entry) => ({ ...entry, total: entry.input.impact + entry.input.evidence + entry.input.actionability }))
    .sort((a, b) => b.total - a.total || a.order - b.order)
    .map((entry, index) => ({
      ...toItem(entry.finding),
      rank: index + 1,
      headline: entry.input.headline,
      nextStep: entry.input.nextStep,
      score: {
        impact: entry.input.impact,
        evidence: entry.input.evidence,
        actionability: entry.input.actionability,
        total: entry.total
      }
    }));
  const opportunityIds = new Set(opportunities.map((o) => o.findingId));
  const whatsWorking = reportable
    .filter((f) => f.current.status === "pass" && !opportunityIds.has(f.id))
    .map(toItem);

  return {
    title: content.title,
    business: { name: content.businessName, serviceArea: content.serviceArea, website: scan.targetUrl },
    intro: content.intro,
    source: {
      scanId: scan.id,
      rubricId: scan.rubricId,
      rubricVersion: scan.rubricVersion,
      scannedAt: scan.createdAt.toISOString()
    },
    whatsWorking,
    opportunities,
    needsConfirmationCount: [...whatsWorking, ...opportunities].filter((i) => i.evidenceLabel === "needs_confirmation").length,
    draftVersion
  };
}

/** Deterministic JSON (sorted keys) so the content hash is stable. */

export function reportContentHash(report: GrowthCheckReportDocument): string {
  return createHash("sha256").update(canonicalJson(report)).digest("hex");
}

// Strip C0/C1 control characters except tab/newline; they have no place in owner-facing text.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
const clean = (value: string) => value.replace(CONTROL_CHARS, "");

export function escapeHtml(value: string): string {
  return clean(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#96;");
}

/** Backslash-escape Markdown syntax (and raw HTML angle brackets) in user text. */
export function escapeMarkdown(value: string): string {
  return clean(value)
    .replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, (ch) => `\\${ch}`)
    .replace(/\r?\n/g, " ");
}

const evidenceText = (label: GrowthCheckReportEvidenceLabel) => GROWTH_CHECK_REPORT_EVIDENCE_LABEL_REGISTRY[label] ?? label;

function businessLine(report: GrowthCheckReportDocument): string[] {
  const parts: string[] = [];
  if (report.business.name) parts.push(report.business.name);
  if (report.business.serviceArea) parts.push(`Service area: ${report.business.serviceArea}`);
  parts.push(`Website checked: ${report.business.website}`);
  return parts;
}

export function renderGrowthCheckReportHtml(report: GrowthCheckReportDocument): string {
  const e = escapeHtml;
  const out: string[] = [];
  out.push(`<article class="growth-check-report">`);
  out.push(`<h1>${e(report.title)}</h1>`);
  out.push(`<p class="business">${businessLine(report).map(e).join(" &middot; ")}</p>`);
  if (report.intro) out.push(`<p class="intro">${e(report.intro)}</p>`);
  out.push(`<h2>What&#39;s working</h2>`);
  if (report.whatsWorking.length === 0) out.push(`<p>No confirmed strengths yet.</p>`);
  else {
    out.push(`<ul>`);
    for (const item of report.whatsWorking) {
      out.push(`<li><strong>${e(item.checkLabel)}</strong>: ${e(item.summary)} <em>(${e(evidenceText(item.evidenceLabel))})</em></li>`);
    }
    out.push(`</ul>`);
  }
  out.push(`<h2>Top opportunities</h2>`);
  if (report.opportunities.length === 0) out.push(`<p>No opportunities selected.</p>`);
  else {
    out.push(`<ol>`);
    for (const o of report.opportunities) {
      out.push(
        `<li><strong>${e(o.headline)}</strong><p>${e(o.summary)} <em>(${e(evidenceText(o.evidenceLabel))})</em></p><p>Next step: ${e(o.nextStep)}</p></li>`
      );
    }
    out.push(`</ol>`);
  }
  if (report.needsConfirmationCount > 0) {
    out.push(`<p class="note">${report.needsConfirmationCount} item(s) still need confirmation from the business owner.</p>`);
  }
  out.push(`</article>`);
  return out.join("\n");
}

export function renderGrowthCheckReportText(report: GrowthCheckReportDocument): string {
  const out: string[] = [clean(report.title), businessLine(report).map(clean).join(" | ")];
  if (report.intro) out.push("", clean(report.intro));
  out.push("", "WHAT'S WORKING");
  if (report.whatsWorking.length === 0) out.push("- No confirmed strengths yet.");
  for (const item of report.whatsWorking) out.push(`- ${clean(item.checkLabel)}: ${clean(item.summary)} (${evidenceText(item.evidenceLabel)})`);
  out.push("", "TOP OPPORTUNITIES");
  if (report.opportunities.length === 0) out.push("- No opportunities selected.");
  for (const o of report.opportunities) {
    out.push(`${o.rank}. ${clean(o.headline)}`, `   ${clean(o.summary)} (${evidenceText(o.evidenceLabel)})`, `   Next step: ${clean(o.nextStep)}`);
  }
  if (report.needsConfirmationCount > 0) out.push("", `${report.needsConfirmationCount} item(s) still need confirmation from the business owner.`);
  return `${out.join("\n")}\n`;
}

export function renderGrowthCheckReportMarkdown(report: GrowthCheckReportDocument): string {
  const m = escapeMarkdown;
  const out: string[] = [`# ${m(report.title)}`, "", businessLine(report).map(m).join(" · ")];
  if (report.intro) out.push("", m(report.intro));
  out.push("", "## What's working", "");
  if (report.whatsWorking.length === 0) out.push("- No confirmed strengths yet.");
  for (const item of report.whatsWorking) out.push(`- **${m(item.checkLabel)}**: ${m(item.summary)} _(${evidenceText(item.evidenceLabel)})_`);
  out.push("", "## Top opportunities", "");
  if (report.opportunities.length === 0) out.push("- No opportunities selected.");
  for (const o of report.opportunities) {
    out.push(`${o.rank}. **${m(o.headline)}**: ${m(o.summary)} _(${evidenceText(o.evidenceLabel)})_`, `   Next step: ${m(o.nextStep)}`);
  }
  if (report.needsConfirmationCount > 0) out.push("", `_${report.needsConfirmationCount} item(s) still need confirmation from the business owner._`);
  return `${out.join("\n")}\n`;
}

export function renderGrowthCheckReportHtmlDocument(report: GrowthCheckReportDocument): string {
  return [
    "<!doctype html>",
    `<html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escapeHtml(report.title)}</title></head>`,
    `<body>${renderGrowthCheckReportHtml(report)}</body></html>`,
    ""
  ].join("\n");
}
