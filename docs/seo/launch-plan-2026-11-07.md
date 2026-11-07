# Renvani SEO implementation and operating plan

Owner: founder / marketing. Parent: GitHub issue #460. Date: 2026-11-07.
Status: first implementation prepared for a draft PR; no production release or Search Console submission performed by this patch.

## Objective and scope

Acquire qualified home-service software buyers, initially HVAC, plumbing and electrical owners. Optimize for useful organic visits, completed qualified demos and eventual customers, not keyword density, a synthetic SEO score or promised rankings. Keep the approved Figma website and its honest launch-stage positioning. Renvani is the software vendor, not a local HVAC contractor.

First-patch delivery: search-only copy for the homepage, 14 industry landing pages and 22 product pages; WebSite identity on the homepage; industry BreadcrumbList matching the existing visible hierarchy; portable unit tests and repository integration tests. Existing canonical, robots, sitemap and preview noindex policies remain unchanged. Product descriptions still come from the approved registry; the customer portal title retains its preview qualification. There are no new features, prices, ratings, customer counts, local offices or availability claims.

## Evidence collected before this patch

| Check | Observed result | Limit |
| --- | --- | --- |
| Ownership | Founder confirmed Google Search Console domain verification succeeded | Not evidence of indexing |
| Production | Vercel renvani-web, dev at 5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58, deployment dpl_5ZFFLy3FenRfUvULgdJwUZA3yFzr | Snapshot on 2026-11-07 |
| robots.txt | HTTP 200; public allow rules and explicit app/private path exclusions; both sitemap URLs advertised | A robots rule is not authentication or guaranteed deindexing |
| sitemap.xml | HTTP 200 XML listing marketing routes and /blog | Does not prove Google fetched/indexed them |
| sitemap-index.xml | HTTP 200; six child sitemap URLs listed | Not all six children audited in this session |
| sitemap/0.xml | HTTP 200; current marketing routes and /blog present | No individual blog article URL observed in this shard; not proof none exist anywhere |
| /industries/hvac | HTTP 200; correct self-canonical; index,follow; descriptive content and visible Industries / HVAC breadcrumb | Full site render/performance crawl not performed |
| HVAC head | Title was HVAC & Refrigeration · Renvani; global Organization/SoftwareApplication present, no matching BreadcrumbList | Patch addresses search copy/schema without layout changes |
| Discovery | No blog link observed in the inspected HVAC header/footer | Whole-site link inventory remains pending |
| Vercel analytics | Returned 0 recorded visitors/pageviews for normalized 2026-11-01T00:00:00Z–2026-11-07T00:00:00Z | Does not establish zero real traffic or enabled instrumentation |
| Search Console / GA4 | No authenticated reporting/submission access available in this session | Clicks, impressions, rankings, indexing and organic conversions are unavailable, not zero |

## Sprint 1: technical foundation and indexing

### SEO-01: search metadata and structured data — implementation in this PR

Acceptance: all 37 targeted pages have unique truthful titles; all 14 trade descriptions are distinct; product descriptions preserve approved copy; same canonical paths; no preview indexing; WebSite publisher resolves to the existing Organization identity; breadcrumb matches visible labels; JSON is serialized safely. No changes to protected app routes, pricing, DNS, database or consent state.

Local evidence: 62/62 dependency-free tests passed under Node v22.16.0. The pure helper passed TypeScript 5.8.3 strict checking with noUncheckedIndexedAccess. All five changed/new TS/TSX files passed syntax transpilation. These are NOT a full app typecheck, build, browser test, independent review or approved batch CI.

Commands from repository root:

```sh
node --experimental-strip-types --test scripts/seo/search-foundation.test.mjs
tsc --noEmit --strict --noUncheckedIndexedAccess --target ES2022 --module ESNext --lib ES2022,DOM apps/web/src/lib/seo/search-foundation.ts
```

Use the repository's existing package manager and approved batch runner for `apps/web/src/lib/seo/search-foundation.test.ts`, existing marketing metadata/sitemap/robots tests, app typecheck and production build. Do not add a competing CI workflow or dispatch standalone CI. Independent peer/QA/security-by-risk review and founder approval of the named PR and exact reviewed head are required. A draft PR or passing portable tests does not authorize merging.

