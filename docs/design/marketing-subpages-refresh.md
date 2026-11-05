# Marketing subpage refresh — design preview

Founder request, November 5, 2026. Extends the curved cream/navy/amber homepage language to the marketing subpages. The five flagship products remain primary; FSM tools remain supporting capabilities.

## Scope

- Industries dropdown uses the exact Products menu CSS primitives: five icon cards, a navy accent card, compact secondary links and the shared footer. All fourteen industries remain available on desktop and mobile.
- Twenty-two product pages: five flagships and seventeen supporting tools. Each retains its registered route, metadata, unique story and original illustrative product canvas. Page copy and controls are now native responsive DOM; only the isolated example canvas is fitted.
- Fourteen industry pages use trade-specific records from the existing registry. Six use existing illustrative trade photographs. Others use native workflow examples rather than unrelated photography.
- How It Works follows the business goal, discovery, request, email/onsite estimate, confirmed job, field visit/payment and retention sequence. The existing five-product workflow tour is reused.
- Pricing, product directory and industry directory use the same responsive sections, curves, cards, FAQs and CTAs.
- Pricing configuration, form actions, routes, authentication, tenant boundaries, consent, payments, backend services and dependency versions are unchanged. Demo/Growth Check forms and the separate five-step /tour pages are not redesigned in this slice.

## Structural references

The founder supplied ServiceFusion scheduling/plumbing, ServiceTitan scheduling/HVAC, and Housecall Pro scheduling/electrical pages. Their sequence of outcome hero, product view, benefits, workflow explanation, related capabilities, FAQ and final CTA informed the information architecture. No competitor assets, copy, logos, testimonials, statistics or customer claims were copied.

## Canonical Figma references

File `jiGHTNUJNltWbHA4Il3hk7`, page `171:2`.

| Archetype | Desktop | Tablet | Mobile |
|---|---|---|---|
| Supporting product / Scheduling | 619:6004 | 619:6145 | 619:6282 |
| Flagship / Growth | 619:6385 | 619:6514 | 619:6639 |
| Industry / Electrical | 619:6766 | 619:6829 | 619:6888 |
| How It Works | 619:6947 | 619:7074 | 619:7197 |
| Pricing | 619:7322 | 619:7397 | 619:7468 |
| Industries menu | 621:7374 | 621:7429 | 621:7490 |

These are editable direction/archetype references, not a claim of exact final parity on every route. Native frame review and actual browser inspection informed implementation. Remaining design reconciliation includes the three-step workflow treatment, five-product card crosslinks, FAQ split layout and How It Works six-step story. Independent Design/Product acceptance is still required before merge.

Actual built-browser screenshot evidence is separately labeled in Figma: scheduling desktop `622:6372`, pricing mobile `622:6373`, electrical mobile `622:6374`, Industries menu desktop `622:6375`. These raster evidence frames do not replace editable design references.

## Verification at the candidate source tree

- Marketing render/unit suite: 185 tests passing across 11 files.
- Workspace dependencies build and web TypeScript check pass.
- Next.js optimized production build passes.
- Chromium browser sweep: 41 routes at 320, 390, 834 and 1440 px, 164 checks. No horizontal document overflow, missing visible images, broken in-page anchors, unresolved tokens, duplicate visible h1s, HTTP failures or page errors observed.
- Desktop and mobile Industries menus retain fourteen destination links. Desktop menu uses no photo-card treatment.
- Electrical workflow progression, Pause and manual step selection checked in normal motion. Reduced-motion pages were included in the responsive sweep.

The checks are author-run, not independent QA or approved repository batch CI. They do not certify every physical phone, Safari or Android browser version. Preview review, independent reviews, approved exact-head batch CI and founder approval remain required before merge and production release.

## Commercial copy

Existing pricing-config is the only source of prices. Flex $399/month and 2% customer-paid Service Fee, Flat $999/month with no customer-paid Service Fee, and existing program/annual disclosures are preserved. Illustrative subtotal $274 produces Flex fee $5.48 and total $279.48. Checkout panels collect no payment. Customer Portal remains explicitly Preview.

## Safety and scope

Marketing animations are illustrations, not live business actions. Public demo links and plan query parameters are preserved. No message, booking, job, invoice or payment mutation is introduced. No new telemetry, dependency, secret, auth exemption or network integration is added.
