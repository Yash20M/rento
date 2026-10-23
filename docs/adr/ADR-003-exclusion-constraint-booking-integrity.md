# ADR-003 — Booking integrity is enforced by an exclusion constraint

| | |
|---|---|
| **Status** | Accepted (2026-10-11) |
| **Related** | README §8.3, §9; ADR-002; ADR-005 |

## Context

Application-level "SELECT; if free then INSERT" checks are a check-then-act race: two requests can both read "free" before either writes. Maintenance, transfers and admin blocks must conflict with bookings in the *same* constraint.

## Decision

All reasons an asset is unavailable live in one ledger, `asset_occupancies`, protected by:

```sql
CONSTRAINT no_overlapping_occupancy
  EXCLUDE USING gist (asset_id WITH =, during WITH &&) WHERE (released_at IS NULL)
```

`during` is a UTC `tstzrange` stored **half-open `[start, end + buffer)`**, enforced by CHECK constraints (`occupancy_bounded`, `occupancy_half_open`, `occupancy_booking_link`). Releasing a row (`released_at`) stops it blocking without deleting history. The default `READ COMMITTED` isolation is sufficient. `SQLSTATE 23P01` on this constraint maps to `409 BOOKING_SLOT_TAKEN`; lock/statement timeouts map to `503 RETRY_LATER`. Application checks are for friendly errors only; **the constraint is the guarantee**.

## Consequences

- Requires `btree_gist`; hours/closure/state rules remain application-enforced.
- Concurrent writers wait on each other's uncommitted index entries; transactions must stay short and use `lock_timeout` (default 3 s).
- Every writer (booking, extension, maintenance block, transfer) must go through the ledger.

## Evidence

Constraint semantics proven on real PostGIS (P1-04: overlap, adjacency, release, shape checks). 400 parallel-scenario executions with zero double bookings, deadlocks or lock timeouts (P1-06). Removing the constraint makes the concurrency suite fail.

## Open point carried to P2-22

With plain `SKIP LOCKED` candidate selection, concurrent *non-overlapping* requests on a hot asset can receive false 409s (measured 19 of 20 in P1-06). The locked-asset policy will be decided and recorded as its own ADR in P2-22.
