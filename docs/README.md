# ServiceRev — Build Documentation

**Repo:** [SimonShaun2/Renvani](https://github.com/SimonShaun2/Renvani) (formerly `FSM-Platform`)
**Figma (canonical — product + marketing):** [FSM Agent – Product Design](https://www.figma.com/design/jiGHTNUJNltWbHA4Il3hk7/FSM-Agent-%E2%80%93-Product-Design) (`jiGHTNUJNltWbHA4Il3hk7`). UI PRs must cite the implemented frame (`node-id`). Retired: `tAteqeUfdi4GCtZVeaF4DJ`, `LNTOsgJ7D4blaFaTepQt3J`.

---

## Context Files — Every Codex Session
```
1. AGENTS.md
2. TEAM.md
3. GITHUB_WORKFLOW.md
4. CODEX.md
5. WORKFLOW.md (historical product-flow reference only — not operative build instructions)
6. planning/PHASE2-MASTER-PLAN.md (legacy planning)
7. FS-* board ticket / mapped GitHub issue
8. docs/fsm-schema.ts
9. Figma PNGs (design sessions only)
```

---

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
