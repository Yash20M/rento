# ADR-005 — SQL-first, forward-only migrations with `node-pg-migrate`

| | |
|---|---|
| **Status** | Accepted (2026-10-11, task P1-04) |
| **Supersedes** | the "Proposed" row ADR-005 in README §19.4 |
| **Related** | README §4.3, §9, §15 (Migrations); ADR-003 (exclusion constraint) |

## Context

The schema _is_ the design: the `no_overlapping_occupancy` exclusion constraint, GiST indexes, `tstzrange` and
PostGIS `geography` columns cannot be expressed in an ORM schema DSL (README §4.3). We therefore keep plain
`.sql` files as the single source of truth and query through Kysely (P1-05). A migration tool was still
to be chosen: README named `dbmate` or `node-pg-migrate`.

## Decision

Use **`node-pg-migrate` v9**, driven through its programmatic `runner()`:

- Migrations are plain SQL files in `apps/api/db/migrations/NNNN_snake_case.sql` (4-digit, gapless).
- **Forward-only**: files contain only an up section; the runner wrapper (`src/db/migrate.ts`) exposes
  no `down`. A unit test fails the build if a `Down Migration` marker appears or numbering has gaps.
- All pending migrations run in one transaction under node-pg-migrate's advisory lock; ordering is checked
  (`checkOrder`), history lives in the `pgmigrations` table.
- Applied migrations are **immutable**; mistakes are fixed with a new migration (expand → migrate → contract
  for breaking changes).
- The same `runMigrations()` is used by the CLI (`pnpm --filter api migrate`), CI/CD and the test fixtures,
  so tests exercise the real migration path.
- `CREATE EXTENSION` statements live in the baseline migration (not only in the local Docker init script), so a
  managed database or a Testcontainers instance needs no out-of-band setup beyond the right privileges.

## Alternatives considered

| Option | Why not |
|---|---|
| `dbmate` | Good tool, but a separate Go binary: extra install step on Windows/CI, no in-process runner for tests. |
| Prisma Migrate / Drizzle Kit | Cannot model the exclusion constraint / PostGIS natively; would be a lossy copy of the real schema. |
| Hand-rolled runner | More code to own than a thin wrapper around a maintained tool. |

## Consequences

- Plain SQL review, exact control of constraints and indexes, no generator surprises.
- One runner for dev, tests and deploy.
- − `node-pg-migrate` does not store file checksums, so editing an already-applied file is **not** detected by the
  tool. Mitigation (planned, P1-11): a CI step that fails when a file in `db/migrations/` that exists on the
  main branch is modified or deleted.
- − Migration role vs. least-privilege runtime role separation (README §15) is configured with the deployment (P4).
