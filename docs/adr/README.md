# Architecture Decision Records

**Owner:** Architecture / peer reviewers (Sprint 0 tables may show legacy IDs)
**Authority:** Founder direction and `TEAM.md`
**Bootstrapped by:** FSM-0014

An ADR records a decision that constrains future work, together with the reasoning behind it.

## When An ADR Is Required

- Any change to the technology baseline in `AGENTS.md` section 6
- Any change to system boundaries or module structure
- Any change to the tenant isolation model
- Any change to payment architecture or money flow
- Any change to the authentication or authorization model
- Any decision that will be expensive to reverse

Ordinary implementation choices inside an existing boundary do not need an ADR.

## Lifecycle

`Proposed` -> `Accepted` -> `Superseded` / `Deprecated`

ADRs are never deleted or edited after acceptance. A reversed decision is recorded in a new
ADR, and the prior record is marked `Superseded` with a forward reference.

## Authoring And Approval

Architecture owners draft ADRs. Product Owner reviews ADRs with product consequences.
**Acceptance gates (current):** independent peer review, QA, Security when tenant/auth/payment
impact applies, approved batch CI at exact head, then **E.. CoS** records acceptance when
merging related work to **`dev`**. Legacy `TL-01` / `QA-02` labels in ADR headers are
historical Sprint 0 names only.

## Numbering

Sequential, zero-padded: `ADR-0001`, `ADR-0002`. Never reused.

Use [ADR-TEMPLATE.md](ADR-TEMPLATE.md) for new records.

## Index

| ADR | Title | Status | Legacy owner ID | Sprint |
|---|---|---|---|---|
| [ADR-0001](ADR-0001-restart-on-existing-repository.md) | Restart on existing repository | Accepted | TL-01 | - |
| [ADR-0002](ADR-0002-tenant-model.md) | Tenant model | **Proposed** | TL-01 | Sprint 2 |
| [ADR-0003](ADR-0003-stripe-connect-charge-model.md) | Stripe Connect charge model | **Proposed** | BE-02 / TL-01 | Sprint 8 |
| [ADR-0004](ADR-0004-modular-architecture.md) | Modular architecture over microservices | Accepted | TL-01 | - |
| [ADR-FS-41](ADR-FS-41-renvani-sor-integrations-addendum.md) | Renvani SoR, CSV/import-only, integration non-goals | **Proposed** | Tech Lead | FS-41 |
| [ADR-FS-93](ADR-FS-93-managed-platform-boundaries.md) | Managed platform boundaries (Option A) | **Accepted** (founder); PO + Security ACK pending | Tech Lead | FS-93 |
| [ADR-FS-MIGRATE](ADR-FS-MIGRATE-import-lineage.md) | Import lineage (`source_system`/`source_id`), business timestamps, chunk idempotency | **Accepted** | Tech Lead | FS-MIGRATE |
| [ADR-FS-STACK](ADR-FS-STACK-renvani-official-platform.md) | Official platform stack (Neon, Clerk, Resend, Sentry, PostHog, Langfuse) | **Proposed** | Tech Lead | STACK |
