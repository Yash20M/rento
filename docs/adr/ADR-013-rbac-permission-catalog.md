# ADR-013 — RBAC: code-defined permission catalog, data-defined roles, locked Super Admin

| | |
|---|---|
| **Status** | Proposed |
| **Related** | README §13.5; ADR-009, ADR-012; open question Q-10 |

## Context

A Super Admin must be able to build roles ("Support Agent", "Drawer Staff") from permissions and assign them, and staff must see and do only what their role allows — with no way to escalate or lock everyone out.

## Decision (proposed)

- **Permissions are code, roles are data.** The catalog is a fixed list of `resource:action` keys shipped with the software and seeded by migration; a startup/CI check fails if code and table drift. The admin UI combines permissions into roles; it cannot invent them.
- **Super Admin** is a locked system role that bypasses permission lookup (it implicitly holds every permission, including future ones). It cannot be edited or deleted; the first one is created only by a server-side CLI.
- One unified `users` table; staff are users holding ≥ 1 role. Effective permissions = union of roles. A role assignment may carry a **drawer scope**.
- Every `/v1/admin/*` route declares `@RequirePermission` — **deny by default**, enforced by a route-enumeration test. Permissions are resolved server-side per request with a short-TTL cache invalidated on change.
- Anti-escalation: a granter may only assign permissions they hold; only a Super Admin may assign Super Admin; no self role changes; the last active Super Admin cannot be removed (transactional check + DB guard).

## Implementation notes (P2-08 — the catalog)

- The 21 keys live in `apps/api/src/modules/access-control/domain/permissions.ts` and are seeded into `permissions` by migration `0004_permissions.sql` (key format enforced by code, a DB CHECK and tests; a unit test also fails if the README §13.5 table and the code disagree). New permissions = a new code constant **plus** a new forward-only migration.
- **Startup check:** a code key missing from the table stops the process (naming the key); a table key unknown to code only warns, so rolling back a deploy onto a newer schema stays possible; an unreachable database is a warning (`/readyz` reports it). CI is strict in both directions (DB test D-1/D-6).
- Roles tables and CRUD are P2-09, the `@RequirePermission` guard P2-12.

## Implementation notes (P2-09 — roles)

- Migration `0005_roles`: `roles` (names unique ignoring case; one seeded **Super Admin**: `is_system` + `is_super_admin`, at most one such row), `role_permissions` (FK to the catalog; the Super Admin may have none), `user_roles` (RESTRICT FK = the database guard behind `ROLE_IN_USE`; assignment API is P2-11). Triggers lock system roles against UPDATE/DELETE whatever the application does.
- API: `GET/POST /v1/admin/roles`, `GET/PATCH/DELETE /v1/admin/roles/{id}`, `GET /v1/admin/permissions`; reads need `roles:read`, writes `roles:manage`. System role edit/delete ⇒ `409 ROLE_LOCKED`, assigned role delete ⇒ `409 ROLE_IN_USE`, duplicate name / unknown permission ⇒ `422`. `PATCH` with `permissions` replaces the set atomically under a row lock.
- **Authorization seam:** `@RequirePermission` + `PermissionGuard` + a `PermissionResolver` port whose default implementation grants nothing, so the admin routes answer 403 to everybody until the real engine (P2-12) is plugged in; a route without a declared permission is denied (deny by default). **Open requirements carried to later tasks:** anti-escalation on create/edit (P2-13), audit rows for role changes (P2-14), ETag/If-Match optimistic locking for admin resources (README §14.1) as a cross-cutting decision, and the starter role templates (open question Q-10).

## Implementation notes (P2-10 — first Super Admin)

