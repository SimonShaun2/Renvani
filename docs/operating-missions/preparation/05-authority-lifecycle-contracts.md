# 5. Authority, lifecycle, API and event contract packet

**Status:** proposed contract preparation, no runtime exports or implementation. **Source:** [Part II v1.1](https://app.notion.com/p/40e317b92d1581188031e8a0a4c847c9), sections 4, 6, 8 and 19. **Code baseline:** `7840884d346ca95788e2668cc78148afa3b6a843`.

The [contract packet](contracts.json) fixes the review surface: 13 proposed endpoint operations, 10 action-authority classes, 12 authority examples, 15 lifecycle/race examples and 11 required mission error codes. It preserves unresolved business/role decisions explicitly. No role receives a new permission through this document.

## Reuse and current-source implications

- The [existing action service](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action.service.ts) and [action state machine](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/agent-control-plane/v1/agent-action-state-machine.ts) remain authoritative. Extend them compatibly; do not reinterpret terminal states or replace them with OM step states.
- [Existing approve/execute schemas](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/routes/agent-actions/schemas.ts) require an expected version but keep the idempotency header optional. OM consequential consumers require both. The prep does not loosen existing guarded routes.
- The action service checks versions against a loaded row, while relevant transition writes need atomic version/state predicates. Target resolution, expiry races and transaction composition are precise OM-02/03 proof obligations, not claims that a production exploit was reproduced.
- [Current outbound receipts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/apps/api/src/services/agent-action-receipt.ts) can be queued with no provider send. [integration-outbox.service.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/db/src/integration-outbox.service.ts) must participate in the accepted transaction boundary; calling a separate transaction is not atomic composition.
- Existing shared errors map not-found, unauthorized, forbidden/policy-denied, validation, conflict/consent and internal errors to established HTTP behavior in [error-http.ts](https://github.com/SimonShaun2/Renvani/blob/7840884d346ca95788e2668cc78148afa3b6a843/packages/types/src/error-http.ts). Map new semantic codes through that boundary; exact new response payloads remain an OM-01 reviewed contract.

## Authority matrix

| Class | Required authority and checks |
| --- | --- |
| Permitted scoped reads, scans and deterministic calculation | Existing authenticated read authority; no business write or new contact. |
| Internal findings, task suggestions and content drafts | Permitted draft authority; output is untrusted until validated. |
| Send message, estimate or invoice | Exact purpose/channel/destination consent, current entity/eligibility, approved content and capability scope. |
| Create/activate bounded campaign | Explicit owner or authorized financial capability; exact plan/content/area/dates and reserved supported exposure. |
| Publish offer or customer-facing page | Approved truthful scope/content and applicable publication/price authority. |
| Change price or discount | Separate explicit pricing authority. Mission selection and generic admin access do not supply it. |
| Change confirmed schedule | Applicable operational grant, customer commitments, qualifications and atomic live resource feasibility. |
| Transfer inventory | Applicable grant, verified physical stock, current version and supported domain movement. |
| Create accepted agreement obligation | Supported enrollment capability, customer-accepted exact terms and supported billing state. Do not infer autopay. |
| Supplier purchase, settlement, automatic charge, hiring commitment or uncertain technical scope | Recommend-only until separately enabled and authorized. No generic agent/tool access confers these powers. |

An owner selecting a mission still selects assessment by default. A generic office, dispatcher or admin route does not confer financial authority. A grant binds capability, mission/service/customer scope, template versions, channels, resource constraints, exposure and validity. Record the exact approved plan/action version and payload hash. Only explicitly bounded substitutions may proceed without another approval; material changes create a new proposal.

The actual role-to-capability policy is open in OM-D04. Consent purpose/copy and essential-notice exceptions are open in OM-D05. Preserve the merged fail-closed consent foundation and current disabled grant/delivery paths until their separate acceptance gates pass.

## API review packet

All paths use `/api/v1/operating-missions`, current authentication/tenant/Zod/typed-client conventions, thin routes and service-owned rules. The JSON enumerates fields/checks without pretending to be a production Zod schema. Path IDs are always resolved in trusted tenant scope.

| Operation | Required behavior |
| --- | --- |
| `GET /catalog` | Definitions, supported methods, readiness and blockers. |
| `POST /runs` | Assessment accepted; no model/provider call inline. |
| `GET /runs/:id` | State/version, active plan, progress, coverage, decisions and outcome dimensions. |
| `GET /runs/:id/findings` | Tenant-scoped cursor page with linked existing work and coverage. |
| `POST /runs/:id/plans` | Bounded asynchronous draft/revision; current approved plan remains active until replacement activation. |
| `GET /plans/:id` | Immutable content/hash, resources, authority needs and evidence. |
| `POST /plans/:id/approve` | Transactional approval/grant/action intent; no provider call inside transaction. |
| `POST /runs/:id/pause` | Prevent new dispatch; preserve reconciliation and actual effects. |
| `POST /runs/:id/resume` | Revalidate active plan, authority, source versions and resources before dispatch. |
| `POST /runs/:id/cancel` | Release unused claims; retain shared valid sponsorship and in-flight reconciliation. |
| `GET /runs/:id/outcomes` | Activity, observed outcomes, estimated effects, accounting basis and completeness separately. |
| `POST /grants` | Authorized capability-specific grant; server derives grantor and company. |
| `POST /grants/:id/revoke` | Versioned revocation immediately affects new consequential dispatch. |

Use idempotency keys for consequential commands; replay the same result for the same tenant/key/request, reject a changed request under that key, and enforce a reviewed key retention/scope policy. A key does not replace atomic version, lease, authority, consent or resource checks. No inline model or provider calls occur in request handling. Grant issuance/revocation uses current authorized actors and versioned scope.

## Lifecycle and transaction boundary

Keep three independent dimensions: mission/step workflow, outcome verdict and effect evidence. Review completion may leave already acquired work in monitoring. A completed workflow can have target_not_met or not_evaluable. Missing required evidence stays pending while it can mature; otherwise not_evaluable. Headline target attainment plus a failed mandatory safeguard is not target_met.

Dispatch sequence:

1. Claim a tenant-scoped ready step using expected revision/state and a bounded lease.
2. Load the immutable approved payload and current grant; check active-plan membership.
3. Recheck current run pause/cancel state, entity ownership, authority, consent, source versions, shared exposure and live domain resources. Serialize pause/cancel against final dispatch authorization; an already claimed but undispatched worker is not exempt.
4. In one database transaction, reserve resources and write action, outbox intent and activity/audit evidence.
5. Commit before calling the provider. Persist/reconcile the resulting receipt with stable request identity.
6. Verify the authoritative domain condition before declaring the step's result verified.

A timeout after a possible effect is needs_reconciliation, not a safe retry. Reconcile the original identity first. Failure of the application to record provider acceptance cannot justify a second send or campaign. Retry limits apply only to known-safe attempts; uncertain effects always take the reconciliation path.

## Plan, intent and cancellation semantics

A semantic intent key contains trusted tenant, underlying opportunity/entity, action intent, cadence window and applicable offer/version. It excludes mission ID so compatible work can be shared. Recipient, content, scope or exposure conflicts require coordinated review, never silent merging.

A new draft leaves the currently approved plan active. Activation of an approved replacement atomically changes the pointer/revision and invalidates obsolete unstarted approvals/steps. Retained actions need explicit compatible authority. Already performed effects and in-flight reconciliation survive.

Pause prevents new dispatch. Cancellation releases unused claims and detaches that mission's sponsorship. A remaining valid sponsor may continue shared work under sufficient authority. Neither operation unsends a message or refunds a payment. Any supported compensation has its own authority and evidence.

## Concrete contract cases

| Group | Cases | Required proof during implementation |
| --- | --- | --- |
| Authority | OM-AUTH-01 through OM-AUTH-12 | Mission choice, role access, tenant boundaries, expired/revoked authority, changed payload, idempotency, bounded substitution, conflicting recipients, stock and agreement terms. |
| Concurrency/recovery | OM-LIFE-01 through OM-LIFE-15 | Same-state edit and expiry races; one claim; transaction rollback; provider-accept/crash; callback order; plan replacement; pause/cancel/shared work; live holds; legacy queued stages; separate verdicts. |

Each case specifies a concrete initial state and exact required result in the JSON. These are test designs, not tests of the application. OM-02/03 require real transaction/concurrency integration evidence against the reviewed head; mocked sequential calls cannot establish those guarantees.

## Event normalization and compatibility

Required envelope facts: trusted tenant, stable event/source identity and source version, correlation/schema version, occurred/received timestamps, payload reference and processing receipt. Preserve both timestamps for late events and service-period corrections. Domain inquiry, estimate, booking, completion, invoice, payment, adjustment, agreement and stock changes drive reevaluation.

Authenticate callbacks and validate account/resource binding before event normalization. Derive tenant from that verified binding. Store unique authenticated events once, preserve correction history, and apply source ordering. A payload company ID or known resource name is not authentication.

Version dispatch-stage evidence so consumers can distinguish intent, provider acknowledgment, delivered/settled evidence and verified domain outcomes. Legacy `agent.execution_succeeded` with a queued/no-send receipt cannot change delivered counts, bookings, cash or mission success. Preserve old consumers and stored product identifiers until an explicit compatible migration is reviewed.

**Codex handoff:** OM-01 agrees strict types/Zod, error mapping, event/identity contracts and affected consumers. OM-02 proves authority/version/claim semantics. OM-03 proves transaction/outbox/callback/recovery semantics. Only then may later packages rely on these guarantees. Part I acceptance and founder permission remain the runtime implementation gate.
