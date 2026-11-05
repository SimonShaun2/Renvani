# Marketing industry gallery: asset provenance

Date: 2026-11-05

This asset record accompanies the founder-requested six-card industry gallery and Electrical dropdown correction in PR #444. Canonical layout and responsive state references remain in the Figma file `jiGHTNUJNltWbHA4Il3hk7`, marketing page `171:2`.

## Existing approved photographs

- HVAC & Refrigeration: `apps/web/public/marketing/industries/illustrative-hvac-field-work-f1266660.jpg`, 1280 × 960.
- Plumbing: `apps/web/public/marketing/industries/illustrative-plumbing-field-work-5d7f94f5.jpg`, 1280 × 960.

These are reused existing project/Figma assets. This revision does not assert new licensing or customer provenance for them.

## New illustrative trade photographs

Four new assets were created with the built-in image generation tool for this website revision. They depict fictional service professionals and are not customer testimonials or photographs of Renvani customers. No Toast imagery was copied.

The generated originals were encoded as WebP at quality 84 for website delivery, without cropping or changing their 1122 × 1402 dimensions. The source photographs and the editable Figma fills use the same approved image compositions; responsive cropping is expressed by the shared image mapping and card geometry.

| Industry | Repository asset | Dimensions | SHA-256 |
| --- | --- | --- | --- |
| Electrical | `apps/web/public/marketing/industry-gallery/electrical-v1.webp` | 1122 × 1402 | `9c62d51d75e1faba9a6b5b8b89db0838494ddd633d838133d7f2cfc4b5f56202` |
| Appliance Repair | `apps/web/public/marketing/industry-gallery/appliance-repair-v1.webp` | 1122 × 1402 | `3ad2434c2609fa260d52c3a1bc46e9365389e15f79504144e616b9f0bad3fd68` |
| Pest Control | `apps/web/public/marketing/industry-gallery/pest-control-v1.webp` | 1122 × 1402 | `8e44101bbbb64400b7196e52da4bd481d91342fc964fd2f6d8b274377eaaf1b7` |
| Tree Care | `apps/web/public/marketing/industry-gallery/tree-care-v1.webp` | 1122 × 1402 | `0403b24f4ed11b9e0d6f8f3e95b0ec612bb0207e606174be51fefb3ebe2ca9a2` |

## Exact generation prompts

### electrical

Use case: photorealistic-natural. Asset type: industry photograph for a premium field-service software website card. Create one original, candid editorial-style photograph, portrait 4:5 composition, highly realistic materials and natural skin, soft natural daylight, quiet warm neutral tones, documentary authenticity. The technician and recognizable trade equipment must sit in the central 70% so this can crop safely into a tall card and a small menu thumbnail. Leave some visually quiet area in the upper quarter for a separate HTML operation badge; bottom quarter can take a dark text gradient. This output is only a photograph, no interface, text, logos, brand names, typography, watermark, borders, icons, or graphic overlays. Not a posed stock-photo smile. Not an advertisement layout. Scene: a residential electrician in a clean navy work shirt and protective work gloves, viewed in three-quarter profile inside a tidy home utility area. They are inspecting a modern wall-mounted circuit breaker panel with its hinged outer door open and its protective inner cover intact, holding a compact electrical tester. Recognizable rows of breakers, safe professional context, no exposed live wiring, no sparks. Their face and the panel both remain visible; honest residential service work, comfortable eye-level medium shot.

### appliance-repair

Use case: photorealistic-natural. Asset type: industry photograph for a premium field-service software website card. Create one original, candid editorial-style photograph, portrait 4:5 composition, highly realistic materials and natural skin, soft natural daylight, quiet warm neutral tones, documentary authenticity. The technician and recognizable trade equipment must sit in the central 70% so this can crop safely into a tall card and a small menu thumbnail. Leave some visually quiet area in the upper quarter for a separate HTML operation badge; bottom quarter can take a dark text gradient. This output is only a photograph, no interface, text, logos, brand names, typography, watermark, borders, icons, or graphic overlays. Not a posed stock-photo smile. Not an advertisement layout. Scene: a residential appliance service technician in a neutral navy work shirt crouches beside an open front-loading washing machine in a bright, ordinary home laundry room, checking the rubber door seal and drum with a small diagnostic tool. Clearly recognizable washing machine with adjacent dryer; no disassembled mess, no customer. Natural concentrated posture, practical service bag low in frame, eye-level medium-wide composition with the person's face and appliance visible.

