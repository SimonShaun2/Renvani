import type { GrowthCheckFindingView, GrowthCheckReportDraftContent } from "@fsm/types";
import { describe, expect, it } from "vitest";

import {
  buildGrowthCheckReportDocument,
  escapeHtml,
  escapeMarkdown,
  renderGrowthCheckReportHtml,
  renderGrowthCheckReportMarkdown,
  reportContentHash
} from "./growth-check-report-render.js";

const scan = { id: "s1", targetUrl: "https://example-plumbing.test/", rubricId: "home-services", rubricVersion: "1.0.0", createdAt: new Date("2026-10-01T00:00:00Z") };
const finding = (id: string, over: Partial<GrowthCheckFindingView["current"]> = {}, confidence: "high" | "medium" = "high"): GrowthCheckFindingView => ({
  id, scanId: "s1", areaId: "a", checkId: id, checkLabel: `Check ${id}`, sourceUrl: "https://example-plumbing.test/",
  observedAt: "2026-10-01T00:00:00.000Z", machine: { status: "fail", confidence, summary: "m" },
  current: { status: "fail", summary: `summary ${id}`, reviewState: "machine", ownerValidation: "not_requested", ownerConfirmedFact: false, lastNote: "SECRET-NOTE", ...over },
  revision: 0, updatedAt: "2026-10-01T00:00:00.000Z"
});
const content = (over: Partial<GrowthCheckReportDraftContent> = {}): GrowthCheckReportDraftContent => ({
  title: "Report", businessName: null, serviceArea: null, intro: null, internalNotes: "SECRET-INTERNAL", opportunities: [], excludedFindingIds: [], ...over
});

describe("FS-57 report renderer", () => {
  it("escapes every HTML-significant character and strips control characters", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&\`\u0007</a>`)).toBe("&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&#96;&lt;/a&gt;");
  });

  it("escapes markdown syntax so user text cannot inject links, images or HTML", () => {
    expect(escapeMarkdown("![x](javascript:alert(1)) <b>*hi*</b>\n# h")).toBe(
      "\\!\\[x\\]\\(javascript:alert\\(1\\)\\) \\<b\\>\\*hi\\*\\</b\\> \\# h"
    );
  });

  it("ranks opportunities by total score then input order, labels evidence, and omits notes", () => {
    const findings = [
      finding("f1"),
      finding("f2", {}, "medium"),
      finding("f3", { ownerConfirmedFact: true, ownerValidation: "confirmed" }),
      finding("f4", { status: "pass" }),
      finding("f5", { status: "pass", ownerValidation: "rejected" })
    ];
    const opp = (findingId: string, impact: number) => ({ findingId, headline: `H ${findingId}`, nextStep: "N", impact, evidence: 1, actionability: 1 });
    const doc = buildGrowthCheckReportDocument(content({ opportunities: [opp("f1", 2), opp("f2", 3), opp("f3", 2)] }), scan, findings, 4);
    expect(doc.opportunities.map((o) => [o.rank, o.findingId, o.evidenceLabel])).toEqual([
      [1, "f2", "needs_confirmation"],
      [2, "f1", "observed"],
      [3, "f3", "owner_confirmed"]
    ]);
    expect(doc.whatsWorking.map((i) => i.findingId)).toEqual(["f4"]);
    expect(doc.needsConfirmationCount).toBe(1);
    const out = JSON.stringify(doc) + renderGrowthCheckReportHtml(doc) + renderGrowthCheckReportMarkdown(doc);
    expect(out).not.toContain("SECRET");
  });

  it("hashes content deterministically regardless of key order", () => {
    const doc = buildGrowthCheckReportDocument(content(), scan, [finding("f4", { status: "pass" })], 1);
    const reordered = JSON.parse(JSON.stringify({ ...doc, title: doc.title })) as typeof doc;
    expect(reportContentHash(reordered)).toBe(reportContentHash(doc));
    expect(reportContentHash({ ...doc, title: "Other" })).not.toBe(reportContentHash(doc));
  });
});
