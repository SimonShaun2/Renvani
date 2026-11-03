# STACK-03 — Cross-tenant CI matrix (Sam, day one)

**Authority:** [OFFICIAL-STACK-GAP-ANALYSIS.md](../platform/OFFICIAL-STACK-GAP-ANALYSIS.md) · Clerk + RLS sequencing  
**Owner:** Sam (spec) · Sofia (implementation)  
**Gate:** Runs in `batch-ci` on every API PR touching auth, imports, or tenant services.

## Rules

1. Wrong-tenant access returns **`NOT_FOUND`** (or **`FORBIDDEN`** where contract specifies) — never another tenant’s payload.
2. Tests use **synthetic fixtures only** (`synthetic-tenant-fixtures.ts`).
3. **Clerk** cases run behind `clerkAuthParallelJwt` (STACK-02 parallel JWT) in `stack03-cross-tenant-ci.test.ts`.
4. Future **RLS** (STACK-10): same cases must pass with session `company_id` set on DB pool.

## Matrix (JWT v1 — current)

| ID | Surface | Method | Assertion |
| --- | --- | --- | --- |
| STACK03-JWT-01 | `/api/v1/customers/:id` | GET | Org B token → Org A customer id → 404 |
| STACK03-JWT-02 | `/api/v1/imports/:id` | GET | Org B → Org A import session → 404 |
| STACK03-JWT-03 | `/api/v1/imports/:id/errors` | GET | Org B → Org A session errors → 404 |
| STACK03-JWT-04 | `/api/v1/jobs/:id` | GET | Org B → Org A job → 404 |
| STACK03-JWT-05 | `/api/v1/invoices/:id` | GET | Org B → Org A invoice → 404 |

## Matrix (Clerk — STACK-02 follow-up)

| ID | Surface | Notes |
| --- | --- | --- |
| STACK03-CLK-01..05 | Same routes | Clerk session org ≠ resource `companyId` |
| STACK03-CLK-06 | DB session | Assert `SET LOCAL`/hook receives mapped `company_id` per request |

## Implementation map

| File | Coverage |
| --- | --- |
| `apps/api/src/routes/security/stack03-cross-tenant-ci.test.ts` | **STACK03-JWT-01..05**, **STACK03-CLK-01..06** |
| `apps/api/src/routes/security/fs-92-tenant-isolation.test.ts` | Extended FS-92 entity routes (full suite) |
| `apps/api/src/routes/imports/imports.test.ts` | **STACK03-JWT-02/03** (import rollback suite) |

**CI:** `pnpm test:cross-tenant` (also runs in `batch-ci` before the full test suite).
