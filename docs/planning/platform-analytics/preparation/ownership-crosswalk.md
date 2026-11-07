# H01: Existing program and ownership crosswalk

Version 1.0 · November 7, 2026 · Application source `5e3e83eaaf52caa2b97707fbe67b0fc92f63cd58`

This is a reuse and dependency map, not a staffing dispatch or a new FS board. PAI identifiers are local analytics tickets. RCI identifiers are local Connected Intelligence tickets. FS-43 and the FS references observed on its board record are actual existing board identifiers; their current assignments and acceptance still need the owning runtime coordinator. Evidence pins, document revisions and limitations are in [source-register.json](source-register.json).

## Existing work

| Existing item | Observed state | Reuse or extension | PAI consumers / accountable function |
| --- | --- | --- | --- |
| [#442 mission foundations](https://github.com/SimonShaun2/Renvani/pull/442) | Merged; merge `4a5b3be85c6fccf1ec00c74d7934a225753e9980` | Reuse mission/opportunity, authority and evidence definitions. Extend reporting facts only where the lifecycle needs explicit source linkage. | H03, C09, C20, L01–L03; Data Contracts / existing mission owner |
| [#445 workflow package](https://github.com/SimonShaun2/Renvani/pull/445) | Merged; merge is current inspected `dev` head | Reuse estimates, jobs, scheduling, invoice/payment and compatibility work. Preserve state distinctions and inspect source evidence rather than adding a parallel workflow. | H02/H03, C09/C10/C15; Service Workflows / Revenue Backend |
| [#449 RCI specs](https://github.com/SimonShaun2/Renvani/pull/449) | Merged; `f77216143d1249c0ba045c44a6f2f097845d483e` | Extend internal platform analytics using the same evidence semantics and owner boundaries. Do not recreate tenant Command Center or Reports. | H01–H04, C01–C03/C06/C17; Technical Lead / Measurement |
| [#452 RCI H01–H16 foundation](https://github.com/SimonShaun2/Renvani/pull/452) | Merged; `7dfb51798c7a22d33bb3c9736b3397bb80495052` | Reuse scopes, periods, source/quality/claim concepts and exact arithmetic design. Versioned adaptation is needed for PA metric IDs, variable currency exponent and AI micro-costs; current 2dp schemas are not a drop-in fit. | H02/H03/H05, C02/C06/C11; Data Contracts / Technical Lead |
| [FS-43](https://app.notion.com/p/3ff317b92d158144a68be8187049d42f), [#142](https://github.com/SimonShaun2/Renvani/pull/142) | PR closed **unmerged**; preserved head `7ee169c8a3fa443f33920e208607fc46328709aa`; board preservation note says not done | Inspect preserved Sentry/PostHog adapter, env, API/web bridge and build-script work. Selectively port compatible pieces and review redaction/identity. Do not blindly replay old source or introduce a second capture path. | H03/H04/H07, C01/C10/C11/C16; Platform / Reliability and Observability |
| FS-12, FS-15, FS-1 | Observed as dependencies on FS-43; current completion not re-audited in this batch | Existing action state machine and event/outbox owners must govern execution/transport. The historical dependency listing does not mean all current requirements are implemented. | C01/C07/C09/C10; Agent Backend / Measurement / Platform |
| Existing `revenue-outcomes.service.ts` | Source inspected at current code baseline | Keep its period-activity and available-material-cost meanings. Do not relabel invoice/estimate fallbacks as collected cash or full profit. Outcome cohorts need explicit authoritative facts/allocation. | H02/H03, C09/C12/C15; Revenue Backend / Measurement |
| Existing Langfuse adapter | Source inspected; adapter is labeled a stub | Reuse useful adapter/audit conventions after call-site coverage and minimization review. Complete latency/failure/attempt/token/cost instrumentation belongs to C11. | H03/H04/H07, C01/C11/C16; AI integration / Platform |

Merge state is repository evidence. It does not establish deployment or full acceptance. Older continuity captions in AGENTS/CODEX and earlier Notion snapshots describing #442/#445/#449/#452 as unmerged are historical; this bounded crosswalk does not rewrite those whole documents.

## Shared RCI integration boundaries

| RCI local ticket | Existing responsibility | Analytics dependency or extension | Boundaries to preserve |
| --- | --- | --- | --- |
| RCI-C01 | Source lineage, FS ownership, central-file reservation, branch/CI scope | PAI-C01 uses the same source/owner reconciliation; H01 provides this pinned starting map. | No duplicate runtime owner or invented official ticket. |
| RCI-C02 | Contract adoption, schema decisions, consumers, rollout flags | PAI-C02 coordinates company/provider identity and any versioned amount/metric adapter. | Schema authority remains `packages/db/src/schema.ts`; seven logical rpt interfaces do not mandate seven new tables. |
| RCI-C04 | Authenticated reads, server-bound tenant/actor, evidence manifests | PAI-C03/C17 reuse authority and safe-detail concepts; internal export is a separately constrained principal. | A PostHog filter cannot substitute for server authorization or true database/vendor controls. |
| RCI-C05 | Canonical core readers and exact shared metrics | PAI-C06/C09 reuse evidence/calculation semantics and coordinate metric definitions. | Do not change legacy metric meanings or coerce PA records into unsupported schemas. |
| RCI-C09 | Shared Reports/Command Center runs, saved questions and delivery | PAI-H06/C13–C16 define internal native dashboards with shared meanings; future customer exposure goes through RCI's authorized report pipeline. | No second report scheduler, export authority or customer-facing analytics application. |
| RCI-C10 | Independent first read-only slice acceptance/pilot | PAI-C17/C18 reuse the evidence standard for the distinct enabled internal analytics scope. | RCI acceptance is not automatically PAI acceptance, or vice versa. |
| RCI-C13/C18 | Merchant job cost ledger / material valuation | PAI-C12 records Renvani cost-to-serve separately; merchant-margin reporting consumes accepted merchant-cost facts only when available. | Do not make the first platform-billing dashboard depend on complete merchant accounting or call known materials full profit. |
| RCI-C27/C28 | Full-scope security/performance/quality and staged rollout | PAI-C17/C19 coordinate applicable release evidence and owner handoff. | The founder still approves each named PR and exact head; the pilot is scope-specific. |

No RCI ticket is marked complete or reassigned by this crosswalk. The inspected RCI document is a merged specification, not proof that all integration work described there exists.

## H01–H04 responsibility and review split

| Local ticket | Preparation deliverable owner function | Known consumers | What is prepared here |
| --- | --- | --- | --- |
| PAI-H01 | Technical Lead / Product Owner / source coordinator | H02–H08; PAI-C01 and overlapping RCI owners | Pinned source/PR/document register, decisions and this ownership map |
| PAI-H02 | Measurement / financial-domain owner / Data Contracts | H03/H05/H06; C06/C08/C12–C15 | Versioned 24-metric catalog, financial classifications, dictionary and hand-calculated examples |
| PAI-H03 | Data Contracts / Agent Backend / Service Workflows | H02/H04–H07; C02/C07/C09–C11 | Identity, versioned logical events/projections, lifecycle and correction/allocation examples |
| PAI-H04 | Security / Platform / data owner | H05/H07; C01/C03–C05/C11/C17/C19/C20 | Default-deny fields, access/purpose matrix, proposed retention and correction/deletion contract |

Actual work in this preparation batch is divided across distinct files, with separate cross-review after authorship. The review receipt records the actual reviewers and findings without impersonating permanent staff, Security or runtime QA roles. Official assignment fields remain unset.

## Runtime file ownership to resolve in C01

| Boundary | Existing authoritative area | Coordination needed before mutation |
| --- | --- | --- |
| Business identity/financial rows | `packages/db/src/schema.ts`; Stripe adapter; existing domain services | Existing schema and financial owner; review whether current fields suffice |
| Shared reporting contracts | `packages/types/src/connected-intelligence/v1/` and accepted adapters | Data Contracts / RCI-C02 owner; consumer/version plan |
| Exact metrics | `apps/api/src/services/connected-intelligence/foundation-math.ts`; existing reader/report services | Measurement / RCI-C05 owner; precision and definition adoption |
| Activity events and execution receipts | Existing emitters, action/outbox/queue and domain-state services | Agent Backend / Measurement / service owner; no independent execution engine |
| SDK and operational observability | Preserved FS-43 work and current Langfuse adapter | Platform / AI integration; one capture source, redaction, environment config |
| External exports/vendor source | Selected logical read-only projections and dedicated source principal | Platform / Security; actual grants, account payload and correction evidence |

H01–H04 changes documentation and machine-readable preparation definitions only. Runtime files, exports, database grants, migrations, SDK capture and vendor settings are implementation work, and their owners must be reconciled before mutation.
