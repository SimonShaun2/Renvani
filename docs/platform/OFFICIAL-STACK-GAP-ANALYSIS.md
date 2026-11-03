# Gap analysis — official stack vs current `dev`

**Canonical spec:** [OFFICIAL-OPERATIONAL-STACK.md](../OFFICIAL-OPERATIONAL-STACK.md) (founder-approved, verbatim)  
**Engineering ADR:** [ADR-FS-STACK](../adr/ADR-FS-STACK-renvani-official-platform.md)  
**Target date:** winter **migration-ready 2026-12-05 CT** · field-ready **2026-12-12 CT** (`MVP-SHORTEST-PATH-WINTER-2026.md`)  
**FS-MIGRATE M1:** **not blocked** — presets (#92) use existing Postgres + worker paths until Neon dev is wired.

---

## Founder sequencing notes (approved — include in tickets)

1. **Twilio A2P 10DLC** — US SMS compliance registration has **days–weeks lead time**. List on Shaun’s account checklist as **early action** (before prod SMS); engineering stays on **sandbox** until approved.
2. **Stripe** — **Billing first** for MVP platform **subscriptions**; **Connect** (merchant onboarding / tenant payouts) **after** Billing unless Elena flags an MVP flow that **requires Connect by 2026-12-05** (e.g. live customer invoice pay on staging).
3. **Clerk + PostgreSQL RLS** — Pass **org/tenant context into every DB session** (e.g. `SET LOCAL` / pool hook with `company_id` from Clerk org mapping). **Sam:** automated **cross-tenant denial tests from day one** in CI (extends FS-92), not a post-RLS afterthought.
4. **Neon** — Region **co-located with Render API** service region (latency + compliance). Use Neon **per-PR branches** for preview/CI database isolation where `batch-ci` allows.
5. **Company tools** — **HubSpot free tier** until real sales pipeline justifies paid CRM. Note **ChatGPT Pro** vs **Cursor Ultra** overlap under MVP opex policy (founder chooses; no duplicate AI subs without justification).

---

## Summary matrix

| Official layer | Target | Current repo / docs | Gap severity | Ticket |
| --- | --- | --- | --- | --- |
| **Neon PostgreSQL** | Neon; **same region as Render API**; **per-PR branches** | Generic `DATABASE_URL`; ADR-FS-93 **Render Postgres** | **High** | STACK-01, STACK-11 |
| **Clerk** | Staff auth, org mgmt | In-house JWT + `refresh_tokens`; `apps/api/src/plugins/authenticate.ts`; FS-84 | **High** | STACK-02, STACK-03 |
| **PostgreSQL RLS** | RLS + session `company_id` from Clerk | App-layer filters only; no session context hook; no RLS policies | **High** | STACK-10, STACK-02 |
| **Render + Vercel deploy** | Official hosts; env separation | `PRODUCTION-DEPLOYMENT.md`, FS-93 runbook; mixed Railway wording | **Med** | STACK-11, STACK-12 |
| **Render Key Value / BullMQ** | Queues on Redis-compatible store | **Implemented** — `@fsm/jobs`, workers; needs prod Key Value + monitoring | **Med** | STACK-05, Hana queue hardening |
| **Cloudflare R2** | File storage | R2 adapter in repo; buckets = founder | **Low** | STACK-06 |
| **Sentry / PostHog** | Errors + product analytics | `pino` only; no SDK wiring | **Med** | STACK-04 |
| **Langfuse** | AI traces + eval | OpenAI in `@fsm/ai`; partial token logging; no Langfuse | **Med** | STACK-07 |
| **Stripe Billing** | MVP platform subscriptions (**first**) | FS-94 deferred; limited Billing in code | **High** | STACK-13 (P0) |
| **Stripe Connect** | Tenant payouts (**after Billing**) | Connect in schema/webhooks; test-oriented | **Med** | STACK-14 (P1 unless 12-05 flow needs) |
| **Resend** | Email | **SendGrid** adapter + `SENDGRID_*` env | **Med** | STACK-08 |
| **Twilio** | SMS sandbox until prod | Twilio adapter; sandbox not documented per env | **Low** | STACK-08 |
| **Agent control plane** | Approvals, audit | `agent_actions`, FS-72 policy PRs; aligns with stack §5 | **Low** | FS-72 / Noah runtime |
| **Staging environment** | Isolated staging stack | Partial docs (`environment-boundary-matrix`); not fully provisioned | **High** | STACK-11 |
| **Automated security tests** | CI tenant matrix | FS-92, FS-85, Sofia migrate tests — extend for Clerk/RLS | **Med** | STACK-03, STACK-10 |

---

## Code touchpoints (conflicts)

| Path | Today | Action |
| --- | --- | --- |
| `packages/config/src/env.ts` | `JWT_*`, `SENDGRID_*`, `DATABASE_URL` | Add Clerk/Resend/Langfuse/Sentry/PostHog env validation when wiring PRs land |
| `apps/api/src/lib/tokens.ts`, `plugins/authenticate.ts` | JWT verify | Clerk middleware + mapping; flag-gated (STACK-02) |
| `apps/api/src/lib/email.ts` (or equivalent) | SendGrid | Resend adapter (STACK-08) |
| `packages/db/src` connection layer | No `SET LOCAL app.company_id` (or equivalent) | Session tenant context hook with Clerk org (STACK-02 + STACK-10) |
| `packages/db/migrations/*` | No RLS policies | RLS policies keyed on session `company_id` (STACK-10) — Neon staging target |
| `docs/adr/ADR-FS-93-managed-platform-boundaries.md` | Render Postgres, JWT | **Partially superseded** by official stack + ADR-FS-STACK |
| `AGENTS.md` | Railway deploy, SendGrid, JWT auth | STACK-00 reconcile post-ADR Accept |

---

## Sequencing vs FS-MIGRATE M1

| Work | May proceed on current `DATABASE_URL` | Requires Shaun credentials |
| --- | --- | --- |
| **#92** preset catalog, worker map job | **Yes** | No |
| **#96** 0026 lineage schema | **Yes** (local/CI Postgres) | No |
| Neon cutover | No | Neon connection strings |
| Clerk dev | Parallel only | Clerk dev app |
| RLS policies | No (needs Neon staging target) | Neon staging |
| Sentry/PostHog/Langfuse | Optional in dev | API keys |

---

## Accounts Shaun must create (engineering does not)

**Infrastructure & product (layers 1–5)**

| Service | Purpose |
| --- | --- |
| Vercel | `apps/web`, previews, production |
| Render | API, worker, webhook, **Key Value** |
| Neon | PostgreSQL dev / staging / prod |
| Clerk | Auth, organizations → `companyId` |
| Cloudflare | R2 buckets per env |
| Sentry | api, web, worker projects |
| PostHog | Product analytics (also layer 8) |
| Langfuse | AI tracing and eval |
| Stripe | **Billing first** (MVP subscriptions, test mode); **Connect later** unless PO escalates 12-05 need; live keys founder-only |
| Resend | Transactional email |
| Twilio | Account + **sandbox**; **A2P 10DLC registration — start early** (weeks lead time) |
| OpenAI | Model API (usage monitoring per MVP policy) |

**Company & GTM (layers 7–8 — founder ops, not app deploy)**

| Service | Purpose |
| --- | --- |
| Notion | PO / planning |
| Google Workspace | Company email, support inbox |
| HubSpot CRM | **Free tier** until pipeline warrants paid |
| GitHub | Repo (existing) |
| Figma | Design |
| Cursor Ultra | Engineering — note overlap with **ChatGPT Pro** (founder: one or both per MVP opex policy) |
| ChatGPT Pro | Company ops — overlap with Cursor; no redundant spend without justification |

Credentials flow: Shaun → Render/Vercel secret stores only; never committed.
