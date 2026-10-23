# ADR-006 — Hold → pay → confirm, with idempotency keys and webhook-driven confirmation

| | |
|---|---|
| **Status** | Proposed |
| **Related** | README §9.5, §9.6; ADR-003, ADR-007; open questions Q-2, Q-3 |

## Context

Online payment cannot be inside the booking database transaction, but the slot must not be double-sold while the user pays. Clients on flaky mobile networks retry requests. Gateways deliver webhooks at least once and out of order.

## Decision (proposed)

1. `POST /v1/bookings` creates a short **hold** (`held`, ~10 min) and its occupancy atomically (ADR-003), guarded by an `Idempotency-Key` stored per user with the original response.
2. A gateway order is created after the hold is durable; payment uses **authorize-then-capture** where the gateway supports it (Razorpay manual capture; confirm per payment method, notably UPI).
3. The booking becomes `confirmed` **only** from a verified server-side webhook or status fetch — never from the client's "payment success" callback. Webhooks are verified over the raw body, deduplicated by `event_id`, and processed idempotently with the booking row locked.
4. Late payment on an expired hold: re-insert the occupancy if still free (the constraint decides); otherwise do not capture and void/refund the authorization.
5. A job releases expired holds every ~30 s; the booking path also cleans expired holds for its own window so it never depends on sweeper timing.

## Consequences

- Unpaid holds briefly reduce availability.
- Requires an idempotency store, a webhook dedupe table, an outbox and a job runner (P2-15, P2-23, P4-02).
- Depends on business decisions Q-2 (payment model) and Q-3 (deposits); not accepted until P0-01 answers them.

## Status note

Becomes **Accepted** when P0-01 resolves Q-2/Q-3 and P2-22/P4-02 are implemented and tested (G-02).
