# API error catalog

Every error response is RFC 9457 `application/problem+json`:

```json
{
  "type": "urn:rento:problem:booking-slot-taken",
  "title": "Conflict",
  "status": 409,
  "code": "BOOKING_SLOT_TAKEN",
  "detail": "The requested slot is no longer available",
  "errors": [{ "field": "startsAt", "message": "…" }],
  "traceId": "0d2f…"
}
```

- Clients branch on **`code`** (stable, machine-readable), never on `detail` (human text, may change).
- `errors[]` appears on `VALIDATION_FAILED` only. `traceId` equals the `X-Request-Id` response header.
- Unexpected failures are always `500 INTERNAL_ERROR` with a generic `detail`; the real cause is only in the
  server log, keyed by `traceId`.
- This file is kept in sync with README §14.2 and with the `ErrorCode` constant in
  `apps/api/src/common/errors/error-codes.ts` by `apps/api/test/unit/docs.unit.spec.ts` (three-way check).
  **To add a code, change all three together.**

| HTTP | Code | Meaning for clients | Raised by (task) |
|---|---|---|---|
| 400/422 | `VALIDATION_FAILED` | Schema or field errors (422 with `errors[]`); malformed JSON body (400). | P1-03 |
| 401 | `UNAUTHENTICATED` | Missing or invalid credentials/token. | P1-03 mapping, P2-01 |
| 401 | `TOKEN_EXPIRED` | Access token expired — refresh and retry. | P2-01 |
| 403 | `FORBIDDEN` | Authenticated but not allowed (not the owner, wrong audience). | P2-12 |
| 404 | `NOT_FOUND` | Unknown route, or resource not visible to the caller. | P1-03 |
| 409 | `EMAIL_TAKEN` | Registration with an email that already has an account. | P2-01 |
| 409 | `BOOKING_SLOT_TAKEN` | Lost the race / no free unit for the window. Re-query availability. | P1-05 mapper, P2-22 |
| 409 | `ALREADY_EXISTS` | A record with the same unique value (asset code, category slug, …) already exists. | P2-16 |
| 409 | `IN_USE` | Still referenced by other records; remove or move the dependants first. | P2-16 |
| 409 | `HAS_FUTURE_BOOKINGS` | Upcoming bookings prevent deactivating an item model, retiring an asset or closing a drawer. | P2-16 |
| 409 | `INVALID_STATE` | The booking is not in a state that allows this action (for example cancelling a rental that has started). | P2-24 |
| 422 | `PAYMENT_INVALID` | The payment confirmation did not verify (wrong order, payment id or signature). | M3 |
| 403 | `KYC_REQUIRED` | The customer must verify their identity (Aadhaar) before booking. | P2-37 |
| 409 | `AADHAAR_IN_USE` | That Aadhaar is already verified on another account. | P2-37 |
| 409 | `EXTENSION_UNAVAILABLE` | The next booking blocks the extension. | P2-25 |
| 409 | `REQUEST_IN_PROGRESS` | Same idempotency key is still being processed. | P2-15 |
| 410 | `HOLD_EXPIRED` | Paying for an expired hold. | P4-02 |
| 422 | `DRAWER_CLOSED` | Drawer closed for the requested window. | P2-22 |
| 422 | `OUTSIDE_SERVICE_AREA` | Location is outside every active service zone. | P2-20 |
| 422 | `DURATION_INVALID` | Duration not a slot multiple or outside min/max. | P2-22 |
| 422 | `LEAD_TIME_VIOLATION` | Start too soon or beyond the booking horizon. | P2-22 |
| 422 | `IDEMPOTENCY_KEY_REUSED` | Same `Idempotency-Key` with a different payload. | P2-15 |
| 401 | `SOCIAL_TOKEN_INVALID` | Google/Meta/Apple token failed verification. | P2-03 (core), P2-04…P2-06 (verifiers) |
| 409 | `ACCOUNT_LINK_REQUIRED` | Provider email matches an existing account but cannot be trusted to auto-link; sign in with the existing method, then link. | P2-03 |
| 409 | `LAST_LOGIN_METHOD` | Unlinking would leave the account with no sign-in method. | P2-07 |
| 401 | `REAUTH_REQUIRED` | A sensitive step needs a recent sign-in; refreshing the session does not help, the user must sign in again. | P2-07 |
| 409 | `IDENTITY_IN_USE` | That provider account is already linked to a different user, or the caller already has another account of that provider linked. | P2-07 |
| 403 | `PERMISSION_DENIED` | Caller lacks the required permission. | P2-12 |
| 403 | `MFA_REQUIRED` | Two-step verification is required for administrators and this session has not passed it: enter the authenticator code (`POST /v1/auth/session/mfa/verify`), or set it up first. | P4-05 |
| 403 | `STEP_UP_REQUIRED` | A sensitive admin action (roles, admins, refunds) needs the second step proved recently: enter a fresh code, then repeat the request. | P4-05 |
| 403 | `ROLE_ESCALATION` | Attempt to grant permissions the caller does not hold. | P2-13 |
| 409 | `LAST_SUPER_ADMIN` | Would remove/deactivate the last active Super Admin. | P2-13 |
| 409 | `ROLE_IN_USE` | Role is assigned to users and cannot be deleted. | P2-09 |
| 409 | `ROLE_LOCKED` | System role (Super Admin) cannot be edited or deleted. | P2-09 |
| 429 | `RATE_LIMITED` | Throttled; honour `Retry-After`. | P2-31 |
| 503 | `RETRY_LATER` | Lock/statement timeout, dependency down, or shutting down. Safe to retry. | P1-03, P1-05 |
| 500 | `INTERNAL_ERROR` | Unexpected server error (details are logged, never returned). | P1-03 |

## Mapping rules (implemented in `common/errors/problem.ts`)

| Thrown | Becomes |
|---|---|
| `AppError(status, code, detail, errors?)` | exactly that |
| Nest `HttpException` 401 / 403 / 404 / 429 / 503 | `UNAUTHENTICATED` / `FORBIDDEN` / `NOT_FOUND` / `RATE_LIMITED` / `RETRY_LATER` |
| Any other 4xx `HttpException` or Fastify client error (`FST_*`) | `VALIDATION_FAILED` with the original status |
| Any other 5xx, unknown `Error`, non-`Error` throw | `500 INTERNAL_ERROR` |
| PostgreSQL `23P01` on `no_overlapping_occupancy` | `SlotTakenError` → `409 BOOKING_SLOT_TAKEN` |
| PostgreSQL `55P03` (lock timeout), `57014` (statement timeout) | `RetryLaterError` → `503 RETRY_LATER` |
| PostgreSQL `23505` (unique violation) | `UniqueViolationError` — **not** an API error; the owning service translates it to a specific code, otherwise it surfaces as `500` |
