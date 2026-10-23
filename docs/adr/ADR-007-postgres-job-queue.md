# ADR-007 — Postgres-backed job queue (`pg-boss`)

| | |
|---|---|
| **Status** | Proposed |
| **Related** | README §4.2, §9.6, §12.3; ADR-001, ADR-002 |

## Context

Hold expiry, overdue/no-show detection, reminders and the transactional-outbox dispatcher need reliable background execution. `@nestjs/bullmq` requires Redis, which ADR-002 avoids for the MVP.

## Decision (proposed)

Use **`pg-boss`** (or `graphile-worker`) on the same PostgreSQL database. Jobs are idempotent, batch-limited and use `FOR UPDATE SKIP LOCKED`; the worker runs as an always-on process (one extra container), and several workers may run safely. Cross-module side effects are delivered through the transactional outbox (`outbox_events`), written in the same transaction as the change.

## Consequences

- No new infrastructure; jobs share transactional guarantees with the data.
- Job throughput is bounded by Postgres; revisit when job volume grows (Phase 5).
- Must not run on platforms that sleep idle instances.
- Workers need graceful shutdown (stop fetching, finish in-flight, close pool).

## Status note

Becomes **Accepted** when P2-23 (expiry job + outbox runner) is implemented and tested, including two-worker and crash-mid-batch cases.
