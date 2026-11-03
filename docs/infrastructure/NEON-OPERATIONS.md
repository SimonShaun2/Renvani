# Neon PostgreSQL operations (STACK-01)

**Authority:** [OFFICIAL-OPERATIONAL-STACK.md](../OFFICIAL-OPERATIONAL-STACK.md) · founder sequencing §4  
**Owner:** Iris (engineering) · **Accounts:** Shaun

## Region

- Provision Neon in the **same region as the Render API** web service (low latency, single compliance footprint).
- Document chosen region in Render service settings and this file when Shaun confirms.

## Environments

| Tier | Neon target | `DATABASE_URL` injection |
| --- | --- | --- |
| **dev** | Persistent dev branch or project | Render API/worker/webhook (dev) |
| **staging** | Staging branch | Render staging services |
| **production** | Prod branch | Render prod (founder gate) |
| **PR preview** | **Neon per-PR branch** (or ephemeral) | Optional CI/`batch-ci` when wired |

## Per-PR branches

- Use Neon branch-per-PR for schema migration review when migration PRs run extended CI (coordinate with Tech Lead — no collision on `0026+`).
- Local and default `batch-ci` may continue disposable Postgres until Neon CI connection is founder-provided.
- **Per-PR CI wiring:** see [NEON-PER-PR-CI.md](./NEON-PER-PR-CI.md) (`NEON_CI_STAGING_DATABASE_URL`, staging-only).

## Pooling (FS-80)

- Use Neon **pooled** connection string for API/worker; respect max connections.
- **RLS (STACK-10):** session `company_id` must be set on the same connection used for the request (avoid pool stickiness bugs).

## Non-goals

- Render Postgres for new environments (superseded by official stack).
- Agents creating Neon projects or copying prod data to staging.
