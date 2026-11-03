# Renvani — Figma-to-code visual parity contract

**Controlling founder requirement:** [P0 parity tracker #433](https://github.com/SimonShaun2/Renvani/issues/433). **Source of truth:** [FSM Agent – Product Design](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-%E2%80%93-Product-Design), file `jiGHTNUJNltWbHA4Il3hk7`. This is the **only current Figma file** for product, field, customer and marketing experiences. Do not substitute retired Figma files, old screenshot templates, old product names or designer intuition.

## Principle

**Linked Figma ≠ implemented Figma.** A page or ticket is not design-complete until the exact route at an actual preview/test deployment is compared with the exact approved node(s) at the relevant breakpoints and interactive states. A functional or green CI result is not a visual QA pass. A Figma prototype contains representative/sample data, which must never be displayed as actual business results.

## Mandatory implementation steps for every UI PR

1. **Identify exact nodes before coding.** State file key, page, desktop/tablet/mobile node IDs and state variations. Resolve ambiguous prototype hubs to the actual screen frames. If no corresponding frame exists, request bounded Product/Design direction; do not invent designs.
2. **Inspect the real app code.** Reuse application components, auth/session, tenant isolation, domain APIs and accessible behavior. Figma visual code is not a replacement for live logic.
3. **Translate design tokens.** Match approved ink/cream/amber palette, type hierarchy, logos/icons, spacing, border radii, breakpoints and component states. No unrelated global token rewrite; scope and review design-system changes.
4. **Implement real interactions.** Every visible action works through authorized existing services. No decorative fake buttons, fabricated metrics, bypass of Clerk, mock-only login, demo-only data or disabled security controls presented as features.
5. **Verify in browser.** Screenshot the actual deployed route at desktop/tablet/mobile widths and relevant error/loading/empty states; link screenshot evidence and exact Figma frames. Explicitly record matches, discrepancies, and approved exceptions. Do not claim deployed parity when no browser check was performed.
6. **Review and release.** Require an actual independent Design or Product visual acceptance, assigned QA functional/accessibility check, and risk-based Security/Peer/CI at exact reviewed head. A new UI commit invalidates affected screenshots/reviews. The founder authorizes every merge by named PR and exact head.

## Canonical starting points

| Experience | Figma reference | Implementation |
| --- | --- | --- |
| Staging login | `388:4218` desktop; `388:4269` tablet; `388:4320` mobile | `apps/web/app/(auth)/login/[[...rest]]/page.tsx`; `src/components/auth/AuthShell.tsx` |
| Login error states | `388:4371` desktop; `388:4426` tablet; `388:4481` mobile | Actual Clerk challenge/error states, not a simulated login |
| Operator / office | Figma page `19:16`, select the **exact child frame per route** | `apps/web/app/(app)/`, shared `AppShell`/`Sidebar` |
| Command Center demo | `399:4218` in page `399:4217` | Demo is **not a sign-in frame**; map accepted owner UI separately |
| Technician | Figma page `19:17`, exact field-app frame per route | `apps/web/app/(mobile)/` or existing mobile/field route |
| Customer | Figma page `19:18`, exact customer frame per flow | Public booking, inquiry, customer portal and approvals |
| Marketing | Figma page `171:2` (current visual redesign) | `apps/web/app/(marketing)/` and marketing shared components |

The **existing FS-51 Figma-to-production handoff** and draft PR #404 are the shared mapping work; do not create a competing full application route map. [Login implementation PR #432](https://github.com/SimonShaun2/Renvani/pull/432) is *in review*, not visual-parity accepted.

## PR evidence template (complete fields, not just links)

- **Route and state:** pathname, intended user role/tenant and login/access conditions
- **Figma:** full canonical file URL, precise desktop/tablet/mobile/state node IDs
- **Preview:** current Vercel `dev` or isolated PR URL + full commit SHA, actual backend environment; note any unavailable target
- **Screenshots:** browser desktop/tablet/mobile and error/empty/loading as applicable, compared with Figma
- **Discrepancies:** exact differences, fixes and any authorized deferrals with owning ticket
- **Working behavior:** auth/session, focus, keyboard, buttons, API connections, tenant guards, consent and failures
- **Reviewer verdict:** independent Design/Product **PASS/HOLD** at exact head and QA link
- **Founder merge:** named PR/full SHA permission, never implied by a screenshot or this policy

## Brand boundary

**Renvani is the product brand.** Current user-visible UI, email copy, browser metadata, navigation, login, onboarding, booking, checkout and current docs must not display a retired product name, domain or tagline. Audit and correct those customer-facing surfaces with tests. Treat historical migrations, old data schemas, local-storage keys and archived project records as compatibility-sensitive: do not blindly search-and-replace data identifiers or history. Mark old planning documents **historical, non-authoritative** so they cannot override current Figma/product direction.

## First implementation order

1. Login parity on #432 including desktop/mobile and genuine Clerk sign-in behavior.
2. Shared operator shell/Nav/BrandMark and current app tokens under a bounded PR with exact Figma references.
3. Route-by-route parity against approved five flagship areas, field mobile and public customer journeys, using FS-51 and the original Phase A acceptance matrix.
4. Review remaining customer-facing legacy strings and update visible copy without breaking persisted state.
5. For all future UI work, include exact node and visual acceptance evidence in each PR from the start.

**No merge, staging flag enablement, production promotion, real customer send, spend or security bypass is approved by this document.**
