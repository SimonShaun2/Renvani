# Website launch foundations — first implementation slice

Founder approval: November 6, 2026. PR #451, branch `build/website-launch-foundations`, based on dev `8d01e752377d2401cb2c6cdf235aa8dcbdde0aeb`.

## Implemented scope

- FS-286: per-route canonical metadata, Organization/SoftwareApplication JSON-LD with markup escaping, explicit Vercel preview/custom-environment indexing protection, reuse of existing split sitemap and opt-in shop registries.
- FS-288: remove surcharge wording from the active pricing presentation and fee FAQ. No billing/payment behavior changes.
- FS-294: explain subscription-only savings using existing prices: $600/month on month-to-month billing or $6,000/year with both plans billed annually. Keep 5% customer-paid Service Fee, Flat alternative, processing/tax distinctions and no public Founding pricing.
- FS-298: the 14 advertised trades plus Other on both public lead forms. Shared marketing-only validation supports those classifications; application tenant trade rules remain unchanged. No migration is necessary for the existing varchar fields.

## Preserved

Approved layout/CSS, product offerings/navigation, flagship and supporting-tool organization, actual feature screenshots, seven-field forms, validation-retry value preservation, rate limiting, honeypots, messaging consent and payment safeguards. Central pricing-config remains byte-identical to the approved base. Existing metadata titles/descriptions remain.

## Release dependencies

Deploy the updated API/shared marketing validator before publishing the expanded web dropdown. A web preview using the old production API is suitable for visual review, not valid end-to-end submission verification of new trade options. Do not create real prospect records to test this preview.

Build production with PUBLIC_SITE_URL=https://getrenvani.com. This patch deliberately keeps previews non-indexable even if that URL is inherited. Authenticated and transactional routes are not newly allowed. No production environment change, merge or promotion is part of this checkpoint.

Independent review and approved exact-head CI are still required. Test evidence and preview status are recorded in the PR; author checks are not independent acceptance.

## Remaining tickets

FS-287 legal pages, FS-289 Notion sync (issue #450), and FS-290 through FS-293 plus FS-295 through FS-297 and FS-299 remain separate work. Do not claim that all fourteen recommendations are completed. Privacy/Terms must reflect verified operating/legal details; Notion requires a server-side integration credential. Existing Neon form storage remains authoritative and working.
