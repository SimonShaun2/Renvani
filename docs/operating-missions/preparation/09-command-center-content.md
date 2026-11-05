# 9. Command Center content and state specification

**Status:** prepared content and acceptance inputs; no UI implementation or browser/design acceptance. **Source:** [Part II v1.1](https://app.notion.com/p/40e317b92d1581188031e8a0a4c847c9), sections 4, 6, 8, 16, 17 and 21. **Code baseline:** `7840884d346ca95788e2668cc78148afa3b6a843`.

The [state examples](command-center-states.json) contain six mission cards and 20 concrete display cases. They make truthful progress, scope and blocked-state copy reviewable before Codex builds OM-06. Example copy is proposed. It does not approve a target, permission policy, layout or campaign.

## Six entry cards

| Mission | Owner-facing purpose | Result description |
| --- | --- | --- |
| Get more bookings | Find a supported way to turn eligible demand into confirmed service. | Net confirmed bookings, with cancellations, completed work and economic safeguards shown. |
| Increase my monthly revenue | Choose a bounded plan around the main revenue constraint. | Earned service revenue for the declared business period; cash and unbilled work shown separately. |
| Increase my average job value | Offer appropriate service options using approved scope and pricing. | Net value per eligible completed job, with revenue per eligible opportunity and acceptance safeguards. |
| Get more repeat business | Identify supported due service and agreement opportunities. | Eligible completed repeat service; callbacks, warranty work and included benefits remain distinct. |
| Get paid faster | Resolve the delay between completed work, invoicing and payment. | Choose the relevant delay measure before approval; show open invoices and recovered cash separately. |
| Organize my business | Check unfinished work, scheduling, materials and service opportunities. | Verified issue resolutions plus scan coverage, unknowns and reopened findings. |

The default action is **Assess and recommend**. Use known operating-profile facts, then ask only for missing target, scope, horizon or authority. A mission click does not send a message, change a booking or authorize spend. Show unavailable methods alongside useful assessment work; disable only the consequential action that lacks readiness.

## Required review content

A plan review must show: why the selected method fits; source coverage and uncertainty; at most two strategy methods and one paid channel; the bounded support work; recipients and approved content; service/area/date scope; current resource needs; model, media and infrastructure allowances separately; expiry; next review; expected domain verification; target and mandatory safeguards. The actual approved version and payload hash are implementation audit facts, while the owner sees which scope changed and why approval is needed.

For paid acquisition, show the approved total exposure and whether tax/fees are included. Explain that a verified total budget may have no daily hard ceiling. If a required daily ceiling cannot be met, show the blocked state rather than an executable launch control. Unknown fees remain an exposure gap, not a zero.

Keep three dimensions visible: **work performed**, **verified results**, and **estimated effect**. A queued message is activity; a confirmed booking is a domain result; an evaluated causal estimate is a separate claim. The completed/target-not-met and completed/not-evaluable examples prevent a green workflow label from becoming a false success claim.

## Concrete state coverage

| Case | State | Primary action |
| --- | --- | --- |
| OM-UI-01 | Start assessment | Assess and recommend |
| OM-UI-02 | Review in progress | View progress |
| OM-UI-03 | A decision is needed | Set target and limits |
| OM-UI-04 | This method is available for planning | Review connection requirements |
| OM-UI-05 | Review your plan | Review plan |
| OM-UI-06 | Approval needs a limit | Set the missing safeguard |
| OM-UI-07 | Approved within these limits | View approved scope |
| OM-UI-08 | Plan needs another review | Review updated plan |
| OM-UI-09 | Action queued | View activity |
| OM-UI-10 | Delivery needs checking | View reconciliation |
| OM-UI-11 | Waiting for the customer | View next check |
| OM-UI-12 | Work is still maturing | View observed results |
| OM-UI-13 | Review complete; target met | View evidence |
| OM-UI-14 | Review complete; target not met | Review results |
| OM-UI-15 | Review complete; result cannot be evaluated | See missing evidence |
| OM-UI-16 | Paused; earlier actions still being checked | Review or resume |
| OM-UI-17 | Cancelled for this mission | View retained work |
| OM-UI-18 | Business review needs attention | Review issues |
| OM-UI-19 | A small first test is possible | Review a bounded test |
| OM-UI-20 | This spending limit is not supported | Review other options |

Show three routine decisions initially and every critical exception. “View all findings” exposes the complete scoped list and scan coverage. Dismiss/defer requires a reason and preserves history. Missing stock creates a verification task; it does not become zero stock or a resolved issue.

## Design evidence and exact-frame gap

The existing [FS-51 map](../../design/fs-51-figma-route-map.json) names canonical file [FSM-Agent-Product-Design](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-Product-Design). It records these prior references:

| Existing surface | Existing node | Use in preparation |
| --- | --- | --- |
| Command Center | `10:2` | Existing visual language and route reference |
| Approval states | `10:220` | Existing approval interaction reference |
| Business Operating Profile interview | `331:4113` | FS-257 prefill/input reference |
| Operating Profile approval | `331:4170` | Existing review reference |

These references were not reinspected or accepted for the new missions in this package. The old source map records a `b45b4996…` code baseline and unverified parity. New six-mission, plan, progress and exception frames remain unset under [OM-D08](DECISIONS.md). Do not manufacture node IDs or infer responsive acceptance from a route existing.

Reuse the current `/command-center` and approvals surface; a final nested-route decision belongs to OM-06. [CommandCenterView.tsx](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/web/src/components/command-center/CommandCenterView.tsx), existing AgentInbox and DeliveryStates are consumers to extend compatibly, not permission to replace the app shell. Legacy product IDs and existing approvals stay compatible.

## Ready-to-run UI acceptance script for Codex and QA

1. Render all six cards using real readiness variants: available assessment, unavailable live connector, missing target, stale source and unsupported service situation. Confirm there is no executable control for an unavailable method.
2. Walk the 20 examples using deterministic fixtures, then repeat at suggested QA viewports 390×844, 834×1112 and 1440×900. These are test inputs, not approved design breakpoints. Record actual screenshots, layout overflow, readable amounts and action access.
3. Use keyboard-only interaction for selection, review, approval, pause, dismiss/defer and error recovery. Verify focus returns after dialogs, errors identify the field/action, status updates are announced, and color is not the sole status cue.
4. Ask a representative owner to explain what is approved, maximum exposure, what is merely queued, what outcome is verified, why a result is pending and what pause does. Record observed misunderstanding and correction; do not replace this with a visual-only pass.
5. Exercise source-change, expired authority, unknown provider outcome and cross-tenant denial. Preserve draft inputs where safe; require fresh approval for material changes.
6. Compare each implemented state to its exact accepted frame or documented bounded exception. Link independent browser evidence and head SHA before claiming OM-A26 passes.

**Handoff:** OM-06 consumes this file after OM-01 contracts and OM-05 state/readiness shapes are stable. OM-D01, OM-D04, OM-D08 and relevant provider decisions remain open. This package supplies content and a review script, not Figma or browser sign-off.
