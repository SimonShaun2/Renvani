# The Renvani Playbook: implementation and release handoff

Date: November 7, 2026. Refs #460 and #463.

## Decision and scope

Founder approved Resources as the navigation label and The Renvani Playbook as the resource hub. Base: dev at 66a0fa31017ade94ea2c66b33c3cdf89b7fef3dc, including merged CMS reliability PR #466. This change adds /resources, three useful template detail pages and editable plain-text downloads, published-article discovery, desktop/mobile/footer links, blog return navigation, canonical metadata and sitemap coverage. Existing /blog/:slug URLs and CMS publication controls remain unchanged.

New templates: estimate follow-up message kit; daily dispatch checklist; job closeout and next-visit checklist. They are office workflow aids, not technical trade instructions, legal advice, guaranteed business outcomes or evidence that a product feature has shipped. All template contents are visible without a form or account. Downloads contain the same text, not a placeholder or fake PDF.

## Content provenance and publication

The existing Renvani-Blog-Complete-Collection was located: 39 complete editorial drafts, marked NOT PUBLISHED and reviewed November 6. Related estimate follow-up, dispatch and estimate-template drafts informed this small toolkit. The draft collection is not bundled into the website and no Sanity document was published or modified. Published articles are obtained using the existing fetchCmsList('post') published-perspective reader. Article cards preserve the /blog/:slug path and reject malformed/duplicate slugs. Articles appear as they become available in the published CMS list; an empty list does not fabricate articles.

A configured CmsReadError leaves the static toolkit usable and displays an explicit articles-unavailable notice. Unexpected programming errors still propagate. No claim is made about current production CMS inventory from an empty preview.

## Design and component reuse

Inspected Figma file jiGHTNUJNltWbHA4Il3hk7, website page 171:2, and retrieved design context plus screenshot for marketing navigation 203:4394. Reused the current marketing palette/font variables, logo references, HeaderDisclosure, MenuFooter and products-menu stylesheet. The hub is a new composition extending that design system, not a claim of exact parity with a pre-existing approved Playbook frame. The new menu uses a semantic data-node-id, not a fabricated Figma node ID. Desktop nav spacing and footer wrapping are adjusted to accommodate Resources. Existing Products and Industries menus retain their implementations.

## File and behavior boundaries

- Resources page: server content fetch, production-only SEO metadata, useful static fallback.
- ResourceLibrary: client search/format enhancement over server-rendered real links; accessible labels, results status and empty-state reset. No query-string indexing expansion or analytics added.
- Template pages: catalog-backed static params, missing-page 404, relevant product links, readable full text.
- Downloads: strict catalog lookup, text/plain attachment, noindex and nosniff. No filesystem or user-supplied data access.
- route-access.ts: explicit /resources plus only /resources/templates/<kebab-slug> and its /download child. No broad /resources/** bypass and no private role/tenant/cookie changes. This allowlist expansion requires security-by-risk review.
- Sitemap: hub and three detail pages only; download variants excluded. Existing CMS and tenant sitemap behavior unchanged.
- Blog: Articles & Guides naming and a Playbook return path, preserving all article URLs.

No DNS, payment, database, dependency, CI-workflow, tracking-consent, or CMS-write change.

## Verification executed locally

1. Original contents of all six modified files matched their Git blob hashes at the pinned base before editing.
2. 37 portable source/runtime checks passed, zero failed, using Node 22.16.0 and the installed TypeScript transpiler. The harness executes changed modules, real unchanged origin/metadata helpers, mock CMS/JSX dependencies and mocked React hook state. This is scoped evidence, not full React or Next.js integration.
3. Strict TypeScript with noUncheckedIndexedAccess passed for the pure catalog and route-access modules.
4. Syntax transpilation of all 13 TS/TSX files in this change completed without syntax diagnostics.
5. An isolated HTML/CSS layout harness of the new page was checked at widths 1440, 768, 390 and 320: one H1, three initial cards and no horizontal overflow. It used fallback fonts and icon stubs and excluded the shared navigation, so it is not actual deployed browser acceptance or Figma screenshot parity.

Commands in a fully installed checkout:

    node --test scripts/seo/playbook.test.mjs
    pnpm --filter @fsm/web exec vitest run src/lib/resources/playbook.test.ts
    pnpm --filter @fsm/web lint
    pnpm --filter @fsm/web build

The portable script uses the repository TypeScript dependency. TYPESCRIPT_PATH and PLAYBOOK_TEST_DEPENDENCIES are optional isolated-harness overrides; they are not production environment configuration.

## Release gates still required

Draft PR to dev only. Do not treat local green checks or an automatic Vercel preview as independent approval. Run an approved exact-head batch, independent peer/QA/security review, full app typecheck and existing navigation/robots/sitemap/CMS regressions. No direct protected-branch push or production promotion from this implementation request alone.

Preview acceptance: anonymous /resources and all three detail pages 200, valid downloads 200 text/plain with attachment/noindex, unknown template and download 404, Resources visible in desktop/mobile/footer, published article links preserve their paths, no draft leak, and preview noindex/disallow remain intact. Test real browser search/filter/reset, dropdown keyboard/Escape/outside-click behavior, small-screen nav and real font/icon rendering.

After separately authorized release: verify deployment commit and /resources metadata/canonical, sitemap inclusion, crawlable navigation links, and unchanged protected routes. Google indexing and ranking are separate outcomes; no guarantee is claimed.

## Remaining hub roadmap

Editorial review and staged publication of existing blog drafts; outcome/trade filtering when content metadata supports it; curated contextual links on relevant industry/product pages; calculators and videos when genuinely available; customer evidence only with documented results and permission. No empty Research/Academy/Stories sections are launched here.

Rollback: revert this scoped change through normal review/release controls. No data migration or CMS publication reversal is involved.
