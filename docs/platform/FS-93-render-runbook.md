# FS-93 — Render hosting runbook (architecture draft)

**Status:** Design / runbook only — **not applied**, no Render account or resources created  
**Founder decision:** 2026-10-22 5:12 PM CT — Option A compute host is **Render** (supersedes Railway wording in §7 @ 4:56 PM CT)  
**ADR:** [ADR-FS-93](../adr/ADR-FS-93-managed-platform-boundaries.md)  
**Blueprint draft:** [render-blueprint.render.yaml](../infrastructure/render-blueprint.render.yaml) (reference copy; **do not** deploy from this path without founder OK)

---

## Platform split (approved)

| Workload | Provider | Render service type |
| --- | --- | --- |
| Web (`apps/web`) | **Vercel** | (not on Render) |
| API (`apps/api`) | **Render** | Web service (long-lived Node) |
| Worker (`apps/worker`) | **Render** | Background worker |
| Webhook (`apps/webhook`) | **Render** | Web service (separate from API) |
| PostgreSQL | **Neon** (serverless Postgres) | Connection string in Render env; **same region as API** ([ADR-FS-STACK](../adr/ADR-FS-STACK-renvani-official-platform.md)) |
| Queues (`REDIS_URL`) | **Render Key Value** | Redis-compatible (Valkey); BullMQ |
| Files | **Cloudflare R2** | External; not Render |
| Staff auth | **Clerk** (phased) + in-repo JWT parallel | STACK-02; JWT remains until Clerk cutover |

**Out of scope for this runbook:** account creation, billing, secrets, DNS cutover, production deploy, staging spend (separate founder OK).

---

## Render Key Value + BullMQ (required)

BullMQ stores job metadata and locks in Redis-compatible storage. **Do not use the default `allkeys-lru` eviction policy** — evicted keys can drop or corrupt queue state.

