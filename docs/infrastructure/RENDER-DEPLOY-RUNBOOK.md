# Render deploy runbook (api, worker, webhook)

**Status: NOT APPLIED.** Nothing exists on Render yet in any workspace (confirmed 2026-10-27 CT).
Applying this Blueprint creates billable resources; only the founder applies it.

| Item | Where |
| --- | --- |
| Blueprint (canonical) | `/render.yaml` |
| Reference copy (must be identical) | `docs/infrastructure/render-blueprint.render.yaml` |
| Guard test | `packages/config/src/fs93-render-blueprint.test.ts` |
| Env names | `docs/infrastructure/RENDER-ENV-INVENTORY.md` |
| Smoke test | `scripts/render/smoke.sh` |
| Region rule | `docs/infrastructure/STACK-12-render-neon-region.md` |

## Topology

- `renvani-api`: Render web service, Fastify (`apps/api`). Health check `/health/live`, migrations in `preDeployCommand`.
- `renvani-worker`: Render background worker, BullMQ consumers (`apps/worker`). No HTTP port.
- `renvani-webhook`: Render web service for Stripe/Twilio (`apps/webhook`). Health check `/health`.
- `renvani-bullmq-kv`: Render Key Value. Required: BullMQ (`packages/jobs`) needs Redis. `noeviction` +
  `journal-snapshot` persistence so queued jobs are not evicted or lost on restart. Private only (`ipAllowList: []`).
- **Not on Render:** web (Vercel), Postgres (Neon; there is no `databases:` block).

Health route choice: `/health/live` is pure liveness. `/health/ready` checks Neon, Redis and R2, so an R2 or
Neon blip would make Render restart a healthy API. The smoke script checks `/health/ready` instead.

## Before the first apply

1. **Region.** Set `region:` on all four entries to the region of the Neon project (STACK-12). The file says
   `oregon` as a placeholder. Region can't be changed after creation.
2. **Branch.** `branch: dev` matches what Vercel production builds today. Switch to `main` when releases move there.
   `autoDeployTrigger: "off"`: deploys are manual until the smoke test passes once.
3. Have every **prompt** value from `RENDER-ENV-INVENTORY.md` ready in the password manager.
   Use the Neon **pooled** connection string for `DATABASE_URL`.
4. Confirm the workspace plan (Hobby is enough for these three services; see PR cost table).

## Apply (founder, Render Dashboard)

1. New > Blueprint > connect `SimonShaun2/Renvani`, Blueprint path `render.yaml`.
2. Enter each `sync: false` value when prompted. Render only prompts on this **first** creation;
   later Blueprint syncs ignore `sync: false` keys, so new secrets are added by hand on each service.
3. Create. Order is handled by Render: Key Value first, then services. The API `preDeployCommand`
   (`pnpm --filter @fsm/db db:migrate`) runs Drizzle migrations against Neon before the new API starts.
   If it fails, the deploy stops and the old version keeps serving.
4. Run the smoke test (below). Then point Vercel `NEXT_PUBLIC_API_URL` at the API URL and set the
   Stripe webhook endpoint to `<webhook URL>/stripe` (test mode). Those are separate, founder-approved steps.

## TRUST_PROXY_HOPS (FS-66 rate limiter)

The API rate limiter keys on `request.ip` (`apps/api/src/plugins/global-rate-limit.ts`). Fastify only reads
`X-Forwarded-For` when `trustProxy` is set; `TRUST_PROXY_HOPS` controls it (`apps/api/src/app.ts`).

- Render's proxy is one hop in front of the service and appends the real client IP, so the Blueprint
  sets **`TRUST_PROXY_HOPS=1`** on the API.
- **`0`** (the schema default) on Render would make every request look like it comes from Render's proxy,
  so all users share one rate-limit bucket.
- If a CDN/proxy (e.g. Cloudflare) is added in front of the Render URL, raise it to **2**. Never set it higher
  than the real number of proxies: clients could then spoof their IP with a forged `X-Forwarded-For`.
- `GLOBAL_RATE_LIMIT_ENABLED` ships as `"false"`. Turn it on only after checking that the API logs the real
  client IP (send a request from a known IP and look for it in the request log).
- The webhook service doesn't rate-limit by IP, so it doesn't set `TRUST_PROXY_HOPS`.

## Smoke test

```bash
API_BASE_URL=https://renvani-api.onrender.com \
WEBHOOK_BASE_URL=https://renvani-webhook.onrender.com \
scripts/render/smoke.sh
```

It checks API live/ready/db/redis/storage, webhook `/health`, and that an unsigned POST to `/stripe` is
rejected (4xx). It sends no credentials and prints no secrets. Check the worker in its Render logs.

## Rollback

Render Dashboard > service > Deploys > Rollback (Hobby keeps 5 builds). Migrations are forward-only:
roll the database back with Neon branch restore (`docs/infrastructure/NEON-OPERATIONS.md`, FS-83 runbook)
only if a migration itself is the problem.

## Upgrades

- Memory: 512 MB is the cheapest paid size. If the worker hits OOM on large imports or AI jobs,
  move it to `1c-2g`.
- Key Value: `256mb` holds BullMQ queues with headroom. Move to `1g` if memory use passes ~70%.
