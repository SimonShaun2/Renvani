# FS-290 / FS-293 — founder story and connected-platform positioning

Continues PR #451 from checkpoint `0dec4240ee9c13229a1b44057b43e7452a58e1b6` after founder approval to begin the website recommendations. This is source implementation and author QA, not approval to merge or publish.

## Content and UI

- Homepage headline: More direct jobs. More repeat customers.
- One connected platform explanation in the hero and page metadata; no implied add-on to another platform.
- Founder positioning rule (repeat-founder only): Shaun Simon is a repeat founder who built Renvani around one connected platform for home service businesses. Past ventures stay unnamed. No invented acquisition date, price, executive title, endorsement or customer proof.
- The homepage founder block has been removed and replaced by the "Why we built Renvani" video section (PR #453). Any future founder wording must follow the repeat-founder rule above.
- The standalone About page is deferred by founder request. No secondary About CTA. The homepage founder block was removed and replaced by the Why video (PR #453).
- Footer remains at the approved pre-About layout and links; no About footer item.
- The About page and its sitemap/robots entry are removed from this release. The old URL returns a public 404 instead of redirecting to sign-in.

## Editable design source

Canonical Figma file `jiGHTNUJNltWbHA4Il3hk7`, page `171:2`. New variants preserve approved originals and reuse existing Geist typography, bound ink/cream/amber variables and local button/nav components.

| Content | Desktop | Tablet | Mobile |
| --- | --- | --- | --- |
| Hero copy variant | 665:6004 | 665:6056 | 665:6104 |
| Founder section (removed from the homepage; retained only in Figma) | 665:6014 | 665:6066 | 665:6114 |
| Deferred About design frames, retained only in Figma | 665:6026 | 665:6078 | 665:6126 |

These variants have author visual checks, not independent Design/Product acceptance. The existing application navigation is deliberately reused rather than imported from an older Figma shell. No new binary assets are needed.

## Validation and release

Targeted tests cover founder wording, no false testimonial markup, all five flagships, preserved website-to-Growth-Check handoff, About route boundaries and metadata. Check real browser at 320/390/834/1440px; include header/footer wrapping. Keep the public API deployment dependency from FS-298: the expanded trade validator must be live before the web form options ship to production.

Remaining launch tickets are not claimed complete. Privacy/Terms copy needs actual operating/legal details; server-side Notion synchronization needs an approved private integration credential. No promise of ten beta places or customer outcomes is introduced by this slice.

## November 6 founder scope change

The standalone About page is not needed right now. Founder wording stays repeat-founder only (no past company names). Remove the page, footer link, linked CTA, and crawler references from the preview. Preserve Figma About designs as deferred assets. Production remains unchanged. The homepage founder block was removed and replaced by the Why video when PR #453 merged dev.