After authorized release, inspect raw HTML for /, all industry/product URLs and a nonexistent slug. Confirm one page title, correct canonical, index/follow on production, 404 for missing routes, valid JSON-LD and no visual regression. Verify preview with authentication where required remains noindex. Record deployment ID and actual inspected head.

### SEO-02: Search Console submission and indexing — account-dependent

Select the verified Domain property `getrenvani.com`. Submit the already-live `https://getrenvani.com/sitemap.xml` in Sitemaps and record the submission status/date. This root sitemap was fetched successfully in the audit. Audit all children before relying solely on the sitemap index; investigate invalid/non-200 shards rather than submitting blindly. Sitemaps are already advertised through robots.txt but UI/API submission has not been performed here.

Inspect /, /industries/hvac, /industries/plumbing, /industries/electrical, /pricing, /product/online-booking and /product/scheduling-dispatch. Check live URL fetch, robots/noindex, Google-selected canonical and indexed status. Request indexing through the authorized Search Console UI for priority URLs where appropriate. Record requests separately from actual indexing. Do not use job/live-stream indexing endpoints to push ordinary SaaS pages or repeatedly resubmit the same URLs.

Capture an initial dated baseline, including legitimate exclusions and reporting delays. Google controls crawling/indexing and may choose another search-result title. Neither a sitemap nor schema guarantees indexing, ranking or a rich result.

## Sprint 2: content discovery and buyer-intent coverage

### SEO-03: publish and connect the existing content backlog — editorial/CMS-dependent

Inventory existing Sanity documents and the previously drafted article set before writing new posts. For each article record canonical slug, intended reader, target question, source-backed claims, author/reviewer, status, related industry, related product, one primary next step and true publication/update dates. Resolve duplicates with one durable canonical; do not silently replace already-published URLs.

Verify the live blog and article routes before publishing. Publish only reviewed, source-backed copy with useful examples, an explicit answer near the beginning, readable headings, descriptive images/alt text and real bylines. Do not invent contractor outcomes or reuse prototype metrics as case studies. Confirm published documents appear in the sitemap, draft/preview documents do not, and empty/error content is not served as a misleading successful article.

Add a visible crawlable Resources/Blog entry using approved Figma navigation, not an unreviewed layout change. Connect each article to its industry page and the most relevant product page; link industry pages back to genuinely helpful guides. Link related articles contextually rather than building automated keyword-link walls. Preserve clear product limitations.

Initial topic-to-page map below is an editorial priority proposal, not a claim of measured keyword volume. Reuse existing matching drafts.

| Reader question / draft topic | Industry destination | Product destination | Useful original contribution |
| --- | --- | --- | --- |
| How to get more HVAC calls without paying for leads | /industries/hvac | /product/growth | Direct-booking channel checklist with clearly labeled example numbers |
| Google Business Profile checklist for plumbers | /industries/plumbing | /product/websites | Dated checklist verified against current Google policies |
| Local SEO for electricians | /industries/electrical | /product/websites | Service-area content and truthful business information examples |
| Does online booking increase home-service jobs? | Relevant trade | /product/online-booking | Explain requests versus confirmed appointments and how to measure |
| Missed calls are costing jobs | Relevant trade | /product/inquiry-response-follow-up | Response workflow and consent-aware follow-up examples |
| Why customers ghost estimates | Relevant trade | /product/revenue | Objection-specific, reviewed follow-up examples |
| How fast to follow up on an estimate | Relevant trade | /product/estimates-approvals | Practical timing choices, not unsupported universal conversion claims |
| Good/better/best HVAC replacement estimates | /industries/hvac | /product/price-book-service-catalog | Clearly labeled fictional scope comparison, no fabricated discounts |
| Estimate templates that win more jobs | Relevant trade | /product/estimates-approvals | Usable scope/exclusion/approval checklist without promised results |
| Dispatching tips to fit the day | Relevant trade | /product/scheduling-dispatch | Schedule scenario including travel, skills and customer promises |
| Fill the slow HVAC season | /industries/hvac | /product/retention | Consent-aware maintenance/rebooking calendar |
| Get more reviews without pressure | Relevant trade | /product/retention | Honest request flow checked against current platform rules |

