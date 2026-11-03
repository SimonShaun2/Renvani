# PROJECT_STATE.md

**Repository:** [`SimonShaun2/Renvani`](https://github.com/SimonShaun2/Renvani) (formerly `FSM-Platform`; see `docs/reference/WORKFLOW/repo-canonical.md`)
**Status:** Historical repository baseline and V2 audit snapshot as of 2026-08-21, with 2026-10-20 governance and 2026-10-21 rename annotations. The referenced `MASTER_PRODUCT_SPEC.md` is not present at the verified head.
**Integration branch (operative):** `dev` (protected). **`main`:** founder promotion-only (Shaun).
**Current execution:** Agent-first FS-* [Notion build board](https://app.notion.com/p/74b3a1145d3f49d586ac6cdbf174ceb2) and `TEAM.md` (26 roles). Historical FSM-NNNN statuses and owner IDs below are not current assignments. Map them explicitly before use.
**State owner:** Codex Lead / Technical Lead with Product Owner. Merge authority: founder only, per named PR and exact reviewed head (`TEAM.md` §3–§5).

This file preserves measured repository facts and old audit work. Update verified facts at an approved integration merge; never infer that an old sprint status or automatic progression rule overrides the current board, exact-head gates or founder production authority.

---

## 1. Restart Declaration

**Renvani** (formerly FSM Platform) continues as the single repo for agent-first FS-* work and the optional full FSM suite. Git history is preserved. No new repository is created.

The V1 product boundary — *"Thinner system, smarter brain"* — is **retired**.
The V2 product north star is **"Complete when needed. Simple by default."**

The V1 four-agent model (Agent 1 Backend / Agent 2 Frontend / Agent 3 Infrastructure /
Agent 4 QA) is **retired**. The permanent 26-role team with ten senior developers in five
pairs is defined in `TEAM.md`. See §7 below for the retirement register.

No existing code is presumed correct merely because it exists. Every meaningful component
is classified KEEP / REFACTOR / REPLACE / REMOVE during Sprint 0 before any V2 feature
work begins.

---

## 2. Verified Repository Baseline

Established by direct inspection of `origin/main` on 2026-08-21. These are measured
facts, not reported status. Sprint 0 tickets verify and extend them.

| Property | Value |
|---|---|
| Default branch | `main` |
| HEAD commit | `12b2322` |
| Total commits | 17 |
| Last push to origin | 2026-05-02 |
| Tags present on origin | `v1.0.0`, `v2.0.0` |
| Tags referenced in docs but absent from origin | `v3.0.0` |
| Visibility | Public |

### Applications

| Path | Purpose |
|---|---|
| `apps/api` | Fastify backend, primary API |
| `apps/web` | Next.js 14 App Router frontend |
| `apps/worker` | BullMQ background processor |
| `apps/webhook` | Inbound webhook receiver |

### Packages

| Path | Purpose |
|---|---|
| `packages/db` | Drizzle schema, migrations |
| `packages/types` | Shared TypeScript types and Zod schemas |
| `packages/ai` | OpenAI prompts and AI service functions |
| `packages/jobs` | BullMQ queue definitions |
| `packages/config` | Env validation, constants |

### Measured Inventory

| Metric | Count |
|---|---|
| API route groups under `apps/api/src/routes/` | 26 |
| Files under `apps/api/src/services/` | 48 |
| Test files (`*.test.ts` / `*.test.tsx`) | 42 |
| Frontend `page.tsx` routes under `apps/web/app/` | ~40 |
| Tables in `packages/db/src/schema.ts` | 38 |
| Tables in root `fsm-schema.ts` | 35 |

### Commit History Reference

```
12b2322  docs: add all tickets, planning files, schema, deployment guide
d7c1dfd  TICKET-033: AI Dispatch Intelligence
96ee91c  TICKET-032: CSV Import Wizard UI
869658b  Phase 2 tickets 020-027: booking, product catalog, service agreements
c2f9999  TICKET-019: Estimates + Invoices
0c67de9  TICKET-018: Job Detail
5e08954  TICKET-017: Customer + Property + Asset Screens
9d8f722  TICKET-016: Dispatch Board
a0db1de  TICKET-015: Dashboard + AI Revenue Center
0dcdea4  TICKET-014a: Product Catalog + Job Tasks/Products API
942ccda  TICKET-014: Design System + Layout Shell
57a87fc  Phase 1C complete: TICKETS 010-013
66a7efe  Add campaign service read-path coverage
0511fd0  Sync FSM platform progress through TICKET-012
051ac11  Ignore generated package source artifacts
86bace7  Build FSM platform monorepo foundation
5c00cf1  Initial commit
```

---

## 3. Confirmed Baseline Defects

These were found during PM inspection and are pre-seeded into the Sprint 0 audit as
**verified findings**. Owning tickets must confirm and remediate, not rediscover.

### BD-001 — Schema drift between agent context file and real schema
**Severity:** High · **Owner:** BE-01 · **Ticket:** FSM-0004

Root `fsm-schema.ts` (1,510 lines, 35 tables) is the file handed to every build session as
context. The real schema at `packages/db/src/schema.ts` is 1,644 lines and 38 tables.
Three tables exist in the real schema but are **absent from the context file**:

- `refresh_tokens`
- `booking_settings`
- `booking_requests`

`booking_requests` carries the two-field SMS consent structure that has previously
regressed. Any engineer briefed from the root file is working blind on authentication
token storage and the entire booking domain.

**Resolution requirement:** one schema, one source of truth. The duplicate must be
eliminated, not synchronised.

### BD-002 — Documented milestones not tagged on origin
**Severity:** Medium · **Owner:** DO-01 · **Ticket:** FSM-0001

`docs/README.md` marks Phase 1 as `v1.0.0` complete and Phase 3 as `v3.0.0` complete.
`v1.0.0` has now been restored on commit `57a87fc`. `v3.0.0` does not exist on origin
because Phase 3 is not fully represented in committed history.

### BD-003 — Local/remote divergence of unknown size
**Severity:** High · **Owner:** DO-01 · **Ticket:** FSM-0001

Last push to origin was 2026-05-02, roughly 3.5 months before restart. Local builds were
never configured to auto-push. `docs/planning/PHASE3-REMAINING-TICKETS.md` names
"TICKET-034 APPROVED" as a prerequisite, but no TICKET-034 commit exists on `main` —
confirming at minimum one approved unit of work exists only on the local machine.

**This is the hard gate on Sprint 0.** Auditing a stale remote produces a worthless
baseline. FSM-0001 blocks every other Sprint 0 ticket.

### BD-004 — Governance documents describe non-existent structure
**Severity:** Medium · **Owner:** TL-01 · **Ticket:** FSM-0002

`AGENTS.md` documents `/packages/ui` as part of the monorepo. That package does not exist
on disk. The same file documents the schema path as `/packages/db/schema.ts`; the actual
path is `/packages/db/src/schema.ts`.

### BD-005 — Test file misplaced in route directory
**Severity:** Low · **Owner:** QA-01 · **Ticket:** FSM-0003

`apps/api/src/routes/phase2-operations.test.ts` sits at the route-group level rather than
inside a route module, breaking the established `routes/<domain>/` convention.

### BD-006 — Legacy governance contradicts the V2 operating model
**Severity:** High · **Owner:** TL-01 · **Ticket:** FSM-0002

Historical finding at the 2026-08-21 baseline: `AGENTS.md` and `CODEX.md` encoded the retired four-agent model and Agent 4 gate. The draft governance correction on PR #1 replaces these with the founder's 26-role agent-first team and exact-head batch gate. Its branch/base and CI enforcement remain unresolved; do not treat the draft as merged policy on `main`.

---

## 4. Sprint Status

| Sprint | Title | Status |
|---|---|---|
| 0 | Existing Repository Audit and Rebaseline | **ACTIVE** |
| 1 | Architecture, Developer Platform, CI/CD, Design System | Blocked on Sprint 0 |
| 2–22 | See `SPRINT_ROADMAP.md` | Not started |

---

## 5. Sprint 0 Ticket Status

| Ticket | Title | Owner | Status |
|---|---|---|---|
| FSM-0001 | Repository Reconciliation and Baseline Tagging | DO-01 | Ready |
| FSM-0002 | Governance Rewrite and Legacy Retirement | TL-01 | Blocked (FSM-0001) |
| FSM-0003 | Backend Code and Route Inventory | BE-01 | Blocked (FSM-0001) |
| FSM-0004 | Database Schema Inventory and Reconciliation | BE-02 | Blocked (FSM-0001) |
| FSM-0005 | Frontend Inventory and Classification | FE-01 | Blocked (FSM-0001) |
| FSM-0006 | Worker, Queue and Integration Inventory | FS-02 | Blocked (FSM-0001) |
| FSM-0007 | Test Suite Baseline and Coverage Report | QA-01 | Blocked (FSM-0001) |
| FSM-0008 | Dependency, License and Vulnerability Audit | DO-02 | Blocked (FSM-0001) |
| FSM-0009 | Security and Tenant Isolation Posture Review | QA-02 | Blocked (FSM-0003, FSM-0004) |
| FSM-0010 | CI/CD and Environment State Assessment | DO-01 | Blocked (FSM-0001) |
| FSM-0011 | Domain Model Gap Analysis | TL-01 | Blocked (FSM-0004) |
| FSM-0012 | Consolidated Audit Report and Rebaseline Decision | TL-01 | Blocked (FSM-0003…0011) |
| FSM-0013 | GitHub Project Infrastructure | DO-01 | Ready |
| FSM-0014 | ADR Process Bootstrap | TL-01 | Ready |

---

## 6. Open Founder-Blocking Items

Per master directive §41, the team proceeds autonomously except where genuinely blocked.
Currently blocking:

| Item | Needed from | Blocks |
|---|---|---|
| Confirmation that local working tree may be pushed to `origin/main` | Founder | FSM-0001 |
| Stripe Connect charge-model decision inputs (merchant of record, dispute liability) | Founder / legal | Sprint 8, ADR-0003 |
| Production credentials for Railway, Stripe, Twilio, SendGrid, OpenAI, R2 | Founder | Sprint 1, Sprint 20 |

Nothing else requires founder input. Ordinary ticket execution does not pause for approval.

---

## 7. Retirement Register

Explicitly retired by this restart. Any document still asserting these is stale and must
be corrected under FSM-0002.

| Retired | Replaced by |
|---|---|
| "Thinner system, smarter brain" north star | "Complete when needed. Simple by default." |
| Agent 1 / Agent 2 / Agent 3 / Agent 4 model | 26 permanent roles, ten senior developers in five pairs, `TEAM.md` |
| Agent 4 sole-approval gate | Actual independent peer review, QA, Security-by-risk, approved batch CI, and founder-only merge approval into `dev` — `TEAM.md` §3 |
| Phase 1A / 1B / 1C / Phase 2 / Phase 3 roadmap | Current agent-first FS board; historical full-suite plan deferred |
| `TICKET-NNN` identifiers | Current FS-* board IDs; historical FSM-NNNN issues require mapping |
| "v1 / v2 deferral" scope language | Sprint assignment and progressive disclosure |
| Founder approval between routine tickets | Bounded Codex Lead / Technical Lead loop within WIP; founder approves every PR merge and retains production and exceptional authority |
