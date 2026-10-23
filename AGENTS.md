# Rento — instructions for AI coding agents

Canonical agent instructions for this repo (read by Codex/Cursor/etc. directly; `CLAUDE.md` imports this file).
Rento is a time-based rental platform: Flutter app + React admin + NestJS API + PostgreSQL/PostGIS.

## Start of every session
1. Read `README.md` (design — *what/why*) and `DEVELOPMENT_PLAN.md` (task tracker — *what next/how*). Do not rely on memory of them; re-read the sections the current task references.
2. Report the next eligible task (first `[ ]` whose `Depends` are all `[x]`) before starting work, unless the user named a task.

## Work protocol (mandatory — `DEVELOPMENT_PLAN.md` §2)
- One task at a time. **Step 1 is always writing a task-specific prompt** to `docs/prompts/<TASK-ID>.md` using the template in §3, passing its quality check. Then plan → tests first → implement → run gates → self-review → record Evidence → tick `[x]` → add Progress-log line → refresh dashboard → **stop** (continue only if told "continue").
- **Fast-track mode (owner-approved 2026-10-17, `DEVELOPMENT_PLAN.md` §1A):** work in milestones M1…M6. One short prompt file per milestone (`docs/prompts/M<n>.md`), no stop between tasks inside a milestone (stop at the boundary with a demo + report), `pnpm check` + targeted tests per task and full `pnpm verify` per milestone, mutation checks only for booking integrity / authorization / money / credentials. Every invariant below still applies.
- **Never tick a task** without passing tests in the current working tree and a filled `Evidence:` line (date · commands · result counts). Never skip, disable, or weaken tests/constraints/lint to get green. A flaky test is a bug.
- If blocked or a business rule is ambiguous (`README.md` §19.3, `Q-n`), mark `[!]` with the reason and **ask the user**. Do not invent business rules.
- No scope creep: discovered work becomes a new numbered task in the right phase, not a silent addition. Don't silently diverge from the README; propose an ADR change instead.
- Ask before destructive or outward-facing actions (dropping data, force-push, publishing, sending messages, creating cloud accounts/keys).

## Non-negotiable invariants (from the README)
- **Booking integrity lives in the database**: exclusion constraint `no_overlapping_occupancy` on `asset_occupancies (asset_id =, during &&) WHERE released_at IS NULL`, half-open `[start, end)` `tstzrange`. App-level checks never replace it. Map SQLSTATE `23P01` → `409 BOOKING_SLOT_TAKEN`; `55P03` → `503 RETRY_LATER`. Availability responses are snapshots.
- Money = integer **paise**, INR. Timestamps = UTC `timestamptz`; display in the **drawer's** IANA timezone. PostGIS points are `ST_MakePoint(lng, lat)` — longitude first.
- Schema = **SQL-first, forward-only migrations**; never edit an applied migration. Kysely for queries; no ORM-owned schema.
- Errors = RFC 9457 `application/problem+json` with stable `code`s (`README.md` §14.2). OpenAPI is generated; `pnpm contracts:check` must pass when the API changes.
- **Authorization is server-side, deny-by-default**: every `/v1/admin/*` route declares `@RequirePermission`. Permissions are code-defined; roles are data; Super Admin is locked, can't be removed if last, no privilege escalation, no self role changes (`README.md` §13.5).
- **Social login**: verify provider tokens server-side; identity key is `(provider, subject)`; never auto-link on unverified/missing email; always keep ≥1 sign-in method; Sign in with Apple ships on iOS with Google/Meta (`README.md` §15.1).
- Security hygiene: parameterised SQL only; no secrets in code/logs/mobile app; never log tokens, passwords, or precise user coordinates; audit-log every admin mutation in the same transaction.
- No free-tier hosting for real bookings; Redis is out of the MVP (use the Postgres-backed queue).

## Testing rules (`DEVELOPMENT_PLAN.md` §5–§6)
- DB/API tests run against a **real PostgreSQL+PostGIS container** (Testcontainers), not mocks. Inject a `Clock`; never `sleep`.
- Fake external providers (payments, FCM, email, Google/Meta/Apple) at the adapter interface; real-device/real-account checks are recorded manual checklists.
- Every protected endpoint: no token → 401; wrong owner/permission → 403/404; valid → success. Concurrency tests use real parallel requests and assert DB invariants.
- Gates (all exist since Phase 1; see `docs/ci.md`): quick `pnpm check` (lint + typecheck) while coding; `pnpm verify:fast` (no Docker/browser); full `pnpm verify` (16 gates, per-step summary) before ticking a task. Individual gates: `pnpm lint`, `pnpm typecheck`, `pnpm --filter api test:unit|test:db|test:api|test:concurrency`, `pnpm contracts:check`, `pnpm --filter admin test|test:e2e`, `pnpm mobile:analyze|mobile:test|mobile:format:check|mobile:codegen:check`. CI (`.github/workflows/ci.yml`) runs the same gates; the single required check is `ci-success`.

## Environment notes
- Developer machine is Windows 11 (PowerShell primary; Git Bash available). Docker is installed. Prefer cross-platform scripts (`pnpm`, Node) over shell-specific ones; with Git Bash, set `MSYS_NO_PATHCONV=1` when passing container paths.
- Repo layout target: `apps/api`, `apps/admin`, `apps/mobile`, `packages/contracts`, `packages/config`, `infra/`, `docs/` (`README.md` §12.1).
- Commits: `feat(P2-22): create booking hold` — body lists tests run. Only commit when the user asks.
