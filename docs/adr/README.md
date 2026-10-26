# Architecture Decision Records

Short records of the decisions that shape Rento. The design narrative lives in the root [README](../../README.md)
(§19.4 lists them); each ADR here states the decision, its trade-offs and the evidence.

**Rules**

- An ADR is **Accepted** only when the decision is implemented and covered by passing tests (or explicitly
  decided by the product owner). Otherwise it stays **Proposed** and says what will make it Accepted.
- Never rewrite history: to change a decision, add a new ADR that supersedes the old one and link both.
- A unit test (`apps/api/test/unit/docs.unit.spec.ts`) keeps this folder, the README §19.4 table and the status
  lines consistent.

| ADR | Decision | Status |
|---|---|---|
| [ADR-001](ADR-001-modular-monolith.md) | Modular monolith | Accepted |
| [ADR-002](ADR-002-postgresql-postgis.md) | PostgreSQL + PostGIS as sole primary store (no Redis in MVP) | Accepted |
| [ADR-003](ADR-003-exclusion-constraint-booking-integrity.md) | Booking integrity via exclusion constraint on `asset_occupancies` | Accepted |
| [ADR-004](ADR-004-nestjs-typescript-backend.md) | NestJS (TypeScript, Fastify) backend | Accepted |
| [ADR-005](ADR-005-sql-first-migrations.md) | SQL-first, forward-only migrations (`node-pg-migrate`) + Kysely | Accepted |
| [ADR-006](ADR-006-hold-pay-confirm.md) | Hold → pay → confirm, idempotency keys, webhook-driven confirmation | Proposed |
| [ADR-007](ADR-007-postgres-job-queue.md) | Postgres-backed job queue (`pg-boss`) | Proposed |
| [ADR-008](ADR-008-riverpod-flutter-state.md) | Riverpod for Flutter state | Proposed |
| [ADR-009](ADR-009-react-vite-spa-admin.md) | React + Vite SPA admin sharing the API | Accepted |
| [ADR-010](ADR-010-rest-openapi-contract-first.md) | REST + OpenAPI contract-first clients (TS generated; Dart hand-written + contract guard) | Accepted |
| [ADR-011](ADR-011-postgis-geography-discovery.md) | PostGIS `geography`, discovery filters-then-ranks, configurable policy | Proposed |
| [ADR-012](ADR-012-auth-tokens.md) | Auth: Argon2id, short JWT, rotating hashed refresh tokens | Accepted |
| [ADR-013](ADR-013-rbac-permission-catalog.md) | RBAC: code-defined catalog, data-defined roles, locked Super Admin | Proposed |
| [ADR-014](ADR-014-social-login.md) | Social login: server-verified provider tokens, identity key `(provider, subject)` | Proposed |
| [ADR-015](ADR-015-locked-asset-policy.md) | Booking claim when every free-looking unit is locked: wait instead of a false conflict | Accepted |
| [ADR-016](ADR-016-remembered-search-place.md) | The app remembers the last search place on the device, rounded to ~1 km, deleted at sign-out (amends README §10.6) | Accepted |

**Pending ADRs** (recorded when decided): locked-asset policy for the booking claim (P2-22, see ADR-003's open
point).
