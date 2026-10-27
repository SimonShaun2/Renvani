# FS-41 — Repository package boundaries and local developer contract

**Batch:** BATCH-FS4-GROWTH-003  
**Ticket:** FS-41  
**Base SHA:** `7f1e6328e1a5ba54c7477b0cce0496502235f1e0` (`dev`)  
**Status:** Proposed — **PO + Security ACK required** before Ready  
**Authority:** Complements [ADR-0004](../adr/ADR-0004-modular-architecture.md) and [ADR-FS-41](../adr/ADR-FS-41-renvani-sor-integrations-addendum.md).

---

## 1. Purpose

Define **allowed dependency directions**, **package purposes**, and a **local-only developer contract** (test data, no production credentials, no live provider calls in default local workflows). Disputed boundaries are listed for Tech Lead resolution — do not bypass via cross-imports.

---

## 2. Package purposes

| Package / app | Purpose | May import |
| --- | --- | --- |
| `@fsm/config` | Zod-validated `env`, feature flags, storage constants | Node/stdlib only |
| `@fsm/types` | Shared TS types, Zod schemas, `ErrorCode`, agent-control-plane contracts | `zod` only (no `@fsm/db`) |
| `@fsm/db` | Drizzle schema, migrations, `db` client, `emitEvent*` | `@fsm/config` |
| `@fsm/jobs` | BullMQ queue names + enqueue helpers | `@fsm/config`, Redis client libs |
| `@fsm/ai` | OpenAI prompts + AI service functions (no HTTP routes) | `@fsm/config` |
| `@fsm/api` | Fastify HTTP API — thin routes, service layer owns logic | `@fsm/*` packages; **not** `@fsm/web` |
| `@fsm/web` | Next.js UI — server/client components, API client only | `@fsm/types`, `@fsm/config` public env; **never** `@fsm/db` |
| `@fsm/worker` | BullMQ processors — async jobs, calls services/DB | `@fsm/db`, `@fsm/jobs`, `@fsm/ai`, `@fsm/types`, `@fsm/config` |
| `@fsm/webhook` | Inbound Stripe/Twilio webhooks — verify + enqueue/hand off | `@fsm/db`, `@fsm/jobs`, `@fsm/config` |

**Note:** `@fsm/ui` is reserved in `AGENTS.md` but **not present** at base `7f1e632`; do not add shared UI package without ADR.

---

## 3. Import direction rules (normative)

```text
apps/*  →  packages/*  (one direction)
packages/types  →  (no internal @fsm/* except self)
packages/config →  (no internal @fsm/*)
packages/db     →  @fsm/config
packages/jobs   →  @fsm/config
packages/ai     →  @fsm/config
packages/*      →  MUST NOT import apps/*
```

- **Business logic** lives in `apps/api/src/services/` (and worker processors calling the same patterns). Routes: validate → auth context → service → response.
- **Cross-domain** needs: call another domain’s **service function** or emit `activity_events` — no reaching into another service’s SQL.
- **Frontend** never imports database row types as API contracts; use `@fsm/types` + route Zod schemas mirrored in handlers.

### Disputed / watch boundaries (resolve via ADR or FS-41 amendment)

| Edge | Rule |
| --- | --- |
| API route `schemas.ts` vs `@fsm/types` | Request/response Zod in route `schemas.ts`; shared shapes exported from `@fsm/types` when used by web + API |
| Worker vs API duplication | Worker imports services from API only if extracted to shared module — **today** worker duplicates service access via `@fsm/db`; new shared logic → `packages/types` + service file ownership in API with worker calling extracted function |
| `@fsm/ai` calling DB | **Forbidden** — worker/API loads context and passes DTOs into AI package |

---

## 4. TypeScript and Zod-at-boundary contract

