# Renvani audit and build evidence

## Current bounded work

The [build specifications 2–12 delivery index](BUILD-SPECS-02-12.md) records the current documentation, source inventories, focused validation and explicit runtime blockers. Its source baseline is dev `b45b4996b64b16859e44a79b171b11cbe52c3e6a`; PR-only results identify their own heads. Current authority is the FS board, [TEAM.md](../../TEAM.md), [GITHUB_WORKFLOW.md](../../GITHUB_WORKFLOW.md) and founder directive #420. These scoped packages do not reactivate the historical Sprint 0 program or certify a whole-repository security/coverage audit.

## Historical Sprint 0 output plan

The following original output list and classification rules are retained as historical context. They do not establish current assignments, mandatory global gates or completion of files named in the old plan.

Every document in this directory is produced by a Sprint 0 ticket and consolidated by
FSM-0012 into `EXISTING_CODE_AUDIT.md` at the repository root.

| Document | Produced by | Owner |
|---|---|---|
| `REPOSITORY-RECONCILIATION.md` | FSM-0001 | DO-01 |
| `GOVERNANCE-CONFLICTS.md` | FSM-0002 | TL-01 |
| `BACKEND-INVENTORY.md` | FSM-0003 | BE-01 |
| `SCHEMA-INVENTORY.md` | FSM-0004 | BE-02 |
| `FRONTEND-INVENTORY.md` | FSM-0005 | FE-01 |
| `WORKER-INVENTORY.md` | FSM-0006 | FS-02 |
| `TEST-BASELINE.md` | FSM-0007 | QA-01 |
| `DEPENDENCY-AUDIT.md` | FSM-0008 | DO-02 |
| `SECURITY-POSTURE.md` | FSM-0009 | QA-02 |
| `CICD-STATE.md` | FSM-0010 | DO-01 |
| `DOMAIN-MODEL-GAP.md` | FSM-0011 | TL-01 |

## Classification Rubric

Applied identically across every inventory. Every classification requires a written
rationale — "looks fine" is not a rationale.

| Class | Meaning | Consequence |
|---|---|---|
| **KEEP** | Meets V2 standards, correct domain boundary, tested, tenant-safe | Carried forward unchanged |
| **REFACTOR** | Sound domain model and behaviour; violates a standard or lacks tests | Fixed in place, sized S/M/L |
| **REPLACE** | Behaviour needed; implementation cannot carry V2 depth | Rebuilt in its owning sprint |
| **REMOVE** | Out of scope, superseded, or dead | Deleted |

Every REPLACE and REFACTOR item names its owning sprint. Nothing is left unclassified.

## Escalation Rule

Security findings do not wait for the consolidated report. Any P0 — cross-tenant access,
unverified payment webhook, hardcoded credential, client-side authorisation — is escalated to
QA-02 and FSM-0009 the moment it is found.
