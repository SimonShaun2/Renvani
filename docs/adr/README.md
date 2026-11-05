# Architecture Decision Records

**Owner:** Technical Lead and architecture owners, with independent reviewers. Historical owner names below are evidence from the records, not current assignments.
**Authority:** Current founder direction, [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), [GITHUB_WORKFLOW.md](../../GITHUB_WORKFLOW.md), and [founder directive #420](https://github.com/SimonShaun2/Renvani/issues/420).
**Bootstrapped by:** FSM-0014 / [issue #15](https://github.com/SimonShaun2/Renvani/issues/15).
**Original index baseline:** 2026-11-05 UTC against `dev` at `b45b4996b64b16859e44a79b171b11cbe52c3e6a`; ten decision records.
**Current index reconciliation:** 2026-11-05 UTC against merged `dev` at `4daf6b46980fe335ad965dd910c3837fe2182ec1`; eleven decision records, including ADR-FS-234 from [#430](https://github.com/SimonShaun2/Renvani/pull/430). This index update makes no new architecture decision.

An ADR records a decision that constrains future work, together with the reasoning behind it.

## When an ADR is required

- A change to the technology baseline in AGENTS.md section 6.
- A change to system boundaries, module structure, tenant isolation, payment architecture, or authentication and authorization.
- A decision that will be expensive to reverse.

Ordinary implementation choices inside an existing boundary do not need an ADR.

## Lifecycle

`Proposed` → `Accepted` → `Superseded` / `Deprecated`

Preserve accepted decision histories. Record a reversed decision in a new ADR, and mark the prior record Superseded with a forward reference. Correcting an index or current-process link does not establish a previously missing decision or sign-off.

## Authoring, review and merge

Architecture owners draft ADRs; the Technical Lead owns architecture and shared-contract decisions. The Product Owner reviews product consequences. Record the actual independent peer review, QA and Security evidence required by the change's risk, including consumers and migrations where relevant.

Related implementation merges require approved batch CI and the applicable independent gates at the exact head. **The founder alone approves every named PR merge into `dev` at its exact reviewed head; production promotion to `main` is separate.** Codex Lead / Technical Lead coordinates readiness and execution. E.. CoS advice is optional and has no approval, dispatch, CI or merge authority. A new commit needs fresh affected review evidence. See TEAM.md sections 3–5 and GITHUB_WORKFLOW.md.

An ADR's recorded status, completion of the implementing ticket, a merge to `dev`, and a production release are separate facts. Do not infer one from another.

## Identifiers

Two established conventions coexist. Preserve every existing identifier and filename:

| Convention | Existing examples | Use |
| --- | --- | --- |
| Zero-padded sequence | `ADR-0001` through `ADR-0004` | Original repository-wide decision sequence; never reuse a number. |
| Board-linked or named record | `ADR-FS-3`, `ADR-FS-41`, `ADR-FS-59`, `ADR-FS-93`, `ADR-FS-234`, `ADR-FS-MIGRATE`, `ADR-FS-STACK` | Decisions attached to FS work or a named cross-cutting topic. `FS-3` is not renamed to `0003`. |

Use [ADR-TEMPLATE.md](ADR-TEMPLATE.md), choose an unused identifier with the Technical Lead, and identify the actual current role owners. Legacy `TL-01` / `QA-02` names and sprint labels in existing records are historical, not operating assignments.

## Index

Status is copied from each decision file at the current integration head recorded above. The original ten-record audit remains tied to its earlier baseline. **Proposed remains Proposed unless the actual acceptance record is reconciled.**

| ADR | Title | Status in this source tree | Recorded owner | Scope |
| --- | --- | --- | --- | --- |
| [ADR-0001](ADR-0001-restart-on-existing-repository.md) | Restart on existing repository | Accepted | TL-01 | Repository |
| [ADR-0002](ADR-0002-tenant-model.md) | Tenant model | **Proposed** | TL-01 | Legacy Sprint 2 |
| [ADR-0003](ADR-0003-stripe-connect-charge-model.md) | Stripe Connect charge model | **Proposed** | BE-02 / TL-01 | Legacy Sprint 8 |
| [ADR-0004](ADR-0004-modular-architecture.md) | Modular architecture over microservices | Accepted | TL-01 | Architecture |
| [ADR-FS-3](ADR-FS-3-v1-v2-schema-and-governance.md) | V1/V2 schema and governance baseline | **Proposed** | FS-3 review roles recorded in file | FS-3 |
| [ADR-FS-41](ADR-FS-41-renvani-sor-integrations-addendum.md) | Renvani system of record and integration boundaries | **Proposed**; PO + Security ACK required in record | Tech Lead; Product Owner; Security | FS-41 |
| [ADR-FS-59](ADR-FS-59-recurring-visit-series.md) | Recurring visit series and occurrence model | **Proposed** | Felix (Pair 3) | FS-59 |
| [ADR-FS-93](ADR-FS-93-managed-platform-boundaries.md) | Managed platform boundaries | **Accepted** by founder; PO + Security ACK pending for ticket completion | Tech Lead | FS-93 |
| [ADR-FS-234](ADR-FS-234-authoritative-outbound-consent.md) | Authoritative outbound consent ledger | Product and Technical Lead approved for bounded schema/service implementation; Security, migration, QA, and integration gates pending | BE1B (proposer); BE1A and Technical Lead (contract/schema) | FS-234 |
| [ADR-FS-MIGRATE](ADR-FS-MIGRATE-import-lineage.md) | Import lineage, business timestamps and chunked ingest | **Accepted** | Tech Lead (Grace); PO (Elena) | FS-MIGRATE |
| [ADR-FS-STACK](ADR-FS-STACK-renvani-official-platform.md) | Official platform stack | **Proposed** | Tech Lead (Grace); PO (Elena) | STACK |

## Integrated status reconciliation and historical process text

**PR #95 is integrated with its corrected provenance.** [#95](https://github.com/SimonShaun2/Renvani/pull/95) merged to `dev` as `a4456a2cb6e9729d9bf34ab1e505b8aaa2e73280` from reviewed head `a0ca0393ce72f0286bed830cffd28883a3ae47e0`. Its decision file is inherited unchanged from the current integration head. The Accepted header cites merged #94 and the Product Owner's acceptance-on-merge ACK; the Tech Lead row accurately records Proposed in that PO record and does not invent a separate Grace acceptance. The expanded index retains its original ten records and adds the newly integrated FS-234 record.

**Historical #95 input:** The original delivery inspected `1ea9d4432195c88bcbaacf923d1474de0685cfe7`. Its [record](https://github.com/SimonShaun2/Renvani/blob/1ea9d4432195c88bcbaacf923d1474de0685cfe7/docs/adr/ADR-FS-MIGRATE-import-lineage.md), [independent review](https://github.com/SimonShaun2/Renvani/pull/95#pullrequestreview-5757051288), and [CI run](https://github.com/SimonShaun2/Renvani/actions/runs/41681574822) remain evidence at that original head. They are not relabeled as approval of a later head or this reconciliation.

**FS-234 coverage:** [#430](https://github.com/SimonShaun2/Renvani/pull/430) merged as `4daf6b46980fe335ad965dd910c3837fe2182ec1` from `d6560815408450bd8e88c892f417d3a1a28571be`. The index copies the ADR's qualified status exactly, including its recorded pending gates; it does not promote or rewrite the ADR because a bounded implementation merged. Current implementation review/CI evidence belongs to #430. Full affirmative capture, approved copy and provider-boundary acceptance remain separate from indexing this decision.

**Dated process clarification, 2026-11-05 UTC:** ADR-FS-3 still contains historical E.. CoS gate language. It does not override #420 or the current authoring/merge process above. Merged #95 replaces that gate in ADR-FS-MIGRATE with founder merge authority. The import-lineage record's 0026 reservation/sequencing prose is historical: migration 0026 was already present at the original baseline. This reconciliation edits no decision file, tenant/payment proposal, migration or recorded ACK; the corrected #95 and new #430 records are inherited from `dev`.

The [documentation reconciliation ledger](../audit/DESIGN-DOCS-RECONCILIATION.md) records source heads, file ownership, integration order and link/status validation.