Later comparison pages must use dated primary competitor sources, consistent comparison criteria and verified Renvani capabilities. Do not publish unsupported 'best', cheapest, feature-parity or competitor-price claims. Do not create mass city/trade combinations that do not add unique value. Quality, crawlability and factual clarity also support AI-assisted discovery; no special file or schema promises AI citations.

## Sprint 3: measurement and performance

### SEO-04: validate analytics and qualified-lead attribution — data/consent-dependent

First inspect existing tracking to avoid duplicate tags. Reuse the existing Renvani data-intelligence plan rather than creating a parallel warehouse/dashboard. Verify any existing GA4/Vercel instrumentation before adding a provider. Install no paid integration or secret without authorization. A Windsor.ai connector was discoverable for Search Console/GA4 reporting but is not connected; it does not establish submission capability.

Measurement contract:

| Event | Trigger | Meaning |
| --- | --- | --- |
| demo_cta_click | Intentional CTA activation | Interest, not a conversion |
| lead_form_start | First meaningful form interaction | Funnel diagnostic |
| generate_lead | Server-confirmed successful demo/lead acceptance; deduplicated once | Actual lead conversion |
| growth_check_requested | Successfully accepted Growth Check request | Distinct lead type |
| qualified_lead / customer | Reconciled CRM lifecycle change | Downstream outcome; define qualification with founder |

Only allow approved non-PII event fields: normalized route, CTA placement, trade, team-size bucket and consented channel attribution. Never send names, emails, phone numbers, addresses, raw form values, approval/payment tokens or arbitrary full URLs/query strings to analytics. Test validation failure, retry, double-submit, successful submit, reload, denied consent and preview traffic. Keep transactional lead processing independent from optional analytics consent. Verify events in the actual destination and reconcile with backend receipts before calling tracking complete.

Dashboard minimum: Search Console clicks/impressions/CTR/average position with source dates; branded versus nonbranded queries; page group; index exclusions; organic landing pages; real leads; qualified leads; demo completion and customers where reliable. Average position is not a guaranteed universal rank. Keep Search Console query/page aggregation and GA4 attribution differences explicit; don't sum incompatible totals. Never turn missing data into zeros.

### SEO-05: performance and rendering — baseline first

Measure representative homepage, HVAC, plumbing, electrical, scheduling/dispatch, blog and article pages on mobile and desktop using the existing browser/performance tools. Keep lab results distinct from field data. Set targets of LCP <=2.5s, INP <=200ms and CLS <=0.1 at the 75th percentile where sufficient field data exists; these are acceptance goals, not measured current scores or ranking promises.

Prioritize proven bottlenecks: image dimensions/responsive delivery, the actual LCP image, video preload/posters, unnecessary marketing-route JavaScript, third-party script cost, fonts and layout stability. Preserve accessibility, reduced-motion behavior, approved design and authentication. Do not remove Clerk/QueryProvider globally without separate app-risk review. Establish baseline and before/after evidence for each change rather than blanket minification or arbitrary redesign.

## SEO-06: reporting operation

A read-only Renvani SEO Health review was scheduled for Monday mornings, America/Chicago, beginning 2026-11-09. It checks public availability/metadata and compares evidence when available. Authenticated Search Console/GA4 metrics are included only after access exists. This is a scheduled health review, not continuous monitoring, a connected dashboard or an indexing guarantee. No unattended writes, merges or deployments are authorized by the reporting task.

## Release / handoff checklist

- First patch reviewed against current dev, with exact head recorded; no force push over unrelated work.
- Independent peer and QA results recorded; security review proportional to JSON-LD and public/private indexing risk.
- Approved batch runs existing SEO tests plus new integration tests, app typecheck/build and production-like HTML validation.
- Founder names PR and reviewed head for release authorization.
- After release, preserve snapshots of HTML, robots and sitemap evidence; rollback only the scoped change if needed using normal release gates.
- Search Console submission and index statuses recorded by an authorized operator; not inferred from verification.
- Editorial inventory, analytics validation and measured performance work tracked as pending until actual evidence exists.

## Primary implementation references

Google Search Central: descriptive titles (https://developers.google.com/search/docs/appearance/title-link), sitemap creation/submission (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap), breadcrumb data (https://developers.google.com/search/docs/appearance/structured-data/breadcrumb), site names (https://developers.google.com/search/docs/appearance/site-names), Core Web Vitals (https://web.dev/articles/vitals). Recheck current documentation when executing later tickets.