| Setting | Required value | Why |
| --- | --- | --- |
| `maxmemoryPolicy` | **`noeviction`** | Writes fail when full instead of silently evicting queue keys ([Render Key Value docs](https://render.com/docs/key-value)) |
| `ipAllowList` (blueprint) | **`[]`** for internal-only | API, worker, and webhook reach Key Value on Render private network |
| Client env | `REDIS_URL` from `connectionString` | Same variable name as today; ioredis/BullMQ unchanged |

**Operational note:** With `noeviction`, monitor memory. Scale Key Value plan or trim queue depth before the instance hits max memory (writes will error).

**Persistence:** Prefer a paid plan with persistence for queue durability across restarts; confirm plan limits at provisioning time.

---

## Service-specific Render notes

### API web service

- **Runtime:** Node 20+; monorepo build via root `pnpm build` (packages + `@fsm/api`).
- **Start:** `node dist/server.js` from `apps/api` (see `apps/api/package.json`).
- **Port:** Bind `process.env.PORT` (Render injects `PORT`; align `API_PORT` / server listen with Render docs).
- **Health:** Expose HTTP health route for Render health checks once implemented in FS-75/76 matrix.
- **Trust proxy:** Configure Fastify for Render TLS termination (same class of change as TICKET-039 / production config PR).

### Background worker

- **Type:** Render **background worker** (not a web service).
- **Start:** `node dist/index.js` from `apps/worker`.
- **Scaling:** Scale on queue depth / oldest-job age; cap concurrency per FS-80 connection budget.
- **Same env surface as API** for `DATABASE_URL`, `REDIS_URL`, and vendor secrets (founder-set in dashboard only).

### Webhook web service

- **Separate service** from API so Stripe/Twilio ingress can scale and deploy independently.
- **Start:** `node dist/server.js` from `apps/webhook`.
- **Public URL** is the Stripe/Twilio webhook target; signature verification stays in app code.

### Neon PostgreSQL (STACK-12)

- **Region:** Neon project region must match the Render **API** web service region (latency + data residency).
- **Environments:** Separate Neon branches or projects for dev, staging, and prod; `DATABASE_URL` per Render service group (see STACK-01 / STACK-11).
- **Migrations:** Run Drizzle migrations from a **controlled** process (pre-deploy job or one-off) — FS-80 / #63; never from ad-hoc shells against prod.
- **Pooling:** Use Neon pooler URL where appropriate; honor `DATABASE_POOL_MAX` / FS-80 connection budget on API, worker, and webhook.
- **RLS:** Session `app.current_company_id` (STACK-10) enabled on staging after Clerk session bridge (STACK-02).

### Vercel (web)

- `NEXT_PUBLIC_*` and BFF/API base URL must point at Render API hostname when environments exist — document in FS-75 env matrix; no URLs committed as live secrets.

### R2

- Unchanged from FS-93 Option A; credentials only in host secret stores.

---

## Environment variables (inventory — values founder-owned)

Sync `false` in blueprint for all secrets. Minimum shared set across API, worker, webhook:

- `DATABASE_URL` — from **Neon** (pooled connection string; region = API region)
- `REDIS_URL` — from Render Key Value `connectionString`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- Stripe, Twilio, SendGrid, R2, OpenAI keys per `@fsm/config` / `packages/config`

Worker does not need public `PORT` for HTTP; API and webhook do.

---

## Blueprint usage (when founder authorizes staging)

1. Review [render-blueprint.render.yaml](../infrastructure/render-blueprint.render.yaml).
2. Copy or promote to repo-root `render.yaml` only in a **reviewed** platform PR after staging OK — not part of FS-93 evidence alone.
3. Create Blueprint instance in Render Dashboard; approve resource list; set secrets manually.
4. Wire Vercel preview/production to Render API base URL.
5. Run FS-92 negative tests on staging before claiming isolation.

---

## Related

- [FS-93 founder decision §7](../decisions/FS-93-founder-decision-proposal.md) — Render amendment  
- [FS-93 Option A dev notice](./FS-93-option-a-dev-notice.md)  
- [BUILD_LAYERS.md](../architecture/BUILD_LAYERS.md) — responsibility matrix  

## FS-66 — trust proxy and global rate limit

> **⚠️ URGENT — shared per-IP buckets on Render until `TRUST_PROXY_HOPS` is set.**
> With `TRUST_PROXY_HOPS=0` (the default) on Render, `request.ip` is Render's proxy address, not the client. That means **every per-IP bucket is shared by ALL customers**: the slot-hold/confirm IP limit (6 per 10 min) and the pre-existing public booking limit (10/hr per IP) already behave this way in production, so a few users (or one attacker) can exhaust the limit for everyone. Verify the hop count in staging (steps below) and set `TRUST_PROXY_HOPS` as a priority.
>
> **Redis-down caveat:** limits are enforced in Redis across instances. If Redis is down or slow (>250 ms), the limiter falls back to an in-memory window, so limits become **per instance** (effective limit ≈ limit × instance count) until Redis recovers. The memory store is capped (50k keys) and evicts expired, then oldest, windows; it never clears all limits.
>
> **Bucketing:** IPv4 is used as-is; IPv4-mapped IPv6 (`::ffff:a.b.c.d`) is unmapped to IPv4; other IPv6 is bucketed by /64; unparseable values share one `invalid` bucket. `TRUST_PROXY_HOPS` is bounded to 0–10.

The API reads the client IP from `request.ip`. With `TRUST_PROXY_HOPS=0` (default), that is the socket peer, which on Render is a proxy rather than the client. The global limiter (`GLOBAL_RATE_LIMIT_ENABLED`) ships **off**. Slot-hold limits are on regardless.

The hop count is **not verified** for our services. Render's article ([How Render handles DDoS attacks](https://render.com/articles/how-render-handles-ddos-attacks)) says traffic passes through Cloudflare and Render's load balancers, and its Express example uses `trust proxy` 1. Third-party live tests on `onrender.com` ([Render community thread](https://community.render.com/t/what-number-of-proxies-sit-in-front-of-an-express-app-deployed-on-render/35981), [WebDecoy Render notes](https://docs.webdecoy.com/installation/render/)) report that 3 hops were needed. They also report that Render appends to any client-supplied `X-Forwarded-For` rather than replacing it.

To enable it:

1. In staging, temporarily log `request.ip`, `request.ips` and the raw `x-forwarded-for` header at debug level for one authenticated request (or use an existing request log line), then revert.
2. From a machine with a known public IP (`curl https://ifconfig.me`), call the staging API once without an `X-Forwarded-For` header, and once with a forged header `X-Forwarded-For: 6.6.6.6`.
3. Count the entries Render appends after your real IP in `x-forwarded-for`. Including the socket peer, `TRUST_PROXY_HOPS` should equal the number of proxy hops, so that `request.ip` is your real IP and **never** `6.6.6.6`.
4. Set `TRUST_PROXY_HOPS=<n>`, redeploy, and repeat step 2 to confirm. Then set `GLOBAL_RATE_LIMIT_ENABLED=true`, redeploy, and confirm `X-RateLimit-Limit` appears on API responses and that `/health` is unaffected.
5. Check custom domains separately. If any other proxy or CDN sits in front, the hop count changes.