- `pnpm --filter api cli bootstrap-super-admin --email … [--name …] [--force-additional]` talks to the database directly (no HTTP server, no API route; a test asserts no OpenAPI path or request body can create or flag a Super Admin). Runbook: `docs/runbooks/bootstrap-super-admin.md`.
- One transaction under an advisory lock: create the account (or promote the existing one), assign the locked role, and — only if the account has no password — issue a single-use, hashed, expiring setup link (the same token as a password reset; `setPasswordHash` now creates the password identity when none exists, which only a valid link can reach). Refuses when an **active** Super Admin exists unless `--force-additional`; re-running for the same email is a no-op. Concurrent runs create exactly one.
- Audit logging of the bootstrap arrives with the audit service (P2-14).

## Implementation notes (P2-11 — assignments and invitations)

- Migration `0006_admin_invitations` (`admin_invitations` + `admin_invitation_roles`; one OPEN invitation per address, token stored as SHA-256 only). Endpoints: `POST/GET /v1/admin/admins/invitations`, `DELETE …/invitations/{id}`, `GET /v1/admin/admins`, `PUT /v1/admin/admins/{userId}/roles` (replaces), `DELETE /v1/admin/admins/{userId}` (deactivate = remove all roles, the customer account stays), public `POST /v1/auth/admin-invitations/accept` (set a password) and `…/accept/google` (Google's VERIFIED email must equal the invited address).
- **The real permission resolver is live** (`DbPermissionResolver`, uncached: a revoked role or deactivation applies to the next request). P2-12 adds the cache with invalidation, drawer scopes, `GET /v1/admin/me` and the route-enumeration test.
- **Interim anti-escalation:** every endpoint that can grant power (role create/edit/delete, invitations, assignments, deactivation) additionally requires a **Super Admin** (`403 ROLE_ESCALATION`), via `@SuperAdminOnly`. This is stricter than the README rules and exists only until P2-13 replaces it with: granted ⊆ granter's permissions, only a Super Admin grants Super Admin, no self changes, last-Super-Admin protection.
- An invitation never attaches roles to an account that already exists for that address (invite ⇒ `409 EMAIL_TAKEN`; accept after someone registered it ⇒ `409`, invitation stays open): the mail proves control of the address only for the person who holds the link, and an earlier registration may belong to someone else. Existing customers are promoted with `PUT …/roles`.
- Roles used by an open invitation cannot be deleted (`ROLE_IN_USE`); historic invitations just lose the role. Audit rows for all of this: P2-14.

## Implementation notes (M1 — authorization engine and audit trail)

- **`PermissionAuthority`** = database resolver + per-user cache (`PERMISSION_CACHE_TTL_SECONDS`, default 30, injected Clock) with `invalidateUser` / `invalidateAll` after every role or assignment change and a generation counter, so a load that began before an invalidation is never stored. Changes made through the API therefore apply to the very next request on this instance; on other instances within the TTL. Effective permissions carry **drawer scopes** (`all` or a set of drawer ids; `drawerAccess` / `canAccessDrawer` helpers for scoped queries and mutations). `GET /v1/admin/me` returns `{ user, superAdmin, permissions[], drawerScopes[] }` for the SPA; `@RequireAdminAccess` = any role holder.
- **Deny by default is enforced by a test** that walks every controller under `/admin` and fails if a route lacks a declared permission or `PermissionGuard`.
- **`audit_logs`** (migration 0007, append-only for every database role via triggers incl. TRUNCATE) written by `AuditLog.record(trx, …)` in the caller transaction, with deep redaction of secret-looking keys; wired into role create/update/delete, assignment / deactivation, invitation create / revoke / accept and the Super Admin bootstrap (actor null). A test asserts every audited mutation passes its transaction handle (not the pool). Reading the trail is P2-34.
- Still interim: `@SuperAdminOnly` on every endpoint that grants power until P2-13.

## Consequences

- New permissions need a code release (by design).
- Per-request lookup cost, mitigated by the cache.
- Needs a permission-matrix test across API and UI (P2-12, P3-10).

## Status note

Becomes **Accepted** when P2-08…P2-14 are implemented and the matrix tests pass (G-04).
