# ADR, design and frontend documentation reconciliation

**Build specifications:** 2, 3 and 4.
**Snapshot:** 2026-11-05 UTC.
**Original source base:** `dev` at `b45b4996b64b16859e44a79b171b11cbe52c3e6a`.
**Current integration base:** `dev` at `4daf6b46980fe335ad965dd910c3837fe2182ec1`, after the sequential merges recorded below.
**Delivery branch:** `docs/renvani-build-specs-02-12-20261105`. The publishing PR records the exact resulting commit and review evidence; this file preserves the immutable original inputs and subsequent integration facts.
**Disposition:** The expanded documentation is reconciled with merged #131/#404/#441/#95/#434/#430 and awaits its own final-head independent review and approved CI. Original inventories and observations retain their dated source heads. Runtime parity and full workflow acceptance remain open.

## Why this reconciliation exists

At the original baseline, the ADR README omitted two decision records and retained a retired E.. CoS acceptance gate. Three then-open design documentation PRs contained overlapping but distinct changes. That dev tree contained 112 page files, while older inventory text described roughly 40. The documentation aligns current instructions, preserves the existing evidence and records the measured source denominator without presenting it as accepted software.

This is a bounded delivery against [#15](https://github.com/SimonShaun2/Renvani/issues/15), [#420](https://github.com/SimonShaun2/Renvani/issues/420), [#433](https://github.com/SimonShaun2/Renvani/issues/433), FS-51 and the source-inventory slice of [#6](https://github.com/SimonShaun2/Renvani/issues/6). It does not reactivate the legacy Sprint 0 program or close those broad issues.

## Original inputs and preservation decisions

| Existing work | Exact input head | Unique delta and treatment |
| --- | --- | --- |
| [#95](https://github.com/SimonShaun2/Renvani/pull/95) | `1ea9d4432195c88bcbaacf923d1474de0685cfe7` | The original delivery kept its Accepted-status follow-up separate from the baseline's Proposed record. The corrected final #95 is now inherited from merged dev; the expanded index records Accepted and retains the truthful Tech Lead provenance without inventing an ACK. |
| [#131](https://github.com/SimonShaun2/Renvani/pull/131) | `41f5842e364066a49dcaa0e5df8fb3c7817a692a` | Preserve the single canonical Figma file in the entry point. Copy both unique canonical marketing references in PHASE3-TICKETS.md and PHASE3-REMAINING-TICKETS.md; add historical notices to the original plans. |
| [#404](https://github.com/SimonShaun2/Renvani/pull/404) | `8af8bd4bf415c0e185d2112dd382c6a7200227f8` | Retain the FS-51 handoff and all 25 route-map IDs, nodes, source paths and existing parity-unverified statuses. Extend those same files with source/PR/evidence metadata and link one source appendix. Correct residual optional-advisor wording in the next-action paragraph. |
| [#434](https://github.com/SimonShaun2/Renvani/pull/434) | `d25f99c36f4a094c61b34b1021c157d0bb700f95` | Retain its Renvani parity contract, current-brand boundary, docs-entry correction and UI PR template evidence requirements, extended with missing-frame, evidence-classification and Design-exception records. Its root-governance parity inserts are now inherited unchanged from merged dev; see the file-level ledger below. |

## Integrated predecessor state

The current integration base contains all six merges below. These facts come from its Git ancestry; they do not change the original source baselines or transfer approval to #440.

| PR | Reviewed head merged | Merge commit in dev | Preserved result |
| --- | --- | --- | --- |
| [#131](https://github.com/SimonShaun2/Renvani/pull/131) | `41f5842e364066a49dcaa0e5df8fb3c7817a692a` | `866b4541315d7e6f10a48b94bc93c8976323c226` | Canonical Figma reference, exact-frame requirement, retired file IDs and both Phase 3 marketing-reference edits. |
| [#404](https://github.com/SimonShaun2/Renvani/pull/404) | `8af8bd4bf415c0e185d2112dd382c6a7200227f8` | `0a3edaeb99468305535e1573699b6eab6f9329a4` | Original FS-51 handoff and all 25 map entries, extended by this delivery. |
| [#441](https://github.com/SimonShaun2/Renvani/pull/441) | `e3470949b99056c59467913ab46e6cfdedf4eaa8` | `c10c932d241bcc4a74a4056142df06e539f55c5f` | Cleanup inherited unchanged from dev; original inventory SHAs remain historical evidence. |
| [#95](https://github.com/SimonShaun2/Renvani/pull/95) | `a0ca0393ce72f0286bed830cffd28883a3ae47e0` | `a4456a2cb6e9729d9bf34ab1e505b8aaa2e73280` | Accepted import-lineage record with corrected, directly linked #94 provenance. |
| [#434](https://github.com/SimonShaun2/Renvani/pull/434) | `b8160a96afe7eef811e41978c0d9670af1751a3f` | `a2f23805c94b342b55449a96e2b71df960bbc60c` | All three unique root governance sections plus the canonical reference and parity requirements. |
| [#430](https://github.com/SimonShaun2/Renvani/pull/430) | `d6560815408450bd8e88c892f417d3a1a28571be` | `4daf6b46980fe335ad965dd910c3837fe2182ec1` | Bounded consent foundation inherited unchanged; new ADR included with its exact qualified source status. Full capture/provider acceptance remains open. |

## Historical review evidence

The following evidence remains attached to its original head. It is not relabeled as review or CI of the new combined documentation:

| PR | Existing review | Existing CI record |
| --- | --- | --- |
| #95 | [5757051288](https://github.com/SimonShaun2/Renvani/pull/95#pullrequestreview-5757051288) | [41681574822](https://github.com/SimonShaun2/Renvani/actions/runs/41681574822) |
| #131 | [5756636936](https://github.com/SimonShaun2/Renvani/pull/131#pullrequestreview-5756636936) | [41678010841](https://github.com/SimonShaun2/Renvani/actions/runs/41678010841) |
| #404 | [5757051666](https://github.com/SimonShaun2/Renvani/pull/404#pullrequestreview-5757051666) | [41683734183](https://github.com/SimonShaun2/Renvani/actions/runs/41683734183) |

These are recorded review/run sources. They do not grant founder merge approval for a new head, prove that skipped checks executed, or establish visual parity.

## File ownership and overlap resolution

| File or group | Ownership in this delivery | Preservation and integration result |
| --- | --- | --- |
| `docs/adr/README.md` | Spec 2 | Original ten-record audit preserved; current index includes all eleven decisions at the integration base, corrected #95 status, exact #430 qualifications, both identifier conventions and current founder merge process. |
| `docs/adr/ADR-FS-MIGRATE-import-lineage.md` | Inherited from merged #95 | Decision file is byte-identical to the integration base. This delivery neither reconstructs nor endorses unverified historical sign-offs. |
| `docs/adr/ADR-FS-234-authoritative-outbound-consent.md` | Inherited from merged #430 | Decision file is byte-identical to the integration base. Its recorded status still qualifies bounded Product/Technical Lead approval and pending gates; indexing does not promote the ADR or establish full FS-234 acceptance. |
| `docs/README.md` | Spec 3, combining #131/#434 | Current Renvani identity, one canonical design source, direct links to FS-51 and evidence packets, correct canonical schema in current session instructions. Historical milestone/count tables retained with an explicit archive boundary. |
| `docs/planning/PHASE3-TICKETS.md`, `PHASE3-REMAINING-TICKETS.md` | Spec 3 | Both exact #131 marketing-reference edits retained. Added archive notices override old instructions without rewriting the historical body. |
| `docs/planning/PHASE2-MASTER-PLAN.md` and 16 legacy `docs/tickets/TICKET-*.md` with retired copy/design references | Spec 3 | Small historical notices link current governance, canonical Figma and `packages/db/src/schema.ts`. Original examples, persisted keys and records are preserved. TICKET-014a contains none of the selected obsolete brand/design markers and was not changed. |
| `docs/design/RENVANI_FIGMA_PARITY.md` | Spec 3, from #434 | Preserves precise nodes, real interaction requirements, responsive/error-state evidence, independent Design/QA and founder merge boundary. Adds missing-frame/exception and separate-source-head handling. |
| `.github/pull_request_template.md` | Spec 3, from #434 | Requires source/preview/API context, exact frames, roles, viewport/state evidence, Design PASS/HOLD or a bounded authorized exception, and the existing FS-51 map. |
| `AGENTS.md`, `CODEX.md`, `GITHUB_WORKFLOW.md` | Inherited from merged #434 | All three root files are byte-identical to the integration base, preserving its unique parity crosslinks/instructions and current #420 execution/merge governance. The expanded contract and template retain those requirements. |
| `docs/design/FS-51-figma-production-handoff.md` and `fs-51-figma-route-map.json` | Spec 4, continuing #404 | The same 25-surface map remains the only design crosswalk. Added full dev/PR heads, definitions of source/build/browser/accepted evidence, required frames and a link to the operator packet. No approved-frame or parity result fabricated. |
| `docs/audit/FRONTEND-INVENTORY.md` and `frontend-source-inventory.json` | Spec 4 appendix | All 112 page files, 112 normalized URL patterns, principal UI imports, 70 reachable hook/API modules and source role/state evidence. Not a second design map. |
| `docs/audit/OPERATOR-ACCEPTANCE.md` | Spec 12 | Owns actual owner/office/technician test cases, credentials/fixture prerequisites, screenshots and dispositions. This source inventory does not fill runtime outcomes. |
| Environment/production guide and FS-83 domain annotations | Spec 5 | Separate scoped ownership; linked through the current docs entry point. No provider configuration or domain is changed by historical annotations. |

## ADR validation and meaning of status

The original `b45b4996` source had ten decision files after excluding ADR-TEMPLATE.md; ADR-FS-3 and ADR-FS-59 were the two missing index rows. The current integration base adds ADR-FS-234, so the reconciled index lists eleven decision files exactly once. ADR-0002 and ADR-0003 remain Proposed; the edit accepts no tenant model or payment architecture. Accepted records, including ADR-FS-93's pending ticket-completion ACKs, retain their actual qualifications. ADR-FS-234's status is copied verbatim from its decision file rather than inferred from #430's implementation merge.

The index documents both `ADR-000N` and existing `ADR-FS-*` identifiers without renumbering. It records historical CoS/0026 sequencing contradictions in a dated process note. This reconciliation edits no decision file: all eleven and the template are byte-identical to the integration base, including #95's corrected record and #430's new record. The original delivery's ten decision files were unchanged against its original baseline; that historical fact is not presented as a claim that #95 never changed its record.

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

## Integration sequence and remaining gates

1. The predecessor PRs were merged sequentially as recorded above. Their final reviewed heads and merge commits are distinct from the immutable original input heads.
2. The normal merge of current dev into this documentation branch preserves #95's corrected Accepted record, #131's canonical edits, #404's single map, #434's unique root governance and the inherited #441/#430 code. Expanded documentation and all original JSON evidence are retained.
3. Review the reconciled documentation at its new published exact head. The publishing PR records preservation/link/JSON checks and fresh independent review; old sign-offs and CI do not transfer. Run an approved batch for that final head before its authorized merge.
4. Preserve the proposed tenant/payment decisions and all recorded status qualifications. Full FS-234 capture/provider acceptance remains separate from its integrated foundation and this index update.
5. Complete browser/design/role acceptance at the actual integrated application head. The UI stack remains separate. Production release and Phase II implementation require their existing acceptance and founder authority.

## Completion boundaries

Specs 2–4 deliver current documentation, explicit overlap resolution and source evidence. They do not certify live auth, native file-picker behavior, responsive accessibility, tenant enforcement, working booking/payment/provider chains or design parity. The original UI changes remain on their separate PRs. Company Profile whitespace-normalization and overlapping-save concerns were identified in source inherited by both baseline dev and #438; no authenticated runtime failure or new #438 persistence regression has been established. Reproduce those concerns in isolated tests and retain S05's expected behavior for runtime acceptance. Broader stack integration and missing runtime evidence remain with their existing owners/Codex work.
