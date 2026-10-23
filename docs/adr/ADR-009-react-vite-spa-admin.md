# ADR-009 — React + Vite SPA admin sharing the API

| | |
|---|---|
| **Status** | Accepted (2026-10-11) |
| **Related** | README §4.5, §13; ADR-004, ADR-010 |

## Context

The admin panel is a logged-in internal tool: no SEO, no SSR need. Authorization must be enforced in one place only — the API (README §13.2).

## Decision

A **React 19 + TypeScript + Vite** single-page app (`apps/admin`) using React Router (data router), TanStack Query for server state, Tailwind v4 with shadcn/ui components (copied in, not a dependency), Zod for config and forms, and the typed client generated from the API contract (ADR-010). It talks to the same API under `/v1/admin/*`; there is no second backend and no BFF.

## Consequences

- Static hosting and a fast dev loop; no second server runtime to secure.
- Hiding a button is UX, never security: every admin route is guarded server-side by `@RequirePermission` (ADR-013).
- Same-origin by default (dev proxy / reverse proxy). Hosting on a separate origin needs a CORS allow-list — part of the Phase 4 hardening task.
- Access token held in memory, refresh token in an `HttpOnly` cookie (P3-01).

## Alternatives considered

Next.js (adds an SSR runtime and a second place to enforce auth), Refine/react-admin (useful accelerators, but custom views — timeline, maps, impact previews — dominate this panel).

## Evidence

Scaffold with shell, `/login`, 404, typed client wiring, 13 component tests and 3 Playwright tests (P1-10).
