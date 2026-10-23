# ADR-001 — Modular monolith

| | |
|---|---|
| **Status** | Accepted (2026-10-11) |
| **Related** | README §6.1, §12.3; ADR-003 |

## Context

The booking flow's correctness depends on one transaction touching inventory, occupancy, bookings, idempotency and audit rows. The team is small (README §6.1: 2–8 engineers).

## Decision

Build one deployable NestJS application (plus a job-worker entrypoint) with **enforced module boundaries** (`auth-users`, `inventory`, `drawers`, `booking`, `rental`, `payments`, `notifications`, `admin`, `reporting-audit`). Modules expose a small service interface through `index.ts`; cross-module side effects use the transactional outbox; reads across modules for reporting use read-only SQL views.

## Consequences

- A single `COMMIT` covers the whole booking write; no sagas or distributed transactions.
- One deployable, one database, one CI pipeline.
- Boundary discipline must be enforced by tooling (lint rule, README §12.3), not goodwill.
- A module (notifications, reporting) can be extracted later along the existing boundaries if load or team structure demands it.

## Alternatives considered

Microservices — rejected for the MVP: distributed transactions for the most critical flow, high operational burden for the team size.

## Evidence

Implemented as a single Nest application since P1-03; the booking-integrity spike (P1-06) runs entirely inside one database transaction.
