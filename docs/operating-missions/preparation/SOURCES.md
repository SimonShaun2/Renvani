# Source register and baseline

**Prepared on:** 2026-11-05. This register distinguishes product requirements, historical planning, current source inspection and unexecuted runtime evidence.

## Authoritative product inputs

| Source | Identity | Use |
| --- | --- | --- |
| [Part II v1.1](https://app.notion.com/p/40e317b92d1581188031e8a0a4c847c9) | Full attached build plan and specification, both header version 1.1 dated 2026-11-04 | Six missions, thirteen core work packages, architecture, limits and acceptance |
| [Consolidated two-part master](https://app.notion.com/p/40c317b92d15812b8ed9c7ead55480e4) | Current Part I / Part II sequence | Part I acceptance and founder gate; FS-257/258 remain Part I |
| [Part I twelve-spec handoff](https://app.notion.com/p/40f317b92d158157997dcb3a1266058e) | Earlier completed preparation and latest integration checkpoint | Reuse existing inventories/acceptance packets; no duplicate baseline audit |
| [Existing initiative FS-262](https://app.notion.com/p/40c317b92d15811e9d6ed98d950b2bce) and FS-263–269 | Targeted ticket fetches on 2026-11-05; all observed Backlog | Existing scope anchors and historical contradictions, not new runtime authorization |

The filenames still end in `_v1.md`; their internal headers are **v1.1**. Version 1.1's stated revision adds the optional Render evaluation; it does not newly introduce or reorder the six-mission core. The older four-choice ticket wording is an earlier-ticket/current-baseline reconciliation, not a falsely attributed v1.1 change.

| Attached source | Bytes | SHA-256 |
| --- | ---: | --- |
| `Renvani_Operating_Missions_Build_Plan_v1.md` | 31,101 | `a7cc3bb379db8de032c4d3442ba53426bc8175f62bb506a905d7ae0a02a15d71` |
| `Renvani_Operating_Missions_Build_Spec_v1.md` | 92,220 | `ef54c1d4c5d5b3d0f769c563ac1f1443fcb68d6b0ed27f518ee7d64e5603dd68` |

Their full contents were read for this preparation. Attachments remain in Notion; this package does not introduce another competing copy of the broad specification.

## Current code and source evidence

- Repository: [SimonShaun2/Renvani](https://github.com/SimonShaun2/Renvani).
- Verified `dev` commit: [7840884d346ca95788e2668cc78148afa3b6a843](https://github.com/SimonShaun2/Renvani/commit/7840884d346ca95788e2668cc78148afa3b6a843).
- Base tree: `c712b7c40a8edd3c0424b95f27216667fba105a2`.
- Branch for this preparation: `docs/part2-foundation-prep-20261105`.
- The specification and historical inventories include the older `b45b4996…` baseline. Current-source observations in this package are explicitly pinned to `7840884d…`; historical reports are preserved as history.
- Source presence is not deployed configuration, customer account readiness, integration acceptance or production proof.

The [ticket crosswalk](ticket-crosswalk.json) contains the targeted source/consumer evidence. The [snapshot map](source-map.json), metric dictionary, contract packet and external readiness files name the concrete consumers and limits. Root repository [AGENTS.md](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/AGENTS.md), TEAM.md and GITHUB_WORKFLOW.md govern actual implementation/review. Current authority removes the obsolete mandatory E.. CoS gate while retaining independent review, approved exact-head batch CI and founder merge/production controls as applicable.

## Reused integration checkpoint

Seven earlier reviewed PRs were merged before this preparation: #131, #404, #441, #95, #434, #430 and #440. The last is the current baseline.

Seven earlier draft/HOLD PRs remained open when the preparation began:

| PR | Observed head |
| --- | --- |
| [#439](https://github.com/SimonShaun2/Renvani/pull/439) | `935d37b0fa54f68b2ec88eb76ef6e4e30823c161` |
| [#438](https://github.com/SimonShaun2/Renvani/pull/438) | `e7b416f21b460c115eafa8726b940951702c4577` |
| [#437](https://github.com/SimonShaun2/Renvani/pull/437) | `cf133f9353803e1e8d664c23932a845f80160bbc` |
| [#435](https://github.com/SimonShaun2/Renvani/pull/435) | `47e5b0dd4237903e5bc5437a74280812bcf692f5` |
| [#432](https://github.com/SimonShaun2/Renvani/pull/432) | `98e5e935db39fb2108a67c2268b65f23989ac95f` |
| [#431](https://github.com/SimonShaun2/Renvani/pull/431) | `4959cb9921ba741bccc77e00187d625c3ca2a67b` |
| [#419](https://github.com/SimonShaun2/Renvani/pull/419) | `b2093ae9abe81f70ead48dea07fba69f2fc365ff` |

This is an observed checkpoint, not a durable claim that those heads/statuses never change. It is not a new review or merge of those PRs. Reverify affected consumers when implementation begins.

### Publication-time base update

During preparation, [PR #439](https://github.com/SimonShaun2/Renvani/pull/439) merged and remote dev advanced to [d17dd831ffce437dc9563d95a75de6ad15549c45](https://github.com/SimonShaun2/Renvani/commit/d17dd831ffce437dc9563d95a75de6ad15549c45), tree `de23e7cc48e7d4bdd43e526a6f92d2ef262cacdd`. The [compared change set](https://github.com/SimonShaun2/Renvani/compare/7840884d346ca95788e2668cc78148afa3b6a843...d17dd831ffce437dc9563d95a75de6ad15549c45) contains four commits and 17 public-marketing navigation/homepage/assets/test files. It does not change the mission accounting, action/outbox, tenant, consent, inventory or booking source seams used here.

The preparation branch was fast-forwarded to that current base before publication. The new PR therefore contains only this preparation directory. Source observations and JSON `baseCommit` fields deliberately retain their inspected `7840884d…` provenance; they are not falsely recertified at a newer head. The seven-open-PR table above is the start-of-preparation snapshot: #439 is now merged, and the other six are not newly reviewed by this package.

## Public provider documentation

The three official Google references and their bounded claims are recorded in [external-acquisition.json](external-acquisition.json), checked 2026-11-05. They establish documented options, not account access or a functioning adapter. The eventual adapter must verify supported API version, account eligibility, controls, billing and callbacks.

Optional Render evaluation remains a separate conditional extension. The six optional acceptance cases are mapped for completeness, not executed or activated. No pricing, API availability, region or isolation control is assumed approved.

## Evidence labels

| Label | Meaning |
| --- | --- |
| Source inspected | A named source at a pinned commit supports the stated observation |
| Prepared | A concrete proposed record/example/check exists for review |
| Offline fixture validated | Local synthetic arithmetic/structural checks passed, with no application/provider execution |
| Runtime not executed | No application integration, concurrency, browser, provider or mission-pilot pass is claimed |
| Decision open | A real scoped policy/authority/evidence choice remains unresolved |
| Implementation not started | This preparation does not implement the runtime package |