### pest-control

Use case: photorealistic-natural. Asset type: industry photograph for a premium field-service software website card. Create one original, candid editorial-style photograph, portrait 4:5 composition, highly realistic materials and natural skin, soft natural daylight, quiet warm neutral tones, documentary authenticity. The technician and recognizable trade equipment must sit in the central 70% so this can crop safely into a tall card and a small menu thumbnail. Leave some visually quiet area in the upper quarter for a separate HTML operation badge; bottom quarter can take a dark text gradient. This output is only a photograph, no interface, text, logos, brand names, typography, watermark, borders, icons, or graphic overlays. Not a posed stock-photo smile. Not an advertisement layout. Scene: a pest-control professional in a plain navy uniform, protective work gloves and work boots inspecting the exterior foundation of a suburban home beside a neat planting bed. The professional holds a closed compact inspection case and kneels to inspect a small tamper-resistant pest monitoring station against the brick foundation. Clearly recognizable professional pest inspection, calm daylight, no visible pests, chemicals, spraying, mask obscuring the face, or frightening imagery. Include the home wall, greenery and natural focused working posture.

### tree-care

Use case: photorealistic-natural. Asset type: industry photograph for a premium field-service software website card. Create one original, candid editorial-style photograph, portrait 4:5 composition, highly realistic materials and natural skin, soft natural daylight, quiet warm neutral tones, documentary authenticity. The technician and recognizable trade equipment must sit in the central 70% so this can crop safely into a tall card and a small menu thumbnail. Leave some visually quiet area in the upper quarter for a separate HTML operation badge; bottom quarter can take a dark text gradient. This output is only a photograph, no interface, text, logos, brand names, typography, watermark, borders, icons, or graphic overlays. Not a posed stock-photo smile. Not an advertisement layout. Scene: a professional arborist on the ground in a leafy residential yard, wearing a plain navy work shirt, safety helmet and work gloves, inspecting and gently guiding a healthy tree branch with a compact pruning tool. A recognizable mature tree trunk and green canopy dominate the surrounding scene. No chainsaw in use, no dangerous climbing, no falling tree, no customer. Natural grounded working posture, afternoon daylight, textured bark and foliage, documentary medium shot with face and tree both visible.

## Motion and presentation

Operation badges are native HTML/CSS/SVG UI layered over the photographs. They are not baked into the image files. Their examples are illustrative; selecting an industry card navigates to its marketing page and performs no operational or payment action.

## Canonical Figma rendering and vector assets

The four WebP files remain the website sources. Figma's renderer required lossless PNG imports decoded from these exact WebPs. The designer verified identical decoded RGB pixels, with no crop or visual edit. Gallery references are `586:5737` (desktop), `586:5867` (tablet), and `586:6029` (mobile) in canonical file `jiGHTNUJNltWbHA4Il3hk7`; the shared Electrical featured component is `580:5536`.

Four supplied Figma SVG assets are reused unchanged in the operation badges. Each contains only a single local circle shape and presentation attributes, with no scripts or external references. Paths below are relative to `apps/web/public/marketing/industry-gallery/`.

| File | Figma export source | SHA-256 |
| --- | --- | --- |
| `dispatch-stop-navy.svg` | https://www.figma.com/api/mcp/asset/19088ff6-69c3-4824-b54a-2758d794163a.svg | `801882f8c579fd5e12d6926b21a3f905177f169d71db32c16edb9afa5cd9d369` |
| `dispatch-stop-amber.svg` | https://www.figma.com/api/mcp/asset/cc776f89-b5fc-4380-aa70-3289bd4fad8d.svg | `c92996c66f9986c7331d57e436ea6fc4091058d72b33fd18a7bd3acee6e2a6ac` |
| `crew-assignment-white.svg` | https://www.figma.com/api/mcp/asset/359df1c7-c5d4-4d00-81fd-d608f72ab710.svg | `a6c5d6bb0c5bdf699b940e547634b5941442976a75f1a52dd362c212cbfbd247` |
| `crew-assignment-amber.svg` | https://www.figma.com/api/mcp/asset/10604c09-8cbe-4094-9a38-572b9a58ce73.svg | `1c126525ae5cbc27fa26e8e51d19e832fe1beb07b60b5aa4d18cd9fac65a9bac` |
