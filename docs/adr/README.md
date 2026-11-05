# Architecture Decision Records

**Owner:** Technical Lead and architecture owners, with independent reviewers. Historical owner names below are evidence from the records, not current assignments.
**Authority:** Current founder direction, [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), [GITHUB_WORKFLOW.md](../../GITHUB_WORKFLOW.md), and [founder directive #420](https://github.com/SimonShaun2/Renvani/issues/420).
**Bootstrapped by:** FSM-0014 / [issue #15](https://github.com/SimonShaun2/Renvani/issues/15).
**Index reconciled:** 2026-11-05 UTC against `dev` at `b45b4996b64b16859e44a79b171b11cbe52c3e6a`; ten decision records. This index update makes no new architecture decision.

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
| Board-linked or named record | `ADR-FS-3`, `ADR-FS-41`, `ADR-FS-59`, `ADR-FS-93`, `ADR-FS-MIGRATE`, `ADR-FS-STACK` | Decisions attached to FS work or a named cross-cutting topic. `FS-3` is not renamed to `0003`. |

Use [ADR-TEMPLATE.md](ADR-TEMPLATE.md), choose an unused identifier with the Technical Lead, and identify the actual current role owners. Legacy `TL-01` / `QA-02` names and sprint labels in existing records are historical, not operating assignments.

## Index

Status is copied from the decision file at the recorded source head. **Proposed remains Proposed unless the actual acceptance record is reconciled.**

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
| [ADR-FS-MIGRATE](ADR-FS-MIGRATE-import-lineage.md) | Import lineage, business timestamps and chunked ingest | **Proposed in this tree**; #95 carries an Accepted-status follow-up | Tech Lead (Grace); PO (Elena) | FS-MIGRATE |
| [ADR-FS-STACK](ADR-FS-STACK-renvani-official-platform.md) | Official platform stack | **Proposed** | Tech Lead (Grace); PO (Elena) | STACK |

## Pending status reconciliation and historical process text

**PR #95 is preserved, not overwritten.** At `1ea9d4432195c88bcbaacf923d1474de0685cfe7`, [#95](https://github.com/SimonShaun2/Renvani/pull/95) changes both the import-lineage record and its index row to Accepted and records review assertions tied to #94. Its [record](https://github.com/SimonShaun2/Renvani/blob/1ea9d4432195c88bcbaacf923d1474de0685cfe7/docs/adr/ADR-FS-MIGRATE-import-lineage.md), [later independent review](https://github.com/SimonShaun2/Renvani/pull/95#pullrequestreview-5757051288), and [recorded CI run](https://github.com/SimonShaun2/Renvani/actions/runs/41681574822) remain evidence at that head. This branch updates the index/process only and leaves the decision file unchanged, so it records the dev status and the pending delta separately. When #95 is integrated with this index, retain its decision-file changes and reconcile this single row and note against the resulting file; do not replace the expanded index with the old eight-row version. Review assertions are not new founder merge approval.

**Dated process clarification, 2026-11-05 UTC:** ADR-FS-3 and ADR-FS-MIGRATE still contain historical E.. CoS gate language. It does not override #420 or the current authoring/merge process above. ADR-FS-MIGRATE's old “blocks 0026” sequencing text is historical: migration 0026 is already present at the recorded dev head. No accepted decision history, tenant/payment proposal, migration, or recorded ACK is rewritten by this index repair.

The [documentation reconciliation ledger](../audit/DESIGN-DOCS-RECONCILIATION.md) records source heads, file ownership, integration order and link/status validation.
