# Dependency baseline and scanner handoff

**Build specification 9. Source baseline complete; current advisory/license acceptance remains open.**

Snapshot: **b45b4996b64b16859e44a79b171b11cbe52c3e6a**, the inspected `dev` source on **2026-11-05 UTC**. This is the bounded source deliverable from [build specification 9](https://app.notion.com/p/40f317b92d158157997dcb3a1266058e), linked to [legacy issue #9 / FSM-0008](https://github.com/SimonShaun2/Renvani/issues/9). It does not close that issue or create a successor FS ticket. The founder authorized this current slice; the historical nine-workspace assumption is not used.

The complete [machine-readable baseline](dependency-baseline.json) records every direct declaration, exact lockfile resolution including peer context, class, manifest source, workspace link, input hash, multi-version package and literal vendor import. Its manifest/importer reconciliation found **0 missing or mismatched declarations**. No dependency, manifest, lockfile, runtime or CI setting was changed.

## 1. Measured source baseline

| Measure | Count |
| --- | ---: |
| Root + child manifests | 13 |
| Child workspaces | 12: 4 apps + 8 packages |
| Direct declarations | 176 |
| Runtime declarations (`dependencies`) | 112 |
| Development declarations (`devDependencies`) | 64 |
| Direct optional / peer declarations | 0 / 0 |
| External declarations / workspace links | 139 / 37 |
| Unique direct names / external direct names | 79 / 71 |
| Distinct external direct name/version pairs | 72 |
| External names declared by multiple workspaces | 17 |
| Lockfile package records / package names | 818 / 735 |
| Lockfile names with multiple resolved versions | 59 |
| Recorded lockfile deprecation notices | 16 |

Denominators come from [workspace configuration](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/pnpm-workspace.yaml), all 13 manifests below and [the lockfile](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/pnpm-lock.yaml). Lockfile entries include platform-specific and transitive records; **818 is not a count of packages installed in a particular deployment**. A repeated declaration or multiple peer context does not by itself establish a compatibility defect.

## 2. Runtime and toolchain requirements

[Root metadata](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/package.json) pins **Node 22.16.0** and **pnpm 10.0.0**. All 12 children report package version `0.0.0`; none declares a separate Node engine. The lockfile resolves TypeScript **5.9.3**, Vitest **3.2.4**, `@types/node` **24.12.2**, and ESLint **8.57.1**. Node 24 type definitions on a Node 22 runtime are a compatibility review item: a successful type check alone does not establish that every typed Node API exists on the required runtime.

The general batch workflow currently configures Node 20, while narrow conditional PostgreSQL steps configure 22.16.0. That source discrepancy and its proposed correction belong to [CI/environment state](CICD-STATE.md). This audit changes neither the runtime nor the workflow. SDK engine declarations are lockfile metadata, not evidence that a deployed process uses the configured version.

## 3. All direct declarations

`Runtime` and `Development` below describe manifest placement, not observed production reachability. Workspace links resolve to local package source at this commit, all declaring version `0.0.0`. External versions are the lockfile's resolved package versions; the JSON preserves the complete peer-qualified resolution. **License, current advisory status and latest upstream version are UNVERIFIED for every row.**

### fsm-platform

Source: [package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/package.json). 6 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `@typescript-eslint/eslint-plugin` | Development | `^7.0.0` | `7.18.0` |
| `@typescript-eslint/parser` | Development | `^7.0.0` | `7.18.0` |
| `eslint` | Development | `^8.57.0` | `8.57.1` |
| `turbo` | Development | `^2.0.0` | `2.9.6` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |

### @fsm/api

Source: [apps/api/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/package.json). 38 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@aws-sdk/client-s3` | Runtime | `^3.931.0` | `3.1038.0` |
| `@clerk/backend` | Runtime | `^1.34.0` | `1.34.0` |
| `@fastify/cors` | Runtime | `11.0.0` | `11.0.0` |
| `@fastify/jwt` | Runtime | `^9.0.0` | `9.1.0` |
| `@fastify/multipart` | Runtime | `^9.2.1` | `9.4.0` |
| `@fastify/rate-limit` | Runtime | `^10.3.0` | `10.3.0` |
| `@fsm/ai` | Runtime | `workspace:*` | workspace `packages/ai` @ `0.0.0` |
| `@fsm/comms` | Runtime | `workspace:*` | workspace `packages/comms` @ `0.0.0` |
| `@fsm/config` | Runtime | `workspace:*` | workspace `packages/config` @ `0.0.0` |
| `@fsm/db` | Runtime | `workspace:*` | workspace `packages/db` @ `0.0.0` |
| `@fsm/import-engine` | Runtime | `workspace:*` | workspace `packages/import-engine` @ `0.0.0` |
| `@fsm/import-normalize` | Runtime | `workspace:*` | workspace `packages/import-normalize` @ `0.0.0` |
| `@fsm/jobs` | Runtime | `workspace:*` | workspace `packages/jobs` @ `0.0.0` |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `@js-temporal/polyfill` | Runtime | `^0.5.1` | `0.5.1` |
| `@sendgrid/mail` | Runtime | `^8.1.5` | `8.1.6` |
| `bcryptjs` | Runtime | `^3.0.2` | `3.0.3` |
| `date-fns` | Runtime | `^4.1.0` | `4.1.0` |
| `decimal.js` | Runtime | `^10.5.0` | `10.6.0` |
| `drizzle-orm` | Runtime | `0.44.2` | `0.44.2` |
| `fastify` | Runtime | `^5.5.0` | `5.8.5` |
| `fastify-plugin` | Runtime | `^5.0.1` | `5.1.0` |
| `jsonwebtoken` | Runtime | `^9.0.2` | `9.0.3` |
| `papaparse` | Runtime | `^5.5.3` | `5.5.3` |
| `pdf-lib` | Runtime | `^1.17.1` | `1.17.1` |
| `pino` | Runtime | `^9.4.0` | `9.14.0` |
| `sharp` | Runtime | `^0.34.5` | `0.34.5` |
| `stripe` | Runtime | `^17.0.0` | `17.7.0` |
| `twilio` | Runtime | `^5.9.0` | `5.13.1` |
| `zod` | Runtime | `^3.25.76` | `3.25.76` |
| `@types/jsonwebtoken` | Development | `^9.0.10` | `9.0.10` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `@types/papaparse` | Development | `^5.5.0` | `5.5.2` |
| `@types/supertest` | Development | `^6.0.3` | `6.0.3` |
| `supertest` | Development | `^7.1.1` | `7.2.2` |
| `tsx` | Development | `^4.19.1` | `4.21.0` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/web

Source: [apps/web/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/web/package.json). 42 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@clerk/nextjs` | Runtime | `^6` | `6.39.8` |
| `@dnd-kit/core` | Runtime | `^6.1.0` | `6.3.1` |
| `@dnd-kit/sortable` | Runtime | `^8.0.0` | `8.0.0` |
| `@fsm/config` | Runtime | `workspace:*` | workspace `packages/config` @ `0.0.0` |
| `@fsm/import-normalize` | Runtime | `workspace:*` | workspace `packages/import-normalize` @ `0.0.0` |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `@hookform/resolvers` | Runtime | `^3.3.4` | `3.10.0` |
| `@stripe/connect-js` | Runtime | `^3.4.6` | `3.4.6` |
| `@stripe/react-connect-js` | Runtime | `^3.4.4` | `3.4.4` |
| `@stripe/react-stripe-js` | Runtime | `^7.0.0` | `7.0.0` |
| `@stripe/stripe-js` | Runtime | `^10.1.0` | `10.1.0` |
| `@tanstack/react-query` | Runtime | `^5.0.0` | `5.100.6` |
| `class-variance-authority` | Runtime | `^0.7.0` | `0.7.1` |
| `clsx` | Runtime | `^2.1.0` | `2.1.1` |
| `date-fns` | Runtime | `^3.6.0` | `3.6.0` |
| `decimal.js` | Runtime | `^10.5.0` | `10.6.0` |
| `framer-motion` | Runtime | `^11.0.0` | `11.18.2` |
| `lucide-react` | Runtime | `^0.368.0` | `0.368.0` |
| `next` | Runtime | `^15.0.0` | `15.5.15` |
| `papaparse` | Runtime | `^5.5.3` | `5.5.3` |
| `qrcode.react` | Runtime | `^4.2.0` | `4.2.0` |
| `react` | Runtime | `^19.0.0` | `19.2.5` |
| `react-dom` | Runtime | `^19.0.0` | `19.2.5` |
| `react-hook-form` | Runtime | `^7.51.0` | `7.74.0` |
| `react-signature-canvas` | Runtime | `1.1.0-alpha.2` | `1.1.0-alpha.2` |
| `recharts` | Runtime | `^2.12.0` | `2.15.4` |
| `tailwind-merge` | Runtime | `^2.2.0` | `2.6.1` |
| `xlsx` | Runtime | `^0.18.5` | `0.18.5` |
| `zod` | Runtime | `^3.24.1` | `3.25.76` |
| `zustand` | Runtime | `^4.5.0` | `4.5.7` |
| `@testing-library/dom` | Development | `^10.4.2` | `10.4.2` |
| `@testing-library/react` | Development | `^16.3.3` | `16.3.3` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `@types/papaparse` | Development | `^5.5.0` | `5.5.2` |
| `@types/react` | Development | `^19.0.0` | `19.2.14` |
| `@types/react-dom` | Development | `^19.0.0` | `19.2.3` |
| `autoprefixer` | Development | `^10.4.21` | `10.5.0` |
| `happy-dom` | Development | `^21.0.4` | `21.0.4` |
| `postcss` | Development | `^8.5.6` | `8.5.12` |
| `tailwindcss` | Development | `^3.4.17` | `3.4.19` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/webhook

Source: [apps/webhook/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/webhook/package.json). 13 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@fsm/config` | Runtime | `workspace:*` | workspace `packages/config` @ `0.0.0` |
| `@fsm/db` | Runtime | `workspace:*` | workspace `packages/db` @ `0.0.0` |
| `@fsm/jobs` | Runtime | `workspace:*` | workspace `packages/jobs` @ `0.0.0` |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `decimal.js` | Runtime | `^10.5.0` | `10.6.0` |
| `drizzle-orm` | Runtime | `0.44.2` | `0.44.2` |
| `fastify` | Runtime | `^5.5.0` | `5.8.5` |
| `pino` | Runtime | `^9.4.0` | `9.14.0` |
| `stripe` | Runtime | `^17.0.0` | `17.7.0` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `tsx` | Development | `^4.19.1` | `4.21.0` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/worker

Source: [apps/worker/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/worker/package.json). 21 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@aws-sdk/client-s3` | Runtime | `^3.931.0` | `3.1038.0` |
| `@clerk/backend` | Runtime | `^1.34.0` | `1.34.0` |
| `@fsm/ai` | Runtime | `workspace:*` | workspace `packages/ai` @ `0.0.0` |
| `@fsm/comms` | Runtime | `workspace:*` | workspace `packages/comms` @ `0.0.0` |
| `@fsm/config` | Runtime | `workspace:*` | workspace `packages/config` @ `0.0.0` |
| `@fsm/db` | Runtime | `workspace:*` | workspace `packages/db` @ `0.0.0` |
| `@fsm/import-engine` | Runtime | `workspace:*` | workspace `packages/import-engine` @ `0.0.0` |
| `@fsm/import-normalize` | Runtime | `workspace:*` | workspace `packages/import-normalize` @ `0.0.0` |
| `@fsm/jobs` | Runtime | `workspace:*` | workspace `packages/jobs` @ `0.0.0` |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `bullmq` | Runtime | `^5.0.0` | `5.76.2` |
| `decimal.js` | Runtime | `^10.5.0` | `10.6.0` |
| `drizzle-orm` | Runtime | `0.44.2` | `0.44.2` |
| `papaparse` | Runtime | `^5.5.3` | `5.5.3` |
| `pino` | Runtime | `^9.4.0` | `9.14.0` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `@types/papaparse` | Development | `^5.3.16` | `5.5.2` |
| `tsx` | Development | `^4.19.1` | `4.21.0` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |
| `xlsx` | Development | `^0.18.5` | `0.18.5` |

### @fsm/ai

Source: [packages/ai/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/ai/package.json). 6 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@fsm/config` | Runtime | `workspace:*` | workspace `packages/config` @ `0.0.0` |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `pino` | Runtime | `^9.4.0` | `9.14.0` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/comms

Source: [packages/comms/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/comms/package.json). 4 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `resend` | Runtime | `^4.8.0` | `4.8.0` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/config

Source: [packages/config/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/config/package.json). 9 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@aws-sdk/client-s3` | Runtime | `^3.931.0` | `3.1038.0` |
| `@aws-sdk/s3-request-presigner` | Runtime | `3.1038.0` | `3.1038.0` |
| `@fsm/import-engine` | Runtime | `workspace:*` | workspace `packages/import-engine` @ `0.0.0` |
| `@fsm/import-normalize` | Runtime | `workspace:*` | workspace `packages/import-normalize` @ `0.0.0` |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `zod` | Runtime | `^3.25.76` | `3.25.76` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/db

Source: [packages/db/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/db/package.json). 10 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@fsm/config` | Runtime | `workspace:*` | workspace `packages/config` @ `0.0.0` |
| `@fsm/import-normalize` | Runtime | `workspace:*` | workspace `packages/import-normalize` @ `0.0.0` |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `decimal.js` | Runtime | `^10.5.0` | `10.6.0` |
| `drizzle-orm` | Runtime | `0.44.2` | `0.44.2` |
| `postgres` | Runtime | `3.4.5` | `3.4.5` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `drizzle-kit` | Development | `0.31.1` | `0.31.1` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/import-engine

Source: [packages/import-engine/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/import-engine/package.json). 7 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `papaparse` | Runtime | `^5.5.3` | `5.5.3` |
| `xlsx` | Runtime | `^0.18.5` | `0.18.5` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `@types/papaparse` | Development | `^5.3.16` | `5.5.2` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/import-normalize

Source: [packages/import-normalize/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/import-normalize/package.json). 5 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `decimal.js` | Runtime | `^10.5.0` | `10.6.0` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/jobs

Source: [packages/jobs/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/jobs/package.json). 9 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `@fsm/config` | Runtime | `workspace:*` | workspace `packages/config` @ `0.0.0` |
| `@fsm/types` | Runtime | `workspace:*` | workspace `packages/types` @ `0.0.0` |
| `bullmq` | Runtime | `^5.0.0` | `5.76.2` |
| `ioredis` | Runtime | `^5.4.0` | `5.10.1` |
| `pino` | Runtime | `^9.4.0` | `9.14.0` |
| `zod` | Runtime | `^3.25.76` | `3.25.76` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

### @fsm/types

Source: [packages/types/package.json](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/types/package.json). 6 declarations.

| Dependency | Class | Requested | Resolved source/version |
| --- | --- | --- | --- |
| `zod` | Runtime | `^3.25.76` | `3.25.76` |
| `@fsm/config` | Development | `workspace:*` | workspace `packages/config` @ `0.0.0` |
| `@fsm/import-normalize` | Development | `workspace:*` | workspace `packages/import-normalize` @ `0.0.0` |
| `@types/node` | Development | `^24.3.0` | `24.12.2` |
| `typescript` | Development | `^5.9.2` | `5.9.3` |
| `vitest` | Development | `^3.2.4` | `3.2.4` |

## 4. Version differences and follow-up priority

| Source observation | What it establishes | Follow-up |
| --- | --- | --- |
| `date-fns`: API `^4.1.0` → `4.1.0`; web `^3.6.0` → `3.6.0` | The only direct external name resolving to different versions across workspaces | Review shared date/time boundaries before any unification; do not infer that historical FS-2 failures have returned |
| `zod`: web `^3.24.1`, other consumers `^3.25.76`, all → `3.25.76` | Different declarations, one direct resolved version | Harmonize only if a future scoped maintenance change warrants it |
| `@types/papaparse`: API/web `^5.5.0`, worker/import-engine `^5.3.16`, all → `5.5.2` | Different declarations, one direct resolved version | Review alongside import code changes rather than creating an ungrounded runtime bug |
| Clerk backend `1.34.0` and `2.33.8` exist in the lockfile | Direct API/worker SDK generation differs from the web SDK's transitive generation | Validate the relevant auth contracts during a coordinated upgrade; no auth change in this slice |
| 59 names have multiple lockfile versions, including AWS/Smithy, esbuild, postcss and date-fns | A reproducible multi-version list exists in `lockfileMultipleVersions` | Use scanner paths and actual consumers to prioritize; deduplication is not automatically safe |
| 16 packages carry recorded deprecation messages | The lockfile contains upstream metadata captured at resolution time | Confirm current upstream guidance and advisory applicability before action |

The full 59-name/version list and all 16 messages are preserved in the JSON. Notices include the direct ESLint/Recharts versions and transitive Clerk, Smithy retry and structured-clone packages. These notices are **not fresh advisory findings** and are not assigned an invented severity. Current CVE/GHSA status, fixed versions, exposure and license conclusions remain unverified.

## 5. Vendor and integration consumers

The `vendorSdkConsumers` appendix lists exact literal import paths and line anchors, excluding test imports. Type-only references can appear in that list. It is a source binding inventory, not evidence of a network call or a complete runtime call graph.

| Provider/dependency | Declared consumers and observed boundary |
| --- | --- |
| Clerk: `@clerk/backend` 1.34.0; `@clerk/nextjs` 6.39.8 | API auth verifier ([source](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/src/lib/clerk-auth.ts)); worker workspace provisioning ([source](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/worker/src/processors/clerk-workspace.processor.ts)); web middleware/server session, Clerk UI/provider and workspace components |
| Stripe: server `stripe` 17.7.0 | API Stripe/settings/saved-card adapters; webhook client and signature verification; additional typed service/handler consumers listed in JSON |
| Stripe browser libraries: connect-js 3.4.6, react-connect-js 3.4.4, react-stripe-js 7.0.0, stripe-js 10.1.0 | [Connect component](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/web/src/components/stripe/StripeConnectEmbedded.tsx) and [embedded checkout component](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/web/src/components/stripe/StripeEmbeddedInvoiceCheckout.tsx) |
| Resend 4.8.0 | Declared by `@fsm/comms`; [adapter](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/comms/src/resend-email.adapter.ts) consumed through the shared communications boundary |
| SendGrid `@sendgrid/mail` 8.1.6 | Declared by API; [outbound email module](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/src/lib/outbound-email.ts); provider selection is a separate source/runtime question |
| AWS S3 client/presigner 3.1038.0 | Client declared by API, worker and config; presigner by config. Literal shared SDK boundary: [R2 provider](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/config/src/object-storage/r2-provider.ts) |
| Twilio 5.13.1 | Declared by API. No literal import of the SDK in the inspected non-test app/package source; [SMS module](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/apps/api/src/lib/sms.ts) resolves the shared registry and uses the disabled-policy path unless a provider is live. A declaration is not proof that sending is enabled |
| OpenAI | No direct `openai` package declaration. Revenue, campaign and import prompt modules call the Responses endpoint with `fetch`; see [representative source](https://github.com/SimonShaun2/Renvani/blob/b45b4996b64b16859e44a79b171b11cbe52c3e6a/packages/ai/src/prompts/revenue-prompts.ts). Environment/provider availability is not verified here |

Detailed outbound/provider controls and the open #430/#431 work are recorded in [worker inventory](WORKER-INVENTORY.md). This report performs no provider calls.

## 6. Reproducible two-scanner handoff

**Execution status: not run.** This package completes the source baseline; it does not claim a clean vulnerability or license audit. Run both independent tools against the same source SHA and lockfile hash, using a disposable checkout with Node **22.16.0**, pnpm **10.0.0**, and an approved, explicitly versioned OSV-Scanner v2 binary. Record the OSV release and binary checksum before execution. No current scanner version is asserted by this report.

1. Record commit, UTC timestamp, Node/pnpm/scanner versions, lockfile SHA-256, registry/OSV endpoints and any intentional exclusions.
2. Use a frozen install in the isolated checkout when installed metadata is required. Disable lifecycle scripts for the metadata-only audit: `corepack pnpm install --frozen-lockfile --ignore-scripts`. Do not run `audit --fix`, upgrades or automatic remediation.
3. Run the pnpm registry audit and OSV lockfile scan independently. Preserve stdout, stderr and actual exit codes. A request/registry failure is an incomplete scan, never a zero-findings result. pnpm and OSV are different scanner paths, although advisory databases can overlap; deduplicate shared CVE/GHSA aliases after preserving both raw reports.

```sh
git rev-parse HEAD
sha256sum pnpm-lock.yaml
node --version
corepack pnpm --version
osv-scanner --version

corepack pnpm audit --json > /tmp/renvani-pnpm-audit.json
osv-scanner scan source --lockfile=pnpm-lock.yaml --format=json --output-file=/tmp/renvani-osv-audit.json
corepack pnpm licenses list --json > /tmp/renvani-licenses.json
```

The commands are a handoff, not execution evidence. The `/tmp` paths are temporary outputs; preserve completed reports with the reviewed evidence packet. Do not enable `--ignore-registry-errors`, suppress unresolved findings or treat a nonzero vulnerability exit as a tool malfunction without reading its result.

For licenses, match the installed package/version list back to this lockfile and check actual package license text/notice obligations when metadata is absent, conflicting or nonstandard. For each direct external dependency, record the retrieval date and upstream latest version separately from the locked version; do not substitute the latest release for the version actually scanned. Current license and latest-version fields remain explicitly unverified until these lookups are completed.

Primary command references checked on 2026-11-05 UTC: [pnpm 10 audit](https://pnpm.io/10.x/cli/audit), [pnpm 10 license listing](https://pnpm.io/10.x/cli/licenses), [OSV source scan](https://google.github.io/osv-scanner/usage/scan-source), [OSV output flags](https://google.github.io/osv-scanner/usage/), and [OSV supported lockfiles](https://google.github.io/osv-scanner/supported-languages-and-lockfiles/). These references validate command syntax and supported inputs, not this repository's security status.

## 7. Acceptance and risk disposition

| Required evidence | State |
| --- | --- |
| Every manifest declaration matched to lockfile importer, range, resolution and class | **Complete: 176/176** |
| Workspace links resolve to the named local manifest | **Complete: 37/37** |
| Multiple versions/ranges, SDK consumers and toolchain requirements | **Complete as source evidence** |
| Current registry vulnerability scan | **Not run** |
| Independent OSV scan | **Not run** |
| Dated license / latest-version verification | **Unverified** |
| Assessed high/critical exposure and remediation evidence | **Not assessed** |

When scanner results exist, retain the scanner's severity verbatim, then separately assess reachable code, production versus development exposure, input control, deployment configuration, compensating controls and impact. A high/critical scanner label and demonstrated exploitability are separate fields. Each unresolved finding needs an owner, source path, affected version, proposed fix/mitigation, verification and dated disposition. Do not lower scanner severity merely because a package is a development dependency.

The complete legacy #9 acceptance still needs both current scans, dated license evidence and assessed findings. This source package is ready for independent review; it does not authorize dependency updates or mark the wider ticket Done.

## 8. Reproduction and integrity

Enumerate tracked `package.json` files matching `apps/*` and `packages/*` plus root; read all four dependency classes; parse `pnpm-lock.yaml` with a YAML parser; match each manifest key to the same importer's class and specifier; retain the full `version` value; resolve `link:` targets to their manifest and verify the package name. Group external resolutions by base package version, preserving peer context separately. Group lockfile `packages` keys by name for the 59-name list. Count only tracked source inputs at the recorded SHA.

The JSON includes SHA-256 and Git blob IDs for each manifest and the lockfile, exact source URLs, the generation timestamp and explicit unverified external-evidence fields. Structural validation checked 13 importers, all 176 declarations, all 37 targets and all external package keys. The original manifest and lockfile bytes were rechecked after generation.
