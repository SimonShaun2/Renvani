# FS-58 — Public surface abuse controls (runbook)

**Owners:** Sofia (API + web proxy), Ezra (Infra) · **Lifecycle:** Discover / Book  
**MVP P0:** Proxy and branded public paths must fail closed under abuse.

**Negative test matrix:** [FS-58-negative-test-matrix.md](./FS-58-negative-test-matrix.md)

## Surfaces in scope

| Surface | Route prefix | Controls |
| --- | --- | --- |
| Public booking API | `/api/v1/public/booking/*` | IP rate limit on `POST`; per-reference limit on slot-hold; Zod slug validation |
| Public estimates | `/api/v1/public/estimates/*` | Token-only access; per-token rate limit |
| Public pay / reviews | `/api/v1/public/pay/*`, `/api/v1/public/reviews/*` | Token-only access |
| Next.js public API proxy | Same-origin `/api/v1/public/*` → API rewrite | Traversal rejection; `GET`/`HEAD`/`POST` only; no auth cookie required |
| Branded storefront (web) | `/site/[slug]`, `/site/[slug]/inquire` | Slug-scoped SSR; uses public booking API with encoded slug |
| Growth staff preview | `/growth/website-preview/[slug]` | Authenticated staff route (not customer-published) |

## Rate limits (v1)

- **Booking submit / hold / inspect:** `checkPublicBookingIpRateLimit` — shared Redis counter per IP (10/hour in test + prod config).
- **Slot hold:** `checkPublicSlotHoldReferenceRateLimit` — per `slug` + `referenceNumber` (15/hour).
- **Public estimate links:** in-process per-token limit on approve/decline/get (`apps/api/src/routes/public/estimates/index.ts`).

## Proxy hardening (web)

Implementation lives in:

- `apps/web/src/lib/public-api-path-security.ts` — traversal detection, method allowlist, slug segment checks.
- `apps/web/middleware.ts` — fail closed with `400` (traversal) or `405` (method) before rewrite.
- `apps/web/next.config.ts` — rewrite only `/api/v1/public/:path*` to the API origin.
- `apps/web/src/lib/public-api.ts` — client-side path guard before `fetch`.
- `apps/web/src/lib/public-booking-server.ts` — SSR slug guard before server `fetch`.

## Negative test matrix

Automated coverage (see matrix doc for IDs):

- `apps/web/src/middleware.public-api.test.ts`
- `apps/web/src/lib/public-api-path-security.test.ts`
- `apps/web/src/lib/public-api.test.ts`
- `apps/web/src/lib/public-booking-server.test.ts`
- `apps/api/src/routes/public/booking/public-booking-ip-rate-limit.test.ts`
- `apps/api/src/routes/public/booking/public-booking-hold.test.ts`
- `apps/api/src/routes/security/fs-92-tenant-isolation.test.ts`

## Operator response

1. **429 spikes on booking:** Check Redis connectivity; confirm limit keys not shared across environments (`fsm:public-booking:rate:*`).
2. **Token spray on estimates:** Rotate estimate public tokens at source; no platform-wide block without founder approval.
3. **Cross-tenant report:** Treat as **P0** — run FS-92 matrix on `dev` head before merge.
4. **405 on public proxy:** Expected for non-`GET`/`HEAD`/`POST`; investigate client or scanner traffic.

## Change control

New public routes require: Zod validation, tenant scoping, rate limit or explicit ADR exception, Sam security review.

**Sign-off:** Isaac + Lily + Sam @ PR head SHA → `batch-ci` → merge (no merge without triple PASS).
