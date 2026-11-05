# Renvani — Build Documentation

**Repo:** [SimonShaun2/Renvani](https://github.com/SimonShaun2/Renvani) (formerly `FSM-Platform`)
**Canonical current Figma (ALL UI):** [FSM Agent – Product Design](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-%E2%80%93-Product-Design)
**Design-to-code acceptance:** [docs/design/RENVANI_FIGMA_PARITY.md](design/RENVANI_FIGMA_PARITY.md) — exact node IDs and screenshot-based QA required.

**Current execution:** [AGENTS.md](../AGENTS.md), [TEAM.md](../TEAM.md), [GITHUB_WORKFLOW.md](../GITHUB_WORKFLOW.md), [CODEX.md](../CODEX.md), and the [Field Service Build Board](https://app.notion.com/p/74b3a1145d3f49d586ac6cdbf174ceb2).

## Current reference entry points

| Need | Source |
| --- | --- |
| Design-to-code acceptance and brand boundary | [Renvani Figma parity contract](design/RENVANI_FIGMA_PARITY.md) |
| Design surfaces and implementation evidence | [FS-51 handoff](design/FS-51-figma-production-handoff.md) and its [single route map](design/fs-51-figma-route-map.json) |
| Every current page file | [Frontend source inventory](audit/FRONTEND-INVENTORY.md); 112 page files at its recorded dev head, not 112 accepted journeys |
| Operator execution checks | [Operator acceptance packet](audit/OPERATOR-ACCEPTANCE.md) |
| Architecture records and status | [ADR index](adr/README.md) |
| Current platform/environment references | [Official operational stack](OFFICIAL-OPERATIONAL-STACK.md) and [CI/environment evidence](audit/CICD-STATE.md) |
| Ownership of overlapping documentation PRs | [Documentation reconciliation ledger](audit/DESIGN-DOCS-RECONCILIATION.md) |

The only current design file is `jiGHTNUJNltWbHA4Il3hk7`. The earlier separate app/marketing file IDs are retired. Exact source frames, actual browser evidence and independent design acceptance are required; file links and CI success alone establish neither parity nor working journeys.

> **Archive boundary:** The Phase 1/2/3, deployment, migration and test-count sections below preserve earlier milestone claims. They are not current completion evidence. `docs/planning/PHASE2-MASTER-PLAN.md`, both `PHASE3-*.md` plans and legacy `docs/tickets/TICKET-*.md` are historical instruction snapshots. Their retired brand, Figma IDs, agents, schema copies, proposed domains and acceptance text do not authorize current work. Use the current board and governing documents above. Preserve persisted keys and migration history unless a separately reviewed compatibility change requires otherwise.

---

## Context Files — Every Codex Session
```
1. AGENTS.md
2. TEAM.md
3. GITHUB_WORKFLOW.md
4. CODEX.md
5. Current FS-* board ticket / explicitly mapped GitHub issue
6. packages/db/src/schema.ts (sole authoritative schema)
7. Versioned contracts and current runbooks relevant to the ticket
8. docs/design/RENVANI_FIGMA_PARITY.md and exact canonical frames for UI work
9. Historical plans only when needed for traceability; never as current instructions
```

---

## Historical milestone record

The following claims are preserved as originally recorded and are not revalidated by this documentation update.

## Phase 1 — Backend (v1.0.0) ✅
| Ticket | Description |
|---|---|
| TICKET-001 | Monorepo Scaffold |
| TICKET-002 | Auth + Company Setup |
| TICKET-003 | Core Customer API |
| TICKET-004 | Technician API |
| TICKET-005 | Job Lifecycle API |
| TICKET-006 | Estimates API |
| TICKET-007 | Invoices + Payments |
| TICKET-008 | Stripe Connect + Webhooks |
| TICKET-009 | Service Agreements |
| TICKET-010 | BullMQ Workers Foundation |
| TICKET-011 | CSV Import + AI Mapping |
| TICKET-012 | AI Revenue Engine v1 |
| TICKET-013 | AI Message Drafting + SMS |

## Phase 2 — Full Frontend (v2.0.0) ✅
| Ticket | Description |
|---|---|
| TICKET-014 | Design System + Layout Shell |
| TICKET-014a | Product Catalog API |
| TICKET-014b-e | Time/OTW/Reviews/Files/Dispatch/Booking APIs |
| TICKET-015 | Dashboard + AI Revenue Center |
| TICKET-016 | Dispatch Board |
| TICKET-017 | Customer + Property + Asset |
| TICKET-018 | Job Detail |
| TICKET-019 | Estimates + Invoices |
| TICKET-020-025 | Mobile + Tablet + Photos + Booking Flow |
| TICKET-026 | Product Catalog UI |
| TICKET-027 | Service Agreements UI |
| TICKET-028 | Review Requests Dashboard |
| TICKET-029 | Technician Profiles |
| TICKET-030 | Basic Reporting |
| TICKET-031 | Settings All Tabs |
| TICKET-032 | CSV Import Wizard UI |

## Phase 3 — AI + Growth (v3.0.0) ✅
| Ticket | Description |
|---|---|
| TICKET-033 | AI Dispatch Intelligence |
| TICKET-034 | Advanced Reporting |
| TICKET-035 | Agency Multi-Tenant |
| TICKET-036 | Marketing Landing Page |
| TICKET-037 | Mobile Push Notifications |
| TICKET-038 | Customer Portal |

## Deployment
| File | Description |
|---|---|
| TICKET-039 | Production Config (Railway + Vercel) |
| planning/PRODUCTION-DEPLOYMENT.md | Full infrastructure setup guide |

---

## DB Migrations
- 0001–0012: Phase 1
- 0013: product_catalog, job_tasks, job_products, serviceZipCodes
- 0014: time_entries, review_requests, file_attachments, otw, booking
- 0015: technician availableDays
- 0016: booking settings, automation rules
- 0017: agency_memberships, push_subscriptions, customer_portal_sessions

## Test Counts
- API: 281/281
- Worker: 38/38
