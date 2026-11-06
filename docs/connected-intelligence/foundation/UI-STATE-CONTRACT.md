# H14 | UI state contract and exact design inventory

Read-only Figma inspection November 6, 2026. Canonical file `jiGHTNUJNltWbHA4Il3hk7`. No canvas edits, new screens, production UI or authenticated browser/Figma parity acceptance were performed.

## Verified existing references

| Node | Exact observed name | Dimensions / purpose |
| --- | --- | --- |
| 399:4218 | DEMO / Operator / 01 Command Center | 1440 × 960; existing full-software prototype context |
| 399:4231 | KPI row | Existing prototype metric presentation |
| 399:4253 | Needs you | Existing prototype situation/review area |
| 399:4326 | Frame / This month's loop | Existing prototype loop summary |
| 399:4354 | Frame / Today's crews | Existing prototype crew summary |
| 10:2 | Operator / 01 Command Center | 1440 × 960 on page 19:16 |
| 1:19 | Operator / 10 Reports | 1440 × 960 on page 19:16 |
| 10:1541 | Operator / 11 Owner evidence · Pilot scorecard | 1440 × 960 on page 19:16 |
| 266:1165 | Owner / 01 Today and connected summary | 390 × 844 on page 19:16 |
| 266:1166 | Owner / 02 Review crew scope request | 390 × 844; related existing review flow, not a new query screen |
| 266:1167 | Owner / 03 Decision recorded | 390 × 844; related existing outcome state |

Inspection method: exact metadata for 399:4218; file page inventory; bounded FRAME-name/size search on Operator Desktop page 19:16 and States & Edge Cases page 19:19. The latter returned no Command/Owner/Report/Evidence/Insight/Answer frames of at least 300 × 250. This is a bounded search, not proof that no unpublished or differently named frame exists.

The prototype contains synthetic customer data and an `Approve & send` control. Do not copy demonstration values or turn an approval-only production operation into claimed delivery. Existing deployed/authenticated semantics prevail until actual design/product reconciliation.

## New exact frames not established by this inspection

The new question input/chips, answer card, claim/evidence drawer, follow-up clarification, denied/partial/stale-source state and their dedicated desktop/tablet/mobile/error/loading variants need verified exact-frame design work in C06. A generic owner summary or scorecard is not evidence those new designs are approved. H14's preparation deliverable is the mapping plus this explicit gap, not a new visual implementation.

## Implemented headless presentation contract

`presentation.ts` is a pure state/copy contract, with tests, not a React UI. It makes the intended behavior available to C06 without a redesign or fake browser proof.

| State | Visible contract | Accessibility / interaction |
| --- | --- | --- |
| idle | Ask about your business | Region; focus remains in question; Ask |
| loading | Collecting the permitted evidence | Status, aria-busy; no action/approval control |
| complete | Answer with supporting evidence | Answer heading focus; View supporting records |
| verified empty | No matching activity in the verified scope | Requires complete verified scope; inspect definitions |
| partial | Some evidence is missing or needs verification | Status; limitations visible; Refresh or review evidence |
| unavailable | An answer is not available from the permitted evidence | Generic non-disclosing copy; no restricted evidence drawer |
| error | The answer could not be loaded | Alert; keyboard-reachable Retry; preserve safe question context |

All states have `requiresReportsNavigation: false`. Verified emptiness cannot be selected merely because a failed request returns no rows. A factual answer can survive narrative-model failure; limitations must remain visible. Source detail opens in context and reauthorizes server-side. Follow-ups preserve intended subject/time but reset on workspace/permission change.

C06 must implement focus restoration when drawers close, labeled buttons and fields, non-color-only state indicators, readable error text, adequate touch targets, no horizontal phone overflow and independent responsive QA. C08/C09 own current authorization/retention and delivery. No headless contract test establishes actual screen-reader, touch, font or browser parity.

## Cross-module scenarios for the real UI acceptance

The owner can answer What needs attention today without visiting Reports; an operator sees a job's recorded blockers; a missing rate makes payroll incomplete; unavailable costing cannot render a final margin; an offline Desktop connector is explicitly stale; imported history is distinguished from new revenue; required unsynced photos prevent a false completed form. None of these copy states grants authority to mutate a business record.
