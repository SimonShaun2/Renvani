> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-039: Production Config + Deployment

**Phase:** Launch
**Assigned:** Agent 1 (Backend config) + Agent 2 (Frontend config)
**Auditor:** Agent 4
**Priority:** P0 — Required before any real traffic.
**Dependencies:** v3.0.0 tagged and pushed

---

## Agent Prompts

### Agent 1 — Read This First
You are Agent 1. Make the production configuration changes to the API
and Worker so they run correctly on Railway. This is code changes only —
no infrastructure setup (that's done manually via the deployment guide).
Changes: trust proxy headers, health check endpoint, graceful shutdown,
auto-run migrations on startup, production CORS from env var.
Follow AGENTS.md, CODEX.md, WORKFLOW.md. Tests must still pass.
No commit — output TASK COMPLETE when done.

### Agent 2 — Read This First
You are Agent 2. Make the production configuration changes to the
Next.js frontend so it runs correctly on Vercel. Changes: next.config.ts
image domains, service worker headers, environment-aware API URL,
domain-based routing middleware for servicerev.app vs app.servicerev.app.
Follow AGENTS.md, CODEX.md, WORKFLOW.md.
No commit — output TASK COMPLETE when done.

---

## Figma Reference
None — infrastructure config only.

---

## Acceptance Criteria

### Agent 1
- [ ] `GET /health` returns `{ status: 'ok', version, timestamp }`
- [ ] `GET /health/db` returns `{ status: 'ok', latencyMs }` or error details
- [ ] `trustProxy: true` added to Fastify config
- [ ] CORS origins loaded from `CORS_ORIGINS` env var (comma-separated)
- [ ] Drizzle migrations run automatically before server starts
- [ ] Worker handles `SIGTERM` gracefully (closes queues, exits 0)
- [ ] `pnpm --filter @fsm/api test` still passes
- [ ] `pnpm build` passes clean

### Agent 2
- [ ] `next.config.ts` allows images from `files.servicerev.app`
- [ ] `/sw.js` served with correct `Service-Worker-Allowed` header
- [ ] API URL loaded from `NEXT_PUBLIC_API_URL` env var (no hardcoded localhost)
- [ ] Middleware routes `servicerev.app` → landing page only
- [ ] Middleware routes `app.servicerev.app` → authenticated app
- [ ] `pnpm --filter @fsm/web build` passes clean

---

## Agent 1 Owns

### Health check routes
`apps/api/src/routes/health/index.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import { db } from '@fsm/db';
import { sql } from 'drizzle-orm';

export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => ({
    status: 'ok',
    version: process.env.npm_package_version ?? '0.0.0',
    timestamp: new Date().toISOString(),
    env: process.env.NODE_ENV,
  }));

  fastify.get('/health/db', async (request, reply) => {
    const start = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      return { status: 'ok', latencyMs: Date.now() - start };
    } catch (error) {
      reply.code(503);
      return { status: 'error', message: String(error) };
    }
  });
}
```

Register in `apps/api/src/app.ts`:
```typescript
await fastify.register(healthRoutes);
```

### Trust proxy + CORS from env
`apps/api/src/app.ts`

```typescript
const fastify = Fastify({
  logger: pinoLogger,
  trustProxy: true,  // ← ADD THIS
});

// CORS — replace hardcoded array with env var:
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:3001'];

await fastify.register(cors, {
  origin: corsOrigins,
  credentials: true,
});
```

### Auto-migrate on startup
`apps/api/src/server.ts`

```typescript
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from '@fsm/db';
import path from 'path';

async function start() {
  // Run migrations before starting server
  if (process.env.NODE_ENV === 'production') {
    console.log('Running database migrations...');
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../../../packages/db/migrations'),
    });
    console.log('Migrations complete.');
  }

  const app = await buildApp();
  await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' });
  console.log(`API listening on port ${process.env.PORT ?? 3001}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### Worker graceful shutdown
`apps/worker/src/index.ts`

```typescript
const shutdown = async (signal: string) => {
  console.log(`Received ${signal}. Closing worker gracefully...`);
  await worker.close();
  await schedulerWorker?.close();
  await redisConnection.quit();
  console.log('Worker shut down cleanly.');
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

### Verify all existing tests still pass
```bash
corepack pnpm --filter @fsm/api test
corepack pnpm build
```

---

## Agent 2 Owns

### next.config.ts
`apps/web/next.config.ts`

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'files.servicerev.app',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      {
        source: '/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### API URL from env (audit existing usage)
Search for any hardcoded `http://localhost:3001` in `apps/web/src/`.
Replace all with `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'`.

Verify `apps/web/src/lib/api.ts` uses:
```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
```

### Domain-based routing middleware
`apps/web/src/middleware.ts`

Add domain routing logic on top of existing auth middleware:

```typescript
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_ROUTES = ['/login', '/signup', '/book', '/estimates', '/pay',
                       '/review', '/portal', '/_next', '/api', '/health',
                       '/sw.js', '/manifest.json', '/icons', '/favicon'];

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') ?? '';
  const pathname = request.nextUrl.pathname;

  // Domain routing:
  // servicerev.app → only serve landing page and public routes
  // app.servicerev.app → serve the full app
  const isMarketingDomain = hostname === 'servicerev.app' ||
                             hostname === 'www.servicerev.app';
  const isAppDomain = hostname.startsWith('app.');

  // On marketing domain, only allow landing + public booking/payment routes
  if (isMarketingDomain) {
    const allowedOnMarketing = ['/', '/book', '/pay', '/review', '/portal',
                                 '/_next', '/favicon', '/sw.js', '/manifest',
                                 '/icons'];
    const isAllowed = allowedOnMarketing.some(p => pathname.startsWith(p));
    if (!isAllowed) {
      // Redirect app routes to app subdomain
      return NextResponse.redirect(
        `https://app.servicerev.app${pathname}${request.nextUrl.search}`
      );
    }
    return NextResponse.next();
  }

  // Existing auth middleware logic below (unchanged)
  // ... rest of existing middleware
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

### .env.local template
Create `apps/web/.env.local.example` (committed — safe, no secrets):

```bash
# API
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (publishable key is safe to commit as example)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY=

# Booking
NEXT_PUBLIC_BOOKING_BASE_URL=http://localhost:3000
```

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] `GET /health` returns 200 with correct shape
- [ ] `GET /health/db` returns 200 when DB connected, 503 when not
- [ ] `trustProxy: true` present in Fastify init
- [ ] CORS origins from `CORS_ORIGINS` env var — not hardcoded
- [ ] Migration runs only in production (NODE_ENV check)
- [ ] Worker SIGTERM handler closes all connections before exit
- [ ] No hardcoded `localhost:3001` in web app source
- [ ] `next.config.ts` has R2 image domain whitelisted
- [ ] `/sw.js` headers present in nextConfig
- [ ] Domain middleware doesn't break existing auth middleware
- [ ] `.env.local.example` committed with no real secrets
- [ ] All existing API tests still pass (281/281)

---

## Push instructions (after both agents complete)

```bash
git add .
git commit -m "TICKET-039: Production config for Railway + Vercel deployment"
git push origin main
```

Then follow PRODUCTION-DEPLOYMENT.md for the manual infrastructure steps.
