# ADR-002 — PostgreSQL + PostGIS as the sole primary store

| | |
|---|---|
| **Status** | Accepted (2026-10-11) |
| **Related** | README §4.2, §10; ADR-003, ADR-007, ADR-011 |

## Context

The product needs relational integrity, ACID transactions under concurrent writes, **declarative prevention of overlapping time ranges**, and indexed geographic queries ("nearest drawers") — ideally in one transactional system.

## Decision

Use **PostgreSQL 16+** with the `postgis`, `btree_gist` and `pgcrypto` (and `citext`) extensions as the only primary datastore. **No Redis in the MVP**: jobs use a Postgres-backed queue (ADR-007), rate limiting is in-memory per instance, availability needs no cache, and live updates (if ever) can use `LISTEN/NOTIFY`. Redis must never arbitrate booking conflicts.

## Consequences

- The chosen managed-Postgres vendor must support PostGIS, `btree_gist` and PITR in an acceptable region (checked in P0-06 / P4-11).
- Transactional DDL makes migrations safer (ADR-005).
- If availability reads or job volume saturate Postgres, revisit with measurements (Phase 5), not speculation.

## Alternatives considered

MySQL (no equivalent to exclusion constraints), MongoDB (weak relational integrity, app-level overlap checks only), Redis as a lock arbiter (locks expire/fail over; the database constraint cannot).

## Evidence

Baseline schema with extensions (P1-04); local stack `postgis/postgis:16-3.4` (P1-02); parallel-claim suite on a real PostGIS container (P1-06).
