# Pull Request

## Ticket and branch

- FS ticket and Notion URL:
- Legacy FSM-NNNN issue mapping, if applicable:
- Integration base and exact base SHA:
- Exact head SHA:
- Draft/In Progress or ready for review:
- Approved batch ID and enumerated membership (leave blank until authorized):

## Scope and tandem split

- Acceptance and non-goals:
- Senior developer pair and distinct file/section ownership:
- Branch and merge order:
- Self-review and partner cross-review:
- Independent reviewer (not an implementer):
- Design owner and exact canonical Figma file / page / desktop-tablet-mobile and state frame node IDs for every UI change (or `N/A: no UI changed`):
- QA owner and negative cases:
- Security required? Why:
- Technical Lead contract decision if architecture changes:

## Shared contract and consumers

- Contract name/version, owner and durable path, or none:
- Consumers and migration/compatibility plan:
- Partner acknowledgements:
- Schema, event, queue, auth, consent or money implications:

## Evidence at this exact head

- Local commands/results and relevant UI evidence:
- **UI parity evidence (mandatory for UI changes):** actual preview URL at exact head; browser screenshots at desktop/tablet/mobile, plus relevant loading/empty/error states; Figma screenshots/frames; list each mismatch and approved exception:
- **Actual interaction QA:** keyboard/accessibility, authenticated role/tenant, active services, links/buttons, responsive layout; do not substitute demo/static markup:
- **Evidence classification:** source present / preview build / browser observed / workflow accepted; record actual roles, viewport widths and states tested, plus missing evidence:
- **Independent visual sign-off:** Designer/Product PASS/HOLD, reviewer and evidence URL at reviewed head; for an exception name the authorizer, date, route/state/width and bounded adaptation:
- **FS-51 crosswalk:** existing route-map IDs or explicitly unmapped surface; use its linked source inventory and operator acceptance packet:
- QA evidence URL:
- Independent reviewer evidence URL:
- Security and Design evidence URLs when required:
- Founder merge approval for this named PR and exact reviewed head (founder-only; after independent peer review, QA, Security-by-risk, and approved batch CI):
- Approved batch CI run URL and conclusion:

## Risk and observability

- Tenant/consent/authorization negatives:
- Logs, metrics, audit events and rollback:
- Blockers and fix cards:

**Canonical design contract:** [docs/design/RENVANI_FIGMA_PARITY.md](../docs/design/RENVANI_FIGMA_PARITY.md), [founder parity tracker #433](https://github.com/SimonShaun2/Renvani/issues/433). Renvani is the only current brand; old design files and historic UI copy are not authoritative. An attached Figma link or green CI alone is NOT visual parity.

Open drafts remain In Progress. A changed head requires fresh affected sign-offs. No standalone CI, auto-merge, production promotion, Vercel/website setup or live payment changes from this PR. Do not mark Done until approved integration merge and acceptance evidence.
