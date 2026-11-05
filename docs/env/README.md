# Environment templates (FS-76)

Redacted examples for planning injection per runtime. **Do not commit filled-in files.**

| Template | Use |
| --- | --- |
| [local-dev.env.example](./templates/local-dev.env.example) | Full local stack (`pnpm dev`) — mirrors root `.env.example` |
| [api.env.example](./templates/api.env.example) | `apps/api` minimum |
| [webhook.env.example](./templates/webhook.env.example) | `apps/webhook` minimum |
| [worker.env.example](./templates/worker.env.example) | `apps/worker` minimum (monolithic until per-service bundles) |
| [web.env.example](./templates/web.env.example) | `apps/web` — public + server-only URLs |
| [migrations.env.example](./templates/migrations.env.example) | Drizzle CLI / one-off migrations |

**Inventory:** [FS-76-secrets-env-inventory.md](../security/FS-76-secrets-env-inventory.md)  

**Current operational direction, reconciled 2026-11-05:** Vercel (`apps/web`), Render (`apps/api`, `apps/worker`, `apps/webhook` and Key Value), Neon PostgreSQL, and Cloudflare R2. See the [official operational stack](../OFFICIAL-OPERATIONAL-STACK.md), [Render deployment runbook](../infrastructure/RENDER-DEPLOY-RUNBOOK.md), [Neon operations](../infrastructure/NEON-OPERATIONS.md), and [Render environment inventory](../infrastructure/RENDER-ENV-INVENTORY.md). This is source/documentation evidence; it does not certify account configuration, credential scope or rotation. The former Railway injection model and [production deployment plan](../planning/PRODUCTION-DEPLOYMENT.md) are historical references.

| Surface | Host |
| --- | --- |
| `apps/web` | Vercel project env |
| `apps/api`, `apps/worker`, `apps/webhook` | Render service environment |
| PostgreSQL | Neon connection → `DATABASE_URL` |
| Redis-compatible queues | Render Key Value connection → `REDIS_URL` |
| Files | R2 configuration for services using the storage adapter |

**Template status:** These example files are an older FS-76 baseline. At dev `b45b4996b64b16859e44a79b171b11cbe52c3e6a`, the existing documentation validator reports missing and extra names. Do not treat a template as a complete current service allowlist. [CICD-STATE.md](../audit/CICD-STATE.md) records the discrepancies and the separate [PR #419](https://github.com/SimonShaun2/Renvani/pull/419) environment-boundary work. No secret values, provider settings or templates are changed by this documentation reconciliation.

Validate templates against schema:

```bash
pnpm check:env-docs
```
