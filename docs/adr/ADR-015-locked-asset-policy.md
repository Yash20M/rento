# ADR-015 — What the booking transaction does when every candidate asset is row-locked

| | |
|---|---|
| **Status** | Accepted (implemented and tested in M3 / P2-22) |
| **Related** | README §9.3, §9.4; ADR-003, ADR-006; P1-06 spike finding |

## Context

README §9.4 picks a candidate asset with `FOR UPDATE OF a SKIP LOCKED LIMIT 1` so that concurrent requests for the same model fan out over different free units. The P1-06 spike showed the side effect: when the only free-looking unit is row-locked by an **in-flight claim for a different, non-overlapping slot**, `SKIP LOCKED` returns no row and the request would answer `409 BOOKING_SLOT_TAKEN` although the slot is free — a false conflict.

## Decision

1. First look for a candidate with `FOR UPDATE SKIP LOCKED` (fan-out, no waiting).
2. If **no row** is returned **and this transaction holds no other asset lock yet**, repeat the same query with a plain blocking `FOR UPDATE`, bounded by `lock_timeout` (3 s). The request then waits for the other claim to finish and is decided on the truth: if the other claim took the slot, the overlap check finds it (or the exclusion constraint raises `23P01`); if not, this request gets the unit.
3. At most 3 candidates are tried per request; each insert runs under a savepoint and a `23P01` moves on to the next candidate. No candidate left ⇒ `409 BOOKING_SLOT_TAKEN`. `55P03` (lock timeout) ⇒ `503 RETRY_LATER`.
4. The blocking fallback is only taken while no other asset lock is held, so two requests can never wait on each other in a cycle (no deadlock).

The exclusion constraint `no_overlapping_occupancy` stays the only guarantee; this policy only removes false 409s and never weakens it.

## Consequences

- A request on a hot asset can wait up to `lock_timeout` for a concurrent claim; it never returns a wrong 409 for a free slot.
- Admin changes to an asset (maintenance, retire, transfer) take the same row lock and serialise with booking claims.
- Tested by the P1-06 spike matrix and by the HTTP-level concurrency tests of M3 (parallel requests, different slots on one unit ⇒ all succeed).
