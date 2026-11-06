# PR 447: supplied branding, real product screens, seven-field intake

This follow-up preserves approved navigation, product options, layout CSS, 5% public Flex pricing and hidden Founding offer.

## Assets

Header/footer horizontal logo, SVG icon and ICO are the exact assets from `renvani-logo-v2.zip` (verified SHA-256). Apple touch image is rendered at 180px from the supplied symbol with its 20px cream clearspace. No font binaries are included.

Third industry boxes now show locally stored AVIF exports of actual app designs in Figma `jiGHTNUJNltWbHA4Il3hk7`. Source-node mapping and original geometry are in `IndustryProductScreen.tsx`. Screens are uncropped and open full size. The original Crew Job Brief exists at phone size (`1:13`); its editable tablet adaptation (`643:87`, 1112×834) reuses the original app cards and components. The phone frame is unchanged. The tablet is an adaptation, not a claim that a tablet frame already existed. The screen retains illustrative example data.

## Forms

Demo (including Flex/Flat entry points) and Growth Check share First Name, Last Name, Work Email, Contact Number, Business Name, Trade and Team Size, in that order. Growth Check retains Business Website and ZIP/City afterward. The homepage's short website field is a navigation shortcut to Growth Check, not a submitted lead form.

Validation is server-side as well as native required inputs. Phone uses the existing US-number contract, with normalization to +1. No messaging consent is inferred. Honeypots, rate limits, body size limits, safe errors and escaping remain.

Demo preserves split names and team size in the existing message field, combined name in `name`, and phone in the existing phone column. The Growth Check API accepts an optional strict contact object and persists it in a new nullable `contact_details` JSON column. Old API clients and old records remain supported. The contact data is included in the existing notification; it is not logged.

## Release ordering

Migration `0063_marketing_growth_contact` and the API must be released before publishing the new Growth Check form to production. The current production API is not silently sent a fallback that discards contact data. No production migration, API release, merge or promotion is performed in this preview task. Local route/service tests validate the new payload and persistence boundary using the existing test repository doubles; this is not proof of production DB migration.

Independent review and approved exact-head release checks remain required. Screenshots, forms and asset routes are checked on the new preview before handoff.

The additional PWA manifest and opaque installation icons follow the supplied v2 manifest structure and derive their geometry from the approved v2 symbol. These are rendered derivatives of the supplied symbol, not byte-identical copies of the separate PNG exports in the ZIP.

## Final polish
- The actual Crew Job Brief tablet adaptation `643:87` now contains garage-door work, an opener issue, safety-sensor adjustment and roller replacement. It preserves the approved Technician App layout and example-only labeling.
- Public assets `/brand/logo-horizontal.svg`, `/manifest.webmanifest`, `/icon-192.png`, `/icon-512.png` and `/icon-maskable-512.png` are exempted from Clerk middleware only by exact path. Protected lookalike paths and all operator/tenant routes remain gated. Matcher tests guard both cases.
- PWA manifest and installation icon variants derive from the supplied v2 symbol. The favicon.ico and original SVG symbol/wordmark were byte-verified against the user's ZIP; the PWA/Apple PNG derivatives are not byte-identical to the pre-rendered PNGs in that ZIP.
