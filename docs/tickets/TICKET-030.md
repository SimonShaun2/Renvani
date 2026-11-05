> **Historical instruction snapshot — clarified 2026-11-05 UTC.** The original text below is retained for traceability, including retired brand/Figma references, agent assignments, schema snapshots and milestone claims. It is not the current build queue or design authority. Current work follows [AGENTS.md](../../AGENTS.md), [TEAM.md](../../TEAM.md), the FS board, and the [Renvani Figma parity contract](../design/RENVANI_FIGMA_PARITY.md). Use canonical Figma file `jiGHTNUJNltWbHA4Il3hk7` and `packages/db/src/schema.ts`; do not implement old copy, use stale `fsm-schema.ts`, or rename persisted keys from this historical text.

# TICKET-030: Basic Reporting Dashboard

**Phase:** 2D
**Assigned:** Agent 2
**Auditor:** Agent 4
**Priority:** P1
**Dependencies:** TICKET-029 APPROVED

---

## Figma Reference

**Export from figma.com/design/LNTOsgJ7D4blaFaTepQt3J:**
- 📊 Basic Reporting page

---

## Acceptance Criteria

- [ ] `/reporting` dashboard
- [ ] Period selector: This Month / Last Month / Last 3 Months /
      Last 12 Months / Custom Range
- [ ] KPI row: Revenue | Jobs | Estimates Sent | Conversion Rate |
      Avg Ticket Value (with trend vs prior period)
- [ ] Revenue bar chart (30 days, daily bars, Recharts)
- [ ] Tech utilization bars (per tech)
- [ ] Pipeline metrics: Estimates Pending | Invoices Unpaid |
      Active Agreements | Overdue Invoices
- [ ] Estimate conversion donut chart (Recharts)
- [ ] Review score breakdown (star distribution)
- [ ] Recent Activity feed (last 10 events)
- [ ] Export to CSV button (basic — downloads current view data)

---

## Agent 2 Owns

### API hooks
`apps/web/src/hooks/reporting.hooks.ts`

```typescript
export function useReportingKPIs(period: ReportingPeriod)
export function useRevenueChart(period: ReportingPeriod)
export function useTechUtilization(period: ReportingPeriod)
export function usePipelineMetrics()
export function useEstimateConversion(period: ReportingPeriod)
export function useReviewScore(period: ReportingPeriod)
```

### Reporting page
`apps/web/src/app/(app)/reporting/page.tsx`

Period selector at top right.
All sections re-fetch when period changes.

**KPI row:**
`apps/web/src/components/reporting/KPIRow.tsx`
5 cards. Each: label | value (large bold) | trend badge (↑ green / ↓ red).

**Revenue Chart:**
`apps/web/src/components/reporting/RevenueChart.tsx`
Recharts BarChart. X axis: dates. Y axis: dollar amounts.
Today's bar highlighted blue, all others light blue.
Tooltip: date + revenue.

**Tech Utilization:**
`apps/web/src/components/reporting/TechUtilization.tsx`
Per-tech: name | progress bar (colored by %) | % label | jobs count.
Green > 80%, orange 60–80%, red < 60%.

**Pipeline Metrics:**
`apps/web/src/components/reporting/PipelineMetrics.tsx`
4 metric rows: label | count | dollar value.

**Estimate Conversion Donut:**
`apps/web/src/components/reporting/ConversionDonut.tsx`
Recharts PieChart. Center: conversion %. Legend: Approved/Pending/Declined.

**Review Score:**
`apps/web/src/components/reporting/ReviewScore.tsx`
Large rating number + stars + count.
5-star breakdown: each star row with progress bar + %.

**CSV Export:**
Client-side export of the currently visible KPI data.
Uses `Papa.unparse()` (papaparse) to generate CSV.
Triggers browser download.

---

## Agent 4 Audit Checklist

- [ ] `pnpm build` passes clean
- [ ] No `any` types
- [ ] Period selector re-fetches all sections
- [ ] Trend badges use correct color (green up, red down)
- [ ] Revenue chart X axis shows correct date range
- [ ] Today's bar highlighted
- [ ] Tech utilization color thresholds correct
- [ ] Donut chart renders without NaN when no data
- [ ] CSV export downloads correctly in Chrome + Safari
- [ ] Owner/admin only route guard

---

## Notes
- Reporting endpoints are aggregation — use existing jobs/invoices/estimates
  endpoints with date filters until dedicated reporting endpoints are built
- `GET /api/v1/jobs?status=completed&startDate=&endDate=`
- `GET /api/v1/invoices?startDate=&endDate=`
- Git commit: "TICKET-030: Basic Reporting Dashboard"

---