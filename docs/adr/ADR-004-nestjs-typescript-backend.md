# ADR-004 — NestJS (TypeScript, Fastify adapter) backend

| | |
|---|---|
| **Status** | Accepted (2026-10-11) |
| **Related** | README §4.1, §12.2; ADR-001, ADR-009, ADR-010 |

## Context

Booking correctness is guaranteed by PostgreSQL (ADR-003), so it is identical in every candidate language. The language choice decides team velocity, contract sharing and operating cost.

## Decision

TypeScript + **NestJS 12 on Fastify**, `class-validator` DTOs, `@nestjs/swagger` for OpenAPI, `pino` logging, Zod for configuration.

Why: one language across API and admin SPA (shared types via the generated contract), contract-first is cheap, modules/guards/interceptors map to the module boundaries and to RBAC/idempotency/audit, the hard problem is solved in SQL so Node's weaknesses are irrelevant, and hiring/cost are favourable.

## Consequences

- Nest 12 packages are ESM; the app is built as CommonJS following Nest's template and relies on Node ≥ 22.12 `require(esm)` (engines enforced in `package.json`).
- esbuild-based runners do not emit decorator metadata, so tests use SWC (`unplugin-swc`) and builds use `tsc`.
- Nest's queue integration needs Redis; we use a Postgres queue instead (ADR-007).
- Honest runner-up: Go + `pgx` + `sqlc`; the SQL in the README ports unchanged if hosting cost or team skills shift.

## Evidence

API skeleton with problem+json, validation, health, OpenAPI and graceful shutdown (P1-03); OpenAPI contract export (P1-07).
