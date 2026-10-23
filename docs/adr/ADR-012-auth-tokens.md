# ADR-012 — Authentication: Argon2id, short-lived JWT access tokens, rotating hashed refresh tokens

| | |
|---|---|
| **Status** | Accepted (2026-10-11, task P2-01) |
| **Related** | README §15; ADR-013, ADR-014; P2-01, P2-02, P2-31 |

## Context

Mobile and web clients need sessions that survive app restarts, can be revoked, and whose theft is detectable.

## Decision

- Passwords hashed with **Argon2id** (`@node-rs/argon2`, OWASP parameters m=19 MiB, t=2, p=1), PHC string in `user_identities.password_hash`; constant-time verification; **one generic login error** for every failure mode, and an unknown email still costs one Argon2 verification against a dummy hash (timing parity).
- **Password policy** (engineering default, not a §19.3 business question): 10–128 characters, a small deny-list of very common passwords, not equal to the email, not a single repeated character; no composition rules (NIST-style). A breached-password check remains optional/future.
- **Access token**: HS256 JWT, 15 min (`ACCESS_TOKEN_TTL_SECONDS`), claims only `sub`, `iss`, `aud`, `iat`, `exp`, `jti` and `auth_time` (when the user actually signed in; carried unchanged across refreshes so sensitive steps can demand a recent sign-in — P2-07). Permissions are *not* in the token — they are resolved server-side per request (ADR-013). Verification pins the algorithm, issuer and audience, uses the injected `Clock`, and accepts a verify-only `JWT_SECRET_PREVIOUS` so the signing secret can be rotated without logging everyone out.
- **Refresh token**: opaque 256-bit random value, stored only as its **SHA-256** hash, rotated on every use and grouped in a `family_id`. The **absolute** lifetime (`REFRESH_TOKEN_TTL_DAYS`, default 30) is fixed at login and never extended by rotation. Reuse of a rotated token revokes the whole family and writes a `warn` security log (family and user ids, never the token).
- **No reuse grace window.** Two simultaneous refreshes of one token yield exactly one winner; the loser looks like a replay, so the family is revoked. Clients must single-flight their refresh (P3-11). Rationale: a grace window would let a stolen token be replayed for its duration.
- `register` signs the user in (returns the same `AuthResponse` as login). `logout` is authenticated by possession of the refresh token (idempotent `204`, revokes that session's family only).
- Account/IDs: duplicate email → `409 EMAIL_TAKEN` (as README §14.3 specifies; this does reveal that an email is registered, mitigated by rate limiting in P2-31). Email verification and password reset are single-use hashed tokens (P2-02, below).

- **Email verification / password reset (P2-02)**: tokens in `auth_tokens` — 256-bit random, only the SHA-256 stored, single use (consumed by one conditional `UPDATE`, so concurrent attempts yield one winner), expiring (verification 24 h, reset 1 h; configurable), superseded when a newer one of the same purpose is issued, and bound to the email they were sent to (changing the address invalidates them). Any unusable link gives the same `422 VALIDATION_FAILED` on `token` — expired, used and unknown are indistinguishable. `forgot` always answers 202 and does its work in the background, so neither the response nor its timing reveals whether an account exists; at most one mail per account and purpose per minute. A successful reset changes the hash, marks the email verified (the link proved control), revokes **every** refresh token of the account, and sends a "password changed" notice; it does not sign the user in. A weak new password is rejected without burning the link. Mail goes through the `MailSender` port (SMTP via nodemailer; Mailpit locally; production requires `SMTP_HOST`, `MAIL_FROM` and an https `PUBLIC_WEB_URL`), is sent after the response, and logs only the purpose — never recipient, link or token. Registration sends a verification mail but does not require verification.

## Consequences

- Refresh storage and rotation logic add complexity but give theft detection.
- Revocation reaches an already-issued access token only at its expiry (≤ 15 min); sensitive admin changes take effect immediately because permissions are server-resolved (ADR-013), and suspended users are blocked on the next refresh / by P2-32.
- Web: access token in memory, refresh token in an `HttpOnly; Secure; SameSite=Strict` cookie with CSRF protection (P3-01).
- Expired and revoked refresh-token rows accumulate until a cleanup job exists (planned with the P2-23 job runner).
- HS256 means every verifier shares the secret; fine for a single API service. Move to an asymmetric algorithm if a second service ever needs to verify tokens.

## Evidence

98 → 146 unit tests and 51 API tests against real PostgreSQL, including: Argon2id parameters, claim set, expiry by fake clock, `alg=none`/wrong-secret/tampered tokens, secret rotation, reuse detection and family revocation, absolute-lifetime non-extension, concurrent double refresh, concurrent duplicate registration, log-capture proving no passwords/tokens/hashes are logged. Mutation checks: disabling reuse detection, storing refresh tokens unhashed, skipping the dummy verify, and extending lifetime on rotation each make tests fail.

## Remaining work under this ADR

Rate limiting and progressive lockout (P2-31); web cookie flow (P3-01); admin MFA (P4-05).
