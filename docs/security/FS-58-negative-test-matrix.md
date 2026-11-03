# FS-58 — Public surface negative test matrix

**Owners:** Sofia (API + web proxy), Ezra (Infra)  
**Branch:** `cursor/fs-58-proxy-hardening-sofia-1f27`  
**Runbook:** [FS-58-public-surface-runbook.md](./FS-58-public-surface-runbook.md)

## Legend

| State | Meaning |
| --- | --- |
| **Covered** | Automated Vitest on this branch |
| **Manual** | Operator checklist only |

## Web — Next.js public API proxy (`/api/v1/public/*` rewrite)

| ID | Scenario | Expected | Mapping | State |
| --- | --- | --- | --- | --- |
| FS58-PROXY-01 | Dot-segment traversal in pathname | `400` | `apps/web/src/lib/public-api-path-security.test.ts` | Covered |
| FS58-PROXY-02 | Double-encoded traversal in raw URL | `400` | `apps/web/src/middleware.public-api.test.ts` | Covered |
| FS58-PROXY-03 | Unauthenticated GET booking settings via proxy | No login redirect | `apps/web/src/middleware.public-api.test.ts` | Covered |
| FS58-PROXY-04 | Unsupported method (e.g. `DELETE`) on proxy | `405` | `apps/web/src/middleware.public-api.test.ts` | Covered |
| FS58-PROXY-05 | Client `publicApi` rejects traversal before fetch | `400` `VALIDATION_ERROR` | `apps/web/src/lib/public-api.test.ts` | Covered |
| FS58-PROXY-06 | SSR booking settings fetch with unsafe slug | `null` (no fetch) | `apps/web/src/lib/public-booking-server.test.ts` | Covered |

## API — public booking abuse

| ID | Scenario | Expected | Mapping | State |
| --- | --- | --- | --- | --- |
| FS58-BOOK-01 | IP rate limit on public booking `POST` | `429` `RATE_LIMITED` | `apps/api/src/routes/public/booking/public-booking-ip-rate-limit.test.ts` | Covered |
| FS58-BOOK-02 | Per-reference slot-hold rate limit | `429` | `apps/api/src/routes/public/booking/public-booking-hold.test.ts` | Covered |
| FS58-BOOK-03 | Hold token tamper / expiry / reference mismatch | `401` / `409` | `public-booking-hold.test.ts` | Covered |
| FS58-BOOK-04 | In-memory limiter unit behavior | allow → deny | `apps/api/src/lib/public-booking-rate-limit.test.ts` | Covered |

## API — tenant boundary (related)

| ID | Scenario | Expected | Mapping | State |
| --- | --- | --- | --- | --- |
| FS58-TEN-01 | Unauthenticated tenant API reads | `401` | `apps/api/src/routes/security/fs-92-tenant-isolation.test.ts` | Covered |

## Branded storefront (web routes, not API proxy)

| ID | Scenario | Expected | Mapping | State |
| --- | --- | --- | --- | --- |
| FS58-GROW-01 | Public `/site/:slug` treated as unauthenticated route | No staff login redirect | `apps/web/src/lib/route-access.test.ts` | Covered |
| FS58-GROW-02 | Staff preview `/growth/website-preview/:slug` | Authenticated staff only | `apps/web/app/(app)/growth/website-preview/[slug]/page.tsx` | Manual |

## Sign-off

Request **Isaac + Lily + Sam** review at PR head SHA before `batch-ci`.