| Boundary | Requirement |
| --- | --- |
| All packages/apps | `"strict": true` in `tsconfig`; no `any`, no `@ts-ignore` |
| Process startup | `packages/config/src/env.ts` — **Zod** `envSchema`; crash if invalid |
| API routes | Zod in `routes/**/schemas.ts`; handlers use parsed types only |
| Worker job payloads | Zod parse at processor entry (or typed envelope from `@fsm/types`) |
| Web forms | Zod + shared types where applicable; no business rules in components |

**Local contract artifact:** environment shape is defined only by `envSchema` — local `.env` must satisfy it with **non-production** placeholders (see §5).

---

## 5. Local setup (test data — no production credentials)

### 5.1 Prerequisites

- Node.js **20+**, **pnpm** 10 (see root `packageManager`)
- **PostgreSQL** and **Redis** running locally (or reachable dev instances dedicated to you — not shared production)

### 5.2 Environment

1. `cp .env.example .env`
2. Use **local-only placeholders** (same class as API test bootstrap — see `apps/api/src/test-support/env-setup.ts`). Example:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5432/renvani_dev
REDIS_URL=redis://localhost:6379
STRIPE_SECRET_KEY=sk_test_local_only
STRIPE_WEBHOOK_SECRET=whsec_local_only
STRIPE_CONNECT_CLIENT_ID=ca_test_local_only
STRIPE_PLATFORM_FEE_PERCENT=0.02  # legacy, not customer-facing (Service Fee = SERVICE_FEE_RATE_BPS)
OPENAI_API_KEY=openai_local_only
TWILIO_ACCOUNT_SID=AC_local_only
TWILIO_AUTH_TOKEN=twilio_local_only
TWILIO_FROM_NUMBER=+15555550100
SENDGRID_API_KEY=SG.local_only
SENDGRID_FROM_EMAIL=dev@localhost.test
R2_ACCOUNT_ID=local
R2_ACCESS_KEY_ID=local
R2_SECRET_ACCESS_KEY=local
R2_BUCKET_NAME=renvani-local
APP_URL=http://localhost:3000
JWT_SECRET=local_jwt_secret_min_32_chars________
JWT_REFRESH_SECRET=local_refresh_secret_min_32____
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000
RESET_TOKEN_TTL_SECONDS=3600
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Do not** paste production Stripe/Twilio/SendGrid/OpenAI/R2 keys into `.env` for FS-41 evidence runs.

### 5.3 Database

```bash
createdb renvani_dev   # if needed
pnpm install
pnpm --filter @fsm/db db:migrate
```

**Test data:** Vitest API suites use in-memory `fake-db` (no Postgres required for `pnpm test`). For manual API exploration, use route tests or future seed scripts — **no customer PII** in committed fixtures.

### 5.4 Supported commands (recorded outcomes)

Recorded on detached checkout @ branch base `7f1e632` + FS-41 docs commit, Linux CI-like VM, **2026-10-21**:

| Command | Result |
| --- | --- |
| `pnpm install` | Exit **0** |
| `pnpm build` | Exit **0** (all workspace build targets) |
| `pnpm lint` | Exit **0** (`tsc --noEmit` per package) |
| `pnpm test` | Exit **0** (API Vitest **336** tests passed at `7f1e632`; re-run after merge to confirm count) |

Re-verify at PR head before merge to `dev`.

### 5.5 Out of scope for local FS-41 work

- CI workflow changes, deploy, Vercel/public site promotion
- Live SMS/email/payments/OpenAI/R2 calls (adapters may log dry-run only until Security-gated slices)

---

## 6. Acceptance checklist (FS-41)

| AC | Evidence |
| --- | --- |
| Local setup documented with test placeholders | §5 |
| Package purposes + import directions | §2–§3 |
| Supported commands with outcomes | §5.4 |
| Strict TS + Zod-at-boundary | §4 |
| SoR + integration non-goals | [ADR-FS-41](../adr/ADR-FS-41-renvani-sor-integrations-addendum.md) |
| PO ACK | Pending |
| Security ACK | Pending |

---

## 7. Reviewers

1. **Product Owner** — staged FSM + agent products vs import-only external data story  
2. **Security** — no prod creds in docs; integration risk register and founder gate for connectors
