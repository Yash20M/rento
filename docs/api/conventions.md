# API conventions

Source of truth: README §14.1. This page states them as rules for people adding endpoints, and marks which are
**implemented** today and which are **planned** (with the task that delivers them).

## Basics

| Topic | Rule | State |
|---|---|---|
| Style / versioning | REST + JSON, URL-versioned `/v1`; additive changes within a version, breaking changes → `/v2`. Health endpoints `/healthz`, `/readyz` live outside `/v1`. | implemented |
| Admin routes | Customer routes under `/v1/…`, staff routes under `/v1/admin/…`; every admin route declares `@RequirePermission` (deny by default). | planned (P2-12) |
| Identifiers | UUIDs. | implemented (schema) |
| Time | ISO-8601 UTC instants (`2030-01-01T04:30:00Z`); stored as `timestamptz`; shown to users in the **drawer's** IANA timezone. | implemented (schema) |
| Money | Integer **paise**, INR only: `{ "amountPaise": 49900, "currency": "INR" }`. | implemented (schema) |
| Coordinates | PostGIS points are `ST_MakePoint(lng, lat)` — **longitude first**. API payloads use `{ "lat": …, "lng": … }`. | implemented (schema) |

## Requests

- **Validation**: DTO classes with `class-validator`. Unknown fields are rejected; **all** field errors are returned
  at once as `422 VALIDATION_FAILED` with `errors: [{ field, message }]` (nested fields as `a.b`). Malformed JSON → `400 VALIDATION_FAILED`. *(implemented)*
- **Request ID**: send `X-Request-Id` (8–128 chars of `A-Za-z0-9._-`) to correlate; otherwise the server generates one.
  The response always carries `X-Request-Id`, equal to the error `traceId` and to `reqId` in the logs. *(implemented)*
- **Authentication**: `Authorization: Bearer <access token>` (15-minute JWT) obtained from `POST /v1/auth/login|register|refresh`. Missing/invalid → `401 UNAUTHENTICATED`; expired → `401 TOKEN_EXPIRED` (refresh and retry). Protect a route with `@UseGuards(AccessTokenGuard)` and read the caller with `@CurrentUser()`. *(implemented, P2-01)*
- **Idempotency**: state-changing `POST`s accept `Idempotency-Key: <uuid>`, scoped per user, stored ≥ 24 h with the
  original response. Replay → same response; same key + different body → `422 IDEMPOTENCY_KEY_REUSED`; still
  processing → `409 REQUEST_IN_PROGRESS`. *(planned, P2-15)*
- **Optimistic concurrency** on mutable admin resources: `ETag` / `version` → `412`/`409`. *(planned)*

## Responses

- **Success** bodies are plain JSON documents typed in the OpenAPI schema (no envelope), except lists.
- **Lists** use cursor pagination: `?limit=25&cursor=…` → `{ "data": [], "page": { "nextCursor": "…", "hasMore": true } }`.
  Admin tables may use offset pagination. Filtering/sorting uses explicit, whitelisted query params
  (`status=confirmed&from=…&to=…&sort=-startsAt`). *(planned, first used by P2-18)*
- **Errors** are always `application/problem+json` — see [error-catalog.md](error-catalog.md).
- **Availability responses are informational snapshots.** The booking `POST` revalidates atomically in the database
  and may still return `409 BOOKING_SLOT_TAKEN`.
- **Rate limits**: `429 RATE_LIMITED` with `Retry-After`; stricter on auth and booking endpoints. *(planned, P2-31)*

## Contract workflow

1. Write the endpoint with DTO classes decorated for `@nestjs/swagger` (`@ApiProperty`, `@ApiOkResponse`, and the
   problem+json error responses it can return).
2. Run `pnpm contracts:generate` — rewrites `packages/contracts/openapi.json` and the generated TS types.
3. Review the diff of `openapi.json`; commit it with the code.
3b. If a schema changed, update the matching Dart model in `apps/mobile/lib/core/api/models/` and run `pnpm mobile:codegen`; `flutter test` (the contract guard) fails if the Dart models and `openapi.json` disagree.
4. `pnpm contracts:check` (CI) fails if the committed contract differs from the code or the typed client no longer compiles.

## Checklist for a new endpoint

- [ ] Route lives under the right prefix; admin routes declare `@RequirePermission`.
- [ ] DTOs validate input; unknown fields rejected; response DTO documented.
- [ ] Authorization tests: no token → 401, wrong owner/permission → 403/404, valid → success.
- [ ] Every error it can return uses an existing `code` (or add one **in all three places**, see the catalog).
- [ ] State-changing `POST` accepts `Idempotency-Key`; admin mutations write an audit row in the same transaction.
- [ ] Money in paise, timestamps in UTC, no precise user coordinates logged or stored.
- [ ] `pnpm contracts:generate` run and the diff reviewed.
