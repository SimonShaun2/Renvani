# CI and environment state: build specification 5

**Observed:** 2026-11-05 UTC. **Source baseline:** dev [`b45b4996b64b16859e44a79b171b11cbe52c3e6a`](https://github.com/SimonShaun2/Renvani/tree/b45b4996b64b16859e44a79b171b11cbe52c3e6a). **Scope:** source assessment and current-documentation corrections. **Traceability:** [FSM-0010 / issue #11](https://github.com/SimonShaun2/Renvani/issues/11) is explicitly mapped to FS-1 in [its ticket](../../tickets/FSM-0010.md); [#420](https://github.com/SimonShaun2/Renvani/issues/420) controls execution and merge authority. This report does not close that historical issue or certify runtime credentials, protections or release readiness.

## 1. Workflow inventory and actual conditions

The tracked `.github/workflows` directory contains one workflow: [batch-ci.yml](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/.github/workflows/batch-ci.yml). There is no separate Neon workflow at this source head.

| Element | Source observation | Evidence meaning |
| --- | --- | --- |
| Triggers | `pull_request` types `labeled`, `synchronize`, `reopened`; `workflow_dispatch` | A trigger is not a policy approval record. |
| Job gate | Dispatch event OR PR label `batch-ci`, on both jobs | Without either condition the jobs are skipped. An existing label can allow a later synchronize event; policy still requires an enumerated approved batch at the current head. |
| Concurrency | `batch-ci-${{ github.event.pull_request.number }}`; cancel-in-progress false | Source configuration, not evidence of current queue state. |
| Primary job | Ubuntu latest; 45-minute timeout | Installs frozen lockfile, builds, lints, runs cross-tenant matrix, workspace tests, import contracts and golden-import wiring. |
| Neon job | Depends on primary job; 20-minute timeout | Installs, builds script dependencies, calls Neon branch gate, golden-import E2E and Node wiring tests. |
| Checkout | Both use `actions/checkout@v4` without explicit `ref` | Capture associated PR head **and actual checked-out commit**. The source alone does not prove an exact-head-only checkout. |
| FS-235 conditional gate | Pull-request event and PR number 411 | Node 22.16.0, worker dependency build and strict isolated PostgreSQL concurrency script; skipped on other PRs and dispatch events. |
| FS-229 conditional gate | Pull-request event, PR 414, expected branch, base `dev`, same repository | Node 22.16.0, wiring test, API build and strict isolated inquiry concurrency; skipped unless all predicates match. |

The [Neon branch script](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/scripts/ci/neon-per-pr-branch.mjs) and [golden-import script](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/scripts/ci/golden-import-e2e.mjs) explicitly log `SKIP` and exit zero when their staging database configuration is absent. Consequently, a green job or step alone does not establish database test execution. Inspect its logs and executed/skipped test counts. Strict FS-235/FS-229 scripts use separate isolated-database and result checks; their conditional exclusion is not a pass.

## 2. Runtime discrepancy and proposed bounded correction

| Source | Configured runtime |
| --- | --- |
| [Root package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/package.json) | Node **22.16.0**; pnpm **10.0.0** |
| Both general setup-node steps in batch-ci.yml | Node **20** |
| Conditional FS-235/FS-229 setup-node steps | Node **22.16.0** |
| [render.yaml](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/render.yaml) API, worker and webhook declarations | Node **22.16.0** |

**Proposed implementation for Platform/Codex review:** change the two general `node-version: 20` values to the repository-pinned `22.16.0` in a separately reviewed change; check any then-current CI/runtime policy before implementation. Keep batch triggers, permission boundaries and conditional database gates intact. Validate the selected batch at its actual checkout with independent Platform/Technical Lead review. This report changes no workflow or runtime setting and does not dispatch CI.

The root scripts and Render blueprint intentionally build import-normalize/types/comms before downstream packages. Reproducible local checks must respect dependency build order; a fresh workspace missing generated internal package types is not evidence of an application regression.

The notifications worker also dynamically imports compiled API email/SMS modules under `apps/api/dist/lib`. Its deployed artifact must contain those API build outputs; a worker package build alone does not prove the dependency is present. The [worker map](WORKER-INVENTORY.md) records the provider boundary, including the disabled SMS registry observed in the source. No live delivery is inferred from a queue or job log.

## 3. Current hosting direction and evidence boundaries

| Surface | Documented direction | Source and remaining verification |
| --- | --- | --- |
| Web | Vercel, project `renvani-web` | [Official stack](../OFFICIAL-OPERATIONAL-STACK.md); exact preview deployment records available separately. Build readiness does not prove authenticated acceptance. |
| API, worker, webhook | Render | [Deployment runbook](../infrastructure/RENDER-DEPLOY-RUNBOOK.md), [root blueprint](../../render.yaml). Blueprint names/regions are desired source configuration; no account-setting audit performed here. |
| PostgreSQL | Neon | [Operations](../infrastructure/NEON-OPERATIONS.md), [per-PR staging CI](../infrastructure/NEON-PER-PR-CI.md). No database connection or migration execution in this package. |
| Queue store | Render Key Value | Blueprint; Redis-compatible BullMQ contract. Live memory policy, access controls and observed job execution not certified. |
| Auth | Clerk with existing compatibility paths | [Session bridge](../security/STACK-02-clerk-session-bridge.md); inspect current service/feature-flag code for the chosen deployment. No token or account inspection. |
| Email/SMS | Resend and Twilio, with legacy SendGrid paths | [Environment inventory](../infrastructure/RENDER-ENV-INVENTORY.md) and [worker map](WORKER-INVENTORY.md). Adapter presence does not prove provider activation or successful delivery. |
| Storage | Cloudflare R2 | Existing configuration/storage contracts; bucket policy and rotation not inspected. |

The current [environment guide](../env/README.md) now links these sources. `PRODUCTION-DEPLOYMENT.md` and the old FS-83 services snapshot are clearly annotated as historical, preserving their contents without presenting old brand domains, JWT-only assumptions, package/queue counts or Render Postgres instructions as current policy.

## 4. Environment documentation validator: existing failure

The existing `node scripts/check-env-documentation.mjs` reports **FAILED** on the unmodified source templates. Its checks are static key-name comparisons, not a provider or least-privilege audit.

| Comparison | Observed discrepancy |
| --- | --- |
| Root `.env.example` versus parsed schema | 23 missing names; 6 extra names |
| Local-dev template versus parsed schema plus documented API_URL | 49 missing names |
| Archived deployment examples | Warning for five stale names |

Root missing names: `APP_URL_ALLOWED`, `CUSTOMER_PLATFORM_FEE_DISCLOSURE`, `DATABASE_CONNECT_TIMEOUT_SECONDS`, `DATABASE_IDLE_TIMEOUT_SECONDS`, `DATABASE_POOL_MAX`, `DATABASE_SERVICE_MAX_CONNECTIONS`, `DATABASE_TRANSACTION_MAX_RETRIES`, `DATABASE_TRANSACTION_RETRY_BASE_MS`, `DRIVE_TIME_ASSUMED_SPEED_MPH`, `DRIVE_TIME_ESTIMATOR`, `ETA_ASSUMED_SPEED_MPH`, `GEO_PROVIDER`, `MEDIA_SIGNED_URL_TTL_SECONDS`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `OBJECT_STORAGE_PROVIDER`, `ORIGIN_SECRET`, `PORT`, `RENVANI_INTERNAL_COMPANY_ID`, `RESEND_FROM_EMAIL`, `SENTRY_DSN`, `STRIPE_BRANDING_ICON_URL`, `STRIPE_BRANDING_LOGO_URL`, `STRIPE_RENVANI_STATEMENT_PREFIX`.

Root extra names: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `RENAVANI_INTERNAL_COMPANY_ID`, `WEBFLOW_API_TOKEN`, `WEBFLOW_PAGE_SECTIONS_COLLECTION_ID`, `WEBFLOW_PRODUCT_VISUALS_COLLECTION_ID`, `WEBFLOW_SITE_ID`. An extra name is a validator mismatch, not proof it is unused; web-only Clerk configuration and Webflow consumers need classification. The two differently spelled internal-company names need an explicit compatibility decision, not blind deletion.

Local-dev omissions include the above current schema families plus Clerk, QuickBooks, Resend, proposal flags, public-slot-hold rate limits, email branding and billing configuration. Reproduce the complete list with the existing validator against the pinned source. The validator's web-template allowlist currently only covers NODE_ENV and API/public origin keys; it must not be mistaken for a complete current web credential inventory.

**Follow-up:** reconcile current example/template names and the validator's web-only classification with [FS-76 / PR #419](https://github.com/SimonShaun2/Renvani/pull/419), preserving required compatibility paths and the service-specific schemas proposed there. This documentation slice leaves templates, configuration code and secret values unchanged. No filled environment files are included.

## 5. Existing CI evidence preserved

GitHub run/job metadata was fetched on the observation date. These records belong to the indicated source heads and do not transfer approval to this new documentation branch.

| PR and exact source | Run | Verified metadata | Limit |
| --- | --- | --- | --- |
| [#419](https://github.com/SimonShaun2/Renvani/pull/419), `b2093ae9abe81f70ead48dea07fba69f2fc365ff` | [41623964451](https://github.com/SimonShaun2/Renvani/actions/runs/41623964451) | Successful primary and Neon jobs; build, secret scan, lint, cross-tenant tests, workspace tests and import wiring steps successful | FS-229 steps skipped. Step metadata alone does not prove optional database case execution. Runtime least privilege and rotation remain distinct evidence. |
| [#439](https://github.com/SimonShaun2/Renvani/pull/439), `935d37b0fa54f68b2ec88eb76ef6e4e30823c161` | [41950026870](https://github.com/SimonShaun2/Renvani/actions/runs/41950026870) | Primary and Neon jobs both **skipped** | No current-head CI pass. Existing earlier website CI remains historical, as recorded in #439. |

#419's source includes a secret-scan step absent from the inspected dev workflow; it remains PR-only work. No claim is made that it is integrated. The connector returns the first page of PR-triggered runs; this is a selected evidence check, not an exhaustive account history.

## 6. Documentation changes and handoff

| File | Correction |
| --- | --- |
| `docs/env/README.md` | Render/Neon direction, current runbook links and explicit template drift |
| `tickets/FSM-0010.md` | Current Codex/Platform coordination and founder-only exact-head merge approval |
| `docs/planning/PRODUCTION-DEPLOYMENT.md` | Historical status and current alternatives; preserved original plan |
| `docs/infrastructure/FS-83-critical-services-inventory.md` | Historical scope/count/auth/domain annotation with current source maps |
| `docs/infrastructure/NEON-PER-PR-CI.md` | Actual-checkout evidence requirement; remove unsupported PR-head-only assertion |

**Validation:** source paths and workflow predicates inspected; existing runs checked read-only; local documentation/link checks recorded in the build execution ledger. Existing env-validator failure is explicitly retained as a finding. No workflow, branch protection, provider configuration, credential, migration or production state changed. Remaining Platform tasks are the two runtime-version corrections, checkout-evidence policy, template/validator reconciliation with #419, and actual least-privilege/rotation acceptance. They do not block publishing this bounded assessment.
