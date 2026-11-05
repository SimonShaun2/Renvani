# ADR, design and frontend documentation reconciliation

**Build specifications:** 2, 3 and 4.
**Snapshot:** 2026-11-05 UTC.
**Source base:** `dev` at `b45b4996b64b16859e44a79b171b11cbe52c3e6a`.
**Delivery branch:** `docs/renvani-build-specs-02-12-20261105`. The publishing PR records the exact resulting commit and review evidence; this file records the immutable input heads.
**Disposition:** Documentation changes and source inventory prepared for independent review. Original PRs are neither merged nor closed by this reconciliation. Runtime parity and workflow acceptance remain open.

## Why this reconciliation exists

The current ADR README omitted two decision records and retained a retired E.. CoS acceptance gate. Three open design documentation PRs contained overlapping but distinct changes. Meanwhile the dev tree contained 112 page files, while older inventory text described roughly 40. The new documentation aligns current instructions, preserves the existing evidence and records the actual source denominator without presenting it as accepted software.

This is a bounded delivery against [#15](https://github.com/SimonShaun2/Renvani/issues/15), [#420](https://github.com/SimonShaun2/Renvani/issues/420), [#433](https://github.com/SimonShaun2/Renvani/issues/433), FS-51 and the source-inventory slice of [#6](https://github.com/SimonShaun2/Renvani/issues/6). It does not reactivate the legacy Sprint 0 program or close those broad issues.

## Inputs and preservation decisions

| Existing work | Exact input head | Unique delta and treatment |
| --- | --- | --- |
| [#95](https://github.com/SimonShaun2/Renvani/pull/95) | `1ea9d4432195c88bcbaacf923d1474de0685cfe7` | Its import-lineage ADR and index change to Accepted remain on #95. The expanded index records **Proposed in this dev tree**, explicitly links the Accepted-status follow-up, and gives merge-resolution instructions. No decision-file acceptance or historical ACK is invented or overwritten. |
| [#131](https://github.com/SimonShaun2/Renvani/pull/131) | `41f5842e364066a49dcaa0e5df8fb3c7817a692a` | Preserve the single canonical Figma file in the entry point. Copy both unique canonical marketing references in PHASE3-TICKETS.md and PHASE3-REMAINING-TICKETS.md; add historical notices to the original plans. |
| [#404](https://github.com/SimonShaun2/Renvani/pull/404) | `8af8bd4bf415c0e185d2112dd382c6a7200227f8` | Retain the FS-51 handoff and all 25 route-map IDs, nodes, source paths and existing parity-unverified statuses. Extend those same files with source/PR/evidence metadata and link one source appendix. Correct residual optional-advisor wording in the next-action paragraph. |
| [#434](https://github.com/SimonShaun2/Renvani/pull/434) | `d25f99c36f4a094c61b34b1021c157d0bb700f95` | Retain its Renvani parity contract, current-brand boundary, docs-entry correction and UI PR template evidence requirements. Add explicit missing-frame, evidence-classification and Design-exception records. Its separate root-governance parity inserts are preserved in #434; see the file-level ledger below. |

The following later evidence is preserved at its original head, not relabeled as a review of the new combined documentation:

| PR | Existing review | Existing CI record |
| --- | --- | --- |
| #95 | [5757051288](https://github.com/SimonShaun2/Renvani/pull/95#pullrequestreview-5757051288) | [41681574822](https://github.com/SimonShaun2/Renvani/actions/runs/41681574822) |
| #131 | [5756636936](https://github.com/SimonShaun2/Renvani/pull/131#pullrequestreview-5756636936) | [41678010841](https://github.com/SimonShaun2/Renvani/actions/runs/41678010841) |
| #404 | [5757051666](https://github.com/SimonShaun2/Renvani/pull/404#pullrequestreview-5757051666) | [41683734183](https://github.com/SimonShaun2/Renvani/actions/runs/41683734183) |

These are recorded review/run sources. They do not grant founder merge approval for a new head, prove that skipped checks executed, or establish visual parity.

## File ownership and overlap resolution

| File or group | Ownership in this delivery | Preservation and remaining integration action |
| --- | --- | --- |
| `docs/adr/README.md` | Spec 2 | Ten-record index, actual source statuses, both identifier conventions, current founder merge process. Coordinate the shared import-lineage row with #95; keep the expanded index when resolving that overlap. |
| `docs/adr/ADR-FS-MIGRATE-import-lineage.md` | Existing #95; unchanged here | Review/merge its actual status/acceptance-record delta separately. This delivery neither reconstructs nor endorses unverified historical sign-offs. |
| `docs/README.md` | Spec 3, combining #131/#434 | Current Renvani identity, one canonical design source, direct links to FS-51 and evidence packets, correct canonical schema in current session instructions. Historical milestone/count tables retained with an explicit archive boundary. |
| `docs/planning/PHASE3-TICKETS.md`, `PHASE3-REMAINING-TICKETS.md` | Spec 3 | Both exact #131 marketing-reference edits retained. Added archive notices override old instructions without rewriting the historical body. |
| `docs/planning/PHASE2-MASTER-PLAN.md` and 16 legacy `docs/tickets/TICKET-*.md` with retired copy/design references | Spec 3 | Small historical notices link current governance, canonical Figma and `packages/db/src/schema.ts`. Original examples, persisted keys and records are preserved. TICKET-014a contains none of the selected obsolete brand/design markers and was not changed. |
| `docs/design/RENVANI_FIGMA_PARITY.md` | Spec 3, from #434 | Preserves precise nodes, real interaction requirements, responsive/error-state evidence, independent Design/QA and founder merge boundary. Adds missing-frame/exception and separate-source-head handling. |
| `.github/pull_request_template.md` | Spec 3, from #434 | Requires source/preview/API context, exact frames, roles, viewport/state evidence, Design PASS/HOLD or a bounded authorized exception, and the existing FS-51 map. |
| `AGENTS.md`, `CODEX.md`, `GITHUB_WORKFLOW.md` | Existing #434 parity delta; root files unchanged here | Current #420 execution/merge governance is already installed on dev. #434's additional parity crosslinks/instructions remain a unique pending delta. Equivalent UI requirements are retained in the copied parity contract and template, but this report does **not** claim the root-file insertions were integrated or #434 is wholly superseded. Reconcile that remaining delta through its reviewed path. |
| `docs/design/FS-51-figma-production-handoff.md` and `fs-51-figma-route-map.json` | Spec 4, continuing #404 | The same 25-surface map remains the only design crosswalk. Added full dev/PR heads, definitions of source/build/browser/accepted evidence, required frames and a link to the operator packet. No approved-frame or parity result fabricated. |
| `docs/audit/FRONTEND-INVENTORY.md` and `frontend-source-inventory.json` | Spec 4 appendix | All 112 page files, 112 normalized URL patterns, principal UI imports, 70 reachable hook/API modules and source role/state evidence. Not a second design map. |
| `docs/audit/OPERATOR-ACCEPTANCE.md` | Spec 12 | Owns actual owner/office/technician test cases, credentials/fixture prerequisites, screenshots and dispositions. This source inventory does not fill runtime outcomes. |
| Environment/production guide and FS-83 domain annotations | Spec 5 | Separate scoped ownership; linked through the current docs entry point. No provider configuration or domain is changed by historical annotations. |

## ADR validation and meaning of status

The source has ten decision files after excluding ADR-TEMPLATE.md. The index lists each exactly once. ADR-FS-3 and ADR-FS-59 were the two missing rows. ADR-0002 and ADR-0003 remain Proposed; the edit accepts no tenant model or payment architecture. The source's accepted records, including ADR-FS-93's pending ticket-completion ACKs, retain their actual qualifications.

The index documents both `ADR-000N` and existing `ADR-FS-*` identifiers without renumbering. It records historical CoS/0026 sequencing contradictions in a dated process note instead of editing decision history. Every decision file is unchanged in this branch.

## Design-source and frontend validation

The only operative Figma file is `jiGHTNUJNltWbHA4Il3hk7`. References to the two retired file IDs appear only in explicitly historical content or retirement explanations. All 16 affected legacy ticket bodies are byte-for-byte preserved after their notices; both #131 planning edits are retained in their original locations. Current docs use Renvani and the canonical schema path.

All 25 original map entries retain their IDs, node IDs/URLs, route patterns and source code paths. Each mapped code path resolves at `b45b4996b64b16859e44a79b171b11cbe52c3e6a`. The map retains parity-not-verified status and adds explicit unexecuted browser evidence. The source appendix is generated from the recorded Git tree and checks **366 distinct recorded source paths**. Its denominator is:

| Group | Page files |
| --- | ---: |
| Operator `(app)` | 64 |
| Authentication `(auth)` | 5 |
| Marketing `(marketing)` | 11 |
| Field `(mobile)` | 13 |
| Customer `(public)` | 18 |
| Root | 1 |
| **Total** | **112** |

The inventory distinguishes the UI prefix whitelist from server layouts and API authorization. Mobile layout permits owner/technician even though middleware also permits admin by prefix. Office and dispatcher remain separate roles. API permission differences and observed runtime results belong in the backend inventory and operator acceptance packet.

The exact dedicated approved frames for Revenue Center, Customers list, Estimates list, Timesheets and General/Company Profile remain unverified. Existing node references are preserved from #404/#434; no new Figma inspection or browser comparison is claimed by this reconciliation.

## Integration sequence

1. Review the new combined documentation at its published exact head. The publishing PR records local link/count validation and independent review; none of the old PR sign-offs automatically transfers.
2. Resolve #95's decision-file/status row together with the expanded index when its separately reviewed status change is integrated. Preserve proposed tenant/payment decisions and the pending ACK distinctions.
3. Select one founder-approved integration path for the overlapping #131/#404/#434 files and this branch. Preserve each unique delta listed above. Do not blindly merge overlapping old copies over the expanded files. Existing PRs stay open until their ownership and every retained/pending delta are reconciled.
4. Retain #434's root-file parity insertions as pending work until explicitly incorporated or dispositioned through review. A duplicated contract/template alone does not make the entire PR redundant.
5. Complete the separate browser/design/role acceptance at the actual integrated source head. Apply the current exact-head CI/review and founder merge process; no merge, production release or Phase II implementation follows automatically from this report.

## Completion boundaries

Specs 2–4 deliver current documentation, explicit overlap resolution and source evidence. They do not certify live auth, native file-picker behavior, responsive accessibility, tenant enforcement, working booking/payment/provider chains or design parity. The original UI changes remain on their separate PRs. Known Company Profile concurrency and broader stack integration remain with their existing owners/Codex work, and missing runtime evidence remains visible.
