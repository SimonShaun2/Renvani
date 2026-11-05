# AGENTS.md

> **FOUNDER EXECUTION & MERGE AUTHORITY — NOVEMBER 3, 2026 (current).** See [founder directive #420](https://github.com/SimonShaun2/Renvani/issues/420). **Codex is the active builder and coordinator. No E.. CoS approval, dispatch, CI authorization, review recommendation, or signature is required for any ticket or PR.** GrokBot/E.. CoS is optional advice when the founder independently chooses to use it; never a gate. Codex Lead/Technical Lead and actual Platform owners coordinate Ready/WIP and authorize appropriately scoped CI batches; independent Peer, QA, and Security-by-risk reviews with exact-head evidence remain mandatory. **The founder alone approves EVERY outstanding and future PR merge**, including `dev`, by named PR and exact reviewed head. Compatible PRs may be reviewed and validated in batches, then merged sequentially only after explicit founder approvals; no unsafe big-bang merge. Continue authorized Phase A work without stopping for idle roles or blocked PRs. No Phase B before original Phase A acceptance and founder permission. Preserve genuine security, tenant, consent, migration and release gates. Reuse existing credentials when appropriate, but never claim unproven least privilege or rotation/revocation PASS.

# FSM Platform V2 — Controlling Operating Document

## Founder-required Renvani Figma parity — applies to ALL UI work

**Renvani is the only current product identity.** The single authoritative design file for operator, field, customer and marketing UI is [FSM Agent – Product Design](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-%E2%80%93-Product-Design). Follow [docs/design/RENVANI_FIGMA_PARITY.md](docs/design/RENVANI_FIGMA_PARITY.md) and [founder tracker #433](https://github.com/SimonShaun2/Renvani/issues/433).

**Before writing UI code:** locate and inspect the **exact Figma nodes** for that route (not merely a file/prototype link), including desktop, tablet, mobile and error/loading/empty states as applicable. Implement with actual components, Clerk/session rules, domain services and tenant policies. The prototype's sample data is not real app data.

**Before calling any UI work Done or merge-ready:** compare screenshots of the real deployed browser UI at the reviewed head against those Figma frames at each applicable breakpoint, record discrepancies and explicit independent Design/Product and QA acceptance, and attach evidence to the PR. **Green CI and a pasted Figma URL alone are not a design pass.** Existing legacy styling cannot silently override the canonical designs. No retired brand/customer-facing copy or links in current application UI. Preserve compatibility when touching historical data identifiers. Founder alone approves merge after all required gates.



**This file governs how every team member operates in this repository. Read it in full
before changing anything.**

**Version:** 2.0 — supersedes all prior versions of this file.
**Authority:** Founder agent-first FSM direction recorded 2026-10-20 in the [Notion build HQ](https://app.notion.com/p/3ff317b92d1581df8eb5f7353616f529). The referenced `MASTER_PRODUCT_SPEC.md` is not present at the verified repository head. Until reconciled, use the founder's current direction and `TEAM.md` for team/process, and preserve existing engineering safety rules. Escalate any material product contradiction to Product Owner and founder.

---

## 0. What Changed in V2 — Read This First

If you have prior context on this repository, the following is **retired**. Do not act on it.

| Retired | Replaced by |
|---|---|
| "Thinner system, smarter brain" | **"Complete when needed. Simple by default."** |
| Agent 1 / 2 / 3 / 4 model | 26 permanent role-named agents; ten senior developers in five pairs — `TEAM.md` |
| Agent 4 sole-approval gate | Actual independent peer review, QA, Security-by-risk, approved batch CI, and founder-only merge approval into `dev` — `TEAM.md` §3 |
| Phase 1A / 1B / 1C / 2 / 3 | Agent-first FS board now; historical full-suite sprints are deferred |
| `TICKET-NNN` | FS-* board tickets now; legacy `FSM-NNNN` issues require explicit mapping |
| "That's v2" as a scope refusal | Product Owner sequences the current agent-first loop and later suite by evidence |
| Founder approval between routine tickets | Autonomous operating loop — `TEAM.md` §5; founder retains production and exceptional authority |

The engineering principles in §5 below are **retained from V1** and remain repo law.
They were sound. The team structure and product boundary around them were not.

---

## 1. What This Product Is

An agent-first field-service growth and operations product for service businesses. The existing FSM codebase is its substrate. A full FSM software suite is a later optional offering, not the first build milestone.

Current first loop: **direct inquiry → qualification → draft/approval → booking or estimate → service handoff → follow-up → measured direct job**. The full FSM lifecycle remains a future product capability and should not force early rollout of every module.

It must serve, from one codebase and without an architectural rebuild:

1. A single owner-operator
2. Small field service companies
3. Growing multi-crew organisations
4. Organisations of roughly 50 operating units, technicians, crews or vehicles
5. Multi-location businesses
6. Larger organisations

This is production software. Not a prototype. Not a demo. Every feature must work in
production.

---

## 2. Product North Star

> **Complete when needed. Simple by default.**

The platform may become functionally deep. The interface must not *feel* deep unless the
user needs that depth. A one-person plumbing company must not feel like it is operating
enterprise software. A 50-unit operation must not feel like it has outgrown small-business
software. Both run the same platform.

### Primary differentiator: Complexity On Demand

Advanced capability appears when the company enables it, the user's role requires it, the
workflow requires it, or the organisation reaches additional operational complexity.

Do not solve feature growth by adding permanent navigation items. Use role-based
interfaces, feature modules, contextual actions, command/search, saved workspaces,
configurable dashboards, permission-based navigation, progressive configuration, smart
defaults, and industry templates.

### Scope test

The V1 test — *"does this make the system thicker without making the brain smarter?"* — is
retired. It caused correct features to be rejected.

The current scope test is: **does this strengthen an operator-approved, measurable direct-job loop without adding default-path complexity?**
Additional FSM capability is sequenced on the board and introduced only when validated for the current product phase. Do not treat an old sprint assignment as authorization to implement it now.

---

## 3. UX Is an Engineering Requirement

Ease of use is a product requirement, not decoration. Two surfaces receive first-class
attention: the **office experience** (scheduling, dispatch, CRM, estimates, invoicing,
communications, reporting) and the **field worker experience** (today's work, job info,
navigation, history, status, photos, forms, time, materials, estimates, invoices,
signatures, payments, completion).

### Office UX

Dispatchers may touch the system hundreds of times a day. Optimise for speed: fast job
creation and customer lookup, drag-and-drop scheduling, fast rescheduling, keyboard
navigation, bulk operations, context menus, inline editing, persistent filters, saved
views, global search, minimal modal dependency, safe autosave, real-time schedule updates,
clear conflict and availability indicators, clear unscheduled and priority queues, and no
unnecessary page navigation.

### Field UX

Assume the technician is wearing gloves, outdoors, on poor cellular service, moving between
jobs, and not technically sophisticated. They should not need to understand the office
software.

Ideal primary flow:

```
Open App → See Next Job → Navigate → On My Way → Arrive → Start
        → Perform Work → Document → Present Options → Capture Approval
        → Complete → Take Payment → Next Job
```

Avoid deep nesting. Never require the same information twice. Large touch targets for core
status actions. Offline and unstable-network behaviour is designed deliberately, not
discovered in the field.

### Measured UX

Design and engineering actively reduce: task completion time, interaction count, navigation
depth, error frequency, training required, mobile completion time, user backtracking, and
duplicate entry.

---

## 4. Non-Negotiable Core Principles

1. **Backend owns all business logic.** No business logic in the frontend. Ever.
2. **Every state change emits an activity event.** No exceptions.
3. **Money remains controlled.** Existing payment behavior follows its Stripe/webhook boundaries. New Stripe and live-payment work is deferred to the end and requires separate founder authority.
4. **Background workers handle async work.** No long-running operations in request handlers.
5. **Multi-tenant by default.** Every query scoped to the tenant. No cross-tenant leakage.
6. **TypeScript strict everywhere.** No `any`. No `@ts-ignore`.
7. **Zod validates all inputs.** Bodies, params, env vars — validated at the boundary.
8. **Errors are explicit.** No silent failures. No swallowed exceptions.
9. **AI recommends; deterministic services decide.** AI never owns financial state, payment
   state, job completion state, or permissions. AI outputs never silently change
   authoritative state.

---

## 5. Engineering Principles (Retained — Repo Law)

The software must be maintainable, extensible, and safe to iterate on. We must be able to
fix bugs, change workflows, add fields, add modules and extend features without rewriting
large parts of the system.

**1. Modular domain services.** Each domain has its own service boundary. One feature must
not require editing unrelated domains. Domain services own their data and do not reach into
another service's internals. Cross-domain needs go through explicit service calls or events.

**2. Thin route handlers.** A handler does exactly four things: validate input, read auth
and tenant context, call a service function, return a response. No database queries, no
business logic, no business-rule branching in handlers.

**3. Event-driven state changes.** Every meaningful state change emits an activity event.
AI, notifications, analytics and automations subscribe to events rather than being hardcoded
into core workflows. New consumers are additive and do not modify the emitter.

**4. Background jobs for async work.** Anything over ~100ms or calling an external API
belongs in a worker. Workers are idempotent and safe to retry.

**5. Stable domain models.** Entities are modelled on the real FSM domain, not on the
current UI. Shortcut schemas that only support today's screen are not acceptable. Extend
the model cleanly rather than hacking around it.

**6. Replaceable integrations.** Stripe, Twilio, SendGrid, OpenAI and R2 are wrapped in
adapters. Vendor calls are isolated to adapter files. A vendor change touches the adapter
only.

**7. Typed contracts.** Strict TypeScript and shared Zod schemas define all API inputs and
outputs. Frontend calls typed clients and never duplicates backend logic. Shared types live
in `@fsm/types`. Response shapes are explicit, not inferred from database rows.

**8. Small, testable units.** Every service function is testable without standing up the
whole application. A function that is hard to test is doing too much.

**9. No hidden coupling.** Frontend components never depend on database row shapes. Modules
do not reach into each other. Two services needing the same data share a type, not a query.

**10. Feature flags for staged rollout.** New AI behaviour, automation, payment logic and
dispatch experiments must be enable-able and disable-able without breaking the system. Flag
toggles never require a migration.

**11. Modular architecture, not microservices.** Strong domain boundaries without
operational complexity for its own sake. Split infrastructure only where independent
scaling, security or failure isolation justifies it.

---

## 6. Technology Baseline

Treat as the starting architecture. This is **not** permission to rewrite the stack.

| Layer | Technology |
|---|---|
| Frontend | Next.js (App Router) + React |
| Backend API | Node.js + Fastify |
| Database | PostgreSQL + Drizzle ORM |
| Background jobs | Redis + BullMQ |
| Payments | Stripe (Connect, Terminal) |
| SMS | Twilio |
| Email | SendGrid |
| AI | OpenAI |
| File storage | Cloudflare R2 |
| Package manager | pnpm workspaces |
| Language | TypeScript (strict) |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| Deployment | Railway |

Stack changes require an ADR from the Technical Lead showing: problem, current approach, proposed
approach, benefit, migration cost, operational impact, security impact, alternatives
considered, decision. See `docs/adr/`.

---

## 7. Repository Structure

```
/apps
  /web       → Next.js frontend
  /api       → Fastify backend
  /worker    → BullMQ background processor
  /webhook   → Inbound webhook receiver

/packages
  /db        → Drizzle schema (src/schema.ts), migrations, seeds
  /types     → Shared TypeScript types and Zod schemas
  /ai        → Prompts and AI service functions
  /jobs      → BullMQ queue definitions
  /config    → Env validation, constants, feature flags

/docs
  /adr       → Architecture Decision Records
/tickets     → FSM-NNNN implementation tickets + INDEX.md
```

The authoritative schema is **`packages/db/src/schema.ts`** and nothing else. Any duplicate
schema file elsewhere in the repository is a defect — see `PROJECT_STATE.md` BD-001.

Internal packages import as `@fsm/db`, `@fsm/types`, `@fsm/ai`, `@fsm/jobs`, `@fsm/config`.

---

## 8. Data Rules

- All tables carry `id` (UUID), tenant scope, `createdAt`, `updatedAt`, `deletedAt`.
- All deletes are soft deletes. Never `DELETE FROM` in application code.
- Every query filters by tenant, enforced in the service layer, never the route layer.
- Migrations are generated by `drizzle-kit`. Never hand-edit an applied migration.
- Transactions wrap any operation writing to more than one table.
- `activity_events` receives an insert on every meaningful state change.
- Monetary values are stored and transported as strings. Never parse money to float.

---

## 9. Money Is Never One Number

These are separate, independently auditable concepts. Never collapse them into a single
ambiguous percentage:

1. Stripe processing cost
2. Business card surcharge
3. FSM Platform application fee
4. FSM Platform subscription price
5. Business invoice total
6. Tax
7. Tips
8. Membership charges

**Card surcharging is OFF by default.** Where a business enables it, the engine computes the
*lowest permitted amount* under all applicable constraints — card type, network, payment
method, merchant cost of acceptance, network cap, jurisdiction, provider rules, disclosure
requirements, and debit/credit classification. A business configuring 5% must never produce
an illegal or network-prohibited 5% surcharge. Debit is not credit. Do not invent loopholes
around network rules. Every surcharge decision writes an audit trail: configured
percentage, permitted percentage, applied percentage, dollar amount, card classification,
rule version, jurisdiction, disclosure version, transaction ID.

---

## 10. Security

Tenant isolation · role-based access · least privilege · secure authentication · token
security · MFA readiness · rate limiting · encryption · secrets management · webhook
signature verification · payment security · input validation · audit trails · secure file
uploads · malware considerations · dependency scanning · session management · data export
controls · support impersonation auditing. Sensitive actions require explicit authorisation.

---

## 11. Accessibility

Target WCAG 2.2 AA where practical. Accessibility belongs to the design system: keyboard
support, focus management, contrast, readable typography, accessible forms, clear error
messages, adequate touch targets, screen reader semantics.

---

## 12. Performance

The product must feel fast. Performance budgets are defined and enforced for page
navigation, customer search, dispatch board, schedule interaction, job opening, mobile job
data, payment initiation, critical API endpoints, search and reporting. Added features must
not gradually degrade basic FSM workflows.

---

## 13. Observability

Every production-critical service has structured logs, correlation IDs, error tracking,
health checks, metrics, alerting, and monitoring for queues, webhooks, payments, database,
latency and deployments. Failed automations are visible. Integration status is visible.
Diagnosing a production problem must not require guessing.

---

## 14. How Work Flows

Read `TEAM.md` for roles, tandem process, WIP and exact-head gates. The Notion Field Service Build Board governs FS-* priority; `SPRINT_ROADMAP.md` and `tickets/INDEX.md` are legacy references. Integration branch: **`dev`** (founder final merge approval for each PR). **`main`:** founder promotion-only. Every change on a draft PR; CI only in an approved batch; a new commit invalidates sign-offs. Never merge to `dev` or mark Done without peer review, QA, Security-as-risk, batch CI, and explicit founder approval for the named PR and exact head.

---

## Cursor Cloud specific instructions

The Cloud Agent `start` script boots local Postgres, Redis, migrations, a browser API proxy, and `pnpm dev`. The API, worker, and webhook do not load a `.env` file. `start` exports the required variables. Provider values are local placeholders that satisfy Zod. They are not live Stripe, Twilio, SendGrid, OpenAI, or R2 credentials.

- Node.js 20 or newer. Package manager is pnpm 10.0.0, from the `packageManager` field, via `corepack prepare pnpm@10.0.0 --activate`.
- Postgres 16 listens on `127.0.0.1:5432`. Database `fsm`, role `fsm`, password `fsm`. Start it with `sudo pg_ctlcluster 16 main start`. `policy-rc.d` blocks `service postgresql start`.
- Redis listens on `127.0.0.1:6379`. Start it with `redis-server --daemonize yes` when the service helper is blocked the same way.
- `pnpm --filter @fsm/db db:migrate` fails: drizzle-kit requires `packages/config/src/env.js`, and TypeScript emits that module to `dist` instead. Apply `packages/db/migrations` with the drizzle-orm migrator. `start` does this.
- Web UI: `http://localhost:3000`. The API process listens on port 3010. The browser calls `http://localhost:3001` (`NEXT_PUBLIC_API_URL`). A local proxy on 3001 forwards to 3010 and adds CORS for `http://localhost:3000`, because the API does not send CORS headers. Webhook: port 3002. The worker has no port.
- `pnpm dev` builds `@fsm/config`, `@fsm/types`, `@fsm/db`, `@fsm/jobs`, and `@fsm/ai`, then runs the API, worker, webhook, and web app.
- The signup page is still a placeholder. Create the first company with `POST /api/v1/auth/register`, then sign in at `/login`.
- Checks: `pnpm lint` and `pnpm test`. `pnpm build` compiles the workspace, including the Next.js app.


## November 5, 2026 — FSM continuity marker for Codex and Cursor

For the six completed but **unmerged** FSM workflow packages WF-01–WF-06, start with [`docs/handoffs/RENVANI-FSM-CODEX-CURSOR-START-HERE-2026-11-05.md`](docs/handoffs/RENVANI-FSM-CODEX-CURSOR-START-HERE-2026-11-05.md), [the completion record](docs/build-specs/FSM-WORKFLOW-COMPLETION-2026-11-05.md), and [PR #445](https://github.com/SimonShaun2/Renvani/pull/445). The code lives on `feat/fsm-workflow-reliability-20261105`, **not** merged `dev`. Do not rebuild completed features. Next: approved exact-head verification, authenticated preview and independent review. This pointer does not override any founder/merge/security/Phase II rule above.
