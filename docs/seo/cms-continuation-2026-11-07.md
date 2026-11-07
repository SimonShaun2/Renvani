# SEO implementation continuation: CMS reliability and publication preflight

Date: November 7, 2026. Parent: #460. Related: #462, #463.

## Status and execution contract

The founder reports the sitemaps updated. Record this account-side step as **founder-reported complete**, not independently verified Google processing or indexing. Do not ask for the same submission again. The live sitemap index returned HTTP 200 in this execution and advertises six split sitemap URLs. No authenticated Search Console performance or indexing data was read.

Base: `dev` at `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`. This is a separate feature patch, not a change to PR #461 (`475d3789be0c0c1b67a94693a8daf9cd415adc0f`), which remains draft/unmerged. Target: draft PR to `dev`; no protected-branch push, independent-review claim, batch-CI dispatch, merge, or production release.

File split: runtime changes are limited to the existing CMS metadata helper, existing blog metadata function, existing CMS fetch adapter and a new sanitized read-result helper. Tests and the read-only editorial command are separate files. No database, auth, pricing, DNS, UI layout or external tracking changes. Existing blog JSX is byte-for-byte unchanged. No Figma screen is invented or replaced.

## Implemented behavior

1. Blog index metadata uses the existing production-only marketing guard. Article/comparison metadata explicitly emits index/follow only when the existing production-origin resolver succeeds, and noindex/nofollow otherwise. The legacy relative canonical fallback remains for compatibility. Canonical slugs, article schema, image data and author/date fields are unchanged.
2. A configured CMS read failure throws `CmsReadError` instead of returning an empty list or null. The adapter logs only a stable error code, not provider messages, URLs, slugs or tokens. Successful null/empty responses and an unconfigured CMS retain the existing empty/missing behavior. Published perspective, server-only read-token handling and 60-second cache tags are preserved.
3. `scripts/seo/content-preflight.mjs` inspects a supplied JSON array or NDJSON editorial export without connecting to or writing to the CMS. It detects invalid/duplicate route slugs, missing title/description/readable body, missing image alternatives, unsafe links/CTAs and date problems. A published document and its own draft are not flagged as a duplicate. Release-version records are labeled separately. Author and metadata gaps are warnings as documented by issue codes.

The preflight does **not** establish that a draft is approved or published, does not fetch link destinations and does not review factual/product claims. Future `publishedAt` values only produce warnings: they do not create a scheduling mechanism. No live article inventory, publication, or navigation work is represented as complete.

## Verification executed

- Node 22.16.0, repository source modules transpiled using TypeScript 5.8.3 with provider/JSX mocks: **47 runtime checks passed**.
- Node read-only publication-preflight tests: **30 passed**.
- Combined result: **77 passed, 0 failed**.
- Strict TypeScript with noUncheckedIndexedAccess on the standalone read-result helper: passed.
- The three modified originals and unchanged local test dependencies were verified against their Git blob hashes before patching. The runtime checker executes the real changed source, not a parallel implementation.

These are bounded local checks. The new repository Vitest integration suite is provided but **not executed here**. Full app typecheck, approved batch CI, Next.js build, real browser/HTTP error-path acceptance, and independent review remain release gates. A green automatic preview build, when available, does not replace them.

## Commands

From the repository root after installing its dependencies:

```sh
node --test scripts/seo/cms-reliability.test.mjs scripts/seo/content-preflight.test.mjs
node scripts/seo/content-preflight.mjs /secure/path/editorial-export.ndjson
pnpm --filter @fsm/web exec vitest run src/sanity/cms-reliability.test.ts src/sanity/sanity-cms.test.tsx src/lib/seo/marketing-metadata.test.ts
```

The portable module checker resolves the repository TypeScript dev dependency; `TYPESCRIPT_PATH` is an optional local-validation override. The preflight needs only Node. Exit 0 means no detected structural blockers, exit 1 means blockers, exit 2 means invalid/unreadable input. Keep source exports and reports out of the repository unless explicitly approved and scrubbed; run against the existing authorized content rather than creating a new duplicate backlog.

## Preserved limitations and next acceptance

The existing sitemap builder intentionally catches CMS failures and falls back to marketing URLs plus `/blog`; that behavior is unchanged. This patch prevents false empty/not-found handling in CMS page reads, not every possible sitemap or upstream failure. Invalid CMS project settings continue to use the existing disabled-CMS behavior. Robots directives are not authentication or data protection.

Before release, run the existing CMS, metadata, robots and sitemap suites and the new integration suite in an approved batch. Verify preview noindex, production canonical/index metadata, a real configured-provider failure versus a genuine missing article, cached-page behavior and unchanged presentation. Independent reviewers must inspect the exact commit. Founder approval must name the PR and reviewed head. After authorized release, inspect live HTML and record production deployment evidence.

Next work: obtain the existing authorized Sanity/Notion content inventory; run editorial preflight plus factual/feature-availability review; publish a small approved article batch and add Figma-matched crawlable navigation/internal links. Keep analytics validation (#464) and measured mobile performance (#465) separate. Do not claim organic traffic or ranking gains without account evidence.

## Reference guidance

- Google robots metadata: https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag
- Google sitemap guidance: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap

## Rollback

Revert only this scoped feature commit through normal review/release gates. No migration is involved. Preserve unrelated work, PR #461 and current domain verification records.
