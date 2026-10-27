# ADR-FS-59: Recurring visit series and occurrence model

**Status:** Proposed  
**Owner:** Felix (Pair 3)  
**Date:** 2026-10-23  
**Ticket:** FS-59  

---

## Problem

Service agreements and the booking recurring hook only link a single `maintenance_visit` row per confirmed booking. They do not generate a durable, idempotent series of future visits with overrides and timezone-safe local dates.

## Current Approach

`booking-recurring-schedule.service` classifies booking intent and inserts one `maintenance_visits` row when an active `maintenance_plans` row exists.

## Proposed Approach

Add tenant-scoped `recurring_visit_series` and `recurring_visit_occurrences` tables (migration **0047**). A dedicated service generates **N** occurrence rows from series anchor date, `maintenance_plan_frequency`, and company IANA timezone using calendar-month steps (`Temporal`). Uniqueness on `(series_id, occurrence_index)` makes regeneration idempotent. Booking confirmation continues to own the first visit link; when linked, it ensures a series exists and generates a small default horizon.

`maintenance_visits` and external schedulers remain the operational visit record until a later adapter explicitly promotes occurrences to jobs.

## Benefit

Closes the architecture gap between billing/reminders and schedulable visit instances without overloading `maintenance_plans` or reminder workers.

## Migration Cost

One SQL migration; no backfill required. New code paths are additive behind series creation from existing booking link.

## Security Impact

All queries scoped by `company_id`. Unique constraints prevent cross-tenant collision; RLS inherits existing tenant session patterns on new tables (future STACK hardening if required).

## Decision

**Proposed** — pending peer review, Security migration review, and batch CI on PR head.

## Consequences

Future dispatch/scheduling features read occurrences first; job creation becomes an explicit promotion step. Incumbent scheduler integrations must respect `external_scheduler_authoritative` flags in a follow-on ticket.
