# ADR-014 — Social login: provider token verified server-side, identity key `(provider, subject)`

| | |
|---|---|
| **Status** | Proposed |
| **Related** | README §15.1; ADR-012; open questions Q-1, Q-14 |

## Context

Customers expect Google/Facebook/Apple sign-in; the App Store requires Sign in with Apple when other third-party logins are offered (guideline 4.8). Provider-supplied emails are not equally trustworthy (Facebook's may be missing or unverified).

## Decision (proposed)

- Native SDK sign-in on the device → send the provider token to `POST /v1/auth/social/{provider}` → the API **verifies it server-side** (signature via cached JWKS, issuer, audience, expiry, nonce; Facebook via `debug_token`) → issues **our own** access/refresh tokens (ADR-012).
- Identity key is **`(provider, provider_subject)`**, never email. `UNIQUE (provider, subject)` guarantees a provider account belongs to one user.
- **Never auto-link on an unverified or missing email.** Link only when the provider asserts a verified email matching an email-verified existing user; otherwise create a separate account (or return `409 ACCOUNT_LINK_REQUIRED`). Users always keep ≥ 1 sign-in method.
- Missing email/phone → `needsProfileCompletion[]`. Apple private-relay emails are accepted; Apple's name arrives only on first sign-in.

## Implementation notes (P2-03 — provider-independent core)

- `SocialIdentityVerifier` is the port (one implementation per provider: P2-04 Google, P2-05 Meta, P2-06 Apple); tests use a fake at that interface. A provider with no registered verifier answers `404 NOT_FOUND`, so nothing is half-enabled.
- Where §15.1 allows "separate account **or** `409`", the API returns **`409 ACCOUNT_LINK_REQUIRED`** whenever the provider email matches an existing user but cannot be trusted to link: the provider did not verify it, the existing user's email is not verified, or that user already has a different identity of the same provider. (A second account with the same email is impossible anyway — `users.email` is unique.)
- A new identity with a missing or **unverified** email creates a user with `users.email = NULL`; the claimed address stays on the identity row only, and the response carries `needsProfileCompletion: ['email']`. An unverified address is never stored as the account email, so nobody can squat or pre-hijack an address they do not own.
- Concurrent first sign-ins race on the unique constraints; the loser re-runs the resolution once and lands on sign-in, link or `409`. Suspended or deleted users get a generic `401 UNAUTHENTICATED`.
- Phone is not required in the MVP (Q-1 default), so `needsProfileCompletion` currently only ever contains `email`.

## Google verifier (P2-04)

- `jose` verifies the ID token: **RS256 only**, `iss` ∈ {`https://accounts.google.com`, `accounts.google.com`}, `aud` ∈ `GOOGLE_CLIENT_IDS` (Web, Android, iOS), `exp`/`nbf` with 10 s tolerance, required `sub`. `alg=none` and algorithm-confusion (HS256 keyed with the public key) are rejected. The identity key is `sub`; `email_verified` counts only for boolean `true` or `"true"`, and never without an email.
- Keys come from `GOOGLE_JWKS_URL` (default Google's certificate endpoint), cached by `Cache-Control: max-age` (clamped to 1 min … 24 h, 1 h when absent), measured with the injected Clock. An unknown `kid` (rotation) causes one refetch, at most once per 30 s so forged `kid`s cannot make the API hammer Google. If a refresh fails the stale keys keep working and the endpoint is retried after 30 s; with no keys at all the request fails `503 RETRY_LATER` — an outage on Google's side is not an invalid token.
- Google is enabled only when `GOOGLE_CLIENT_IDS` is set; otherwise `POST /v1/auth/social/google` is `404`. Real client IDs and device sign-in are checked manually (P0-02, P3-13, P4-12).

## Meta verifier (P2-05)

- **Classic Login**: Graph `debug_token` with the app token (`APP_ID|APP_SECRET`) must say `is_valid`, `type=USER`, our `app_id`, unexpired (`expires_at` 0 = never); then `/me?fields=id,name,email` (with `appsecret_proof`) whose `id` must equal the debugged `user_id`. **Limited Login** (iOS): RS256 OIDC token, issuer `https://www.facebook.com`, audience = our app id, keys from Meta's JWKS (shared cache with Google), and the token's `nonce` must equal the nonce the app sent. Endpoints confirmed from Meta's OIDC discovery document on 2026-10-15.
- **The Facebook email is never treated as verified**, in either mode, so it can never auto-link (BR-19). With P2-03 this means: a Facebook sign-up gets `users.email = NULL` and `needsProfileCompletion:['email']`; a Facebook email equal to an existing account gives `409 ACCOUNT_LINK_REQUIRED`.
- Meta 4xx ⇒ `401 SOCIAL_TOKEN_INVALID`; Meta 5xx / 429 / timeout / unreadable answer ⇒ `503 RETRY_LATER`. A wrong `FACEBOOK_APP_SECRET` therefore looks like invalid tokens (Meta answers 4xx) — verify the credentials with a real sign-in after deployment.
- Enabled only when both `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET` are set (else `404`). `FACEBOOK_GRAPH_URL` is versionless by default (the app's configured Graph version) and can pin one.
- **Open, needs a real Meta app (manual checklist P3-13 / P4-12)**: (a) ~~raw vs. hashed nonce~~ — resolved in code: both forms are accepted, as for Apple; (b) whether Limited Login's `sub` equals the classic `user_id` for the same person — if not, one person using both iOS Limited Login and classic Login gets two accounts until they link them (P2-07); (c) Live-mode requirements (privacy-policy URL, data-deletion callback) — Phase 4.

## Apple verifier (P2-06)

- RS256 identity token from `https://appleid.apple.com/auth/keys` (shared JWKS cache), `iss=https://appleid.apple.com`, `aud` ∈ `APPLE_CLIENT_IDS` (bundle ID, plus the Services ID if the web uses it), `exp`/`nbf` ±10 s, required `sub exp iss aud nonce`. Verified against Apple's OIDC discovery document on 2026-10-16.
- **Nonce**: the app sends the raw nonce; the token's `nonce` claim must equal it or its SHA-256 hex (client libraries differ in what they hand to Apple). A missing or different claim is rejected.
- Apple's `email_verified` (boolean or `"true"`) is trusted, **including private-relay addresses** (`privaterelay.appleid.com`, deliverable), so they are stored as the verified account email and can link to a matching verified account. The name is not in the token: the app forwards `fullName` on the first sign-in and the social core stores it once.
- Enabled only when `APPLE_CLIENT_IDS` is set (else `404`). Real bundle/Services IDs and device sign-in are manual checks (P0-04 → P3-13 / P4-12). Out of scope: Apple server-to-server notifications and token revocation on account deletion (Phase 4).

## Identity management (P2-07)

- `GET /v1/me/identities`, `POST /v1/me/identities/{google,facebook,apple}`, `DELETE /v1/me/identities/{provider}`, `PATCH /v1/me`. All act on the caller's own rows; subjects are never returned.
- **Fresh auth for linking** = the user actually signed in (password or provider) at most `FRESH_AUTH_MAX_AGE_SECONDS` ago (default 300). The access token carries an `auth_time` claim that a refresh does **not** move (it is the start of the refresh-token family), so a stolen session that keeps refreshing can never link a method. A stale session gets `401 REAUTH_REQUIRED` *before* any provider call; the client must sign the user in again (refreshing does not help). Admin/customer MFA (P4-05) will add a second factor on top.
- New code **`IDENTITY_IN_USE`** (409): the provider account belongs to a different user, or the caller already has another account of that provider. `LAST_LOGIN_METHOD` (409) when unlinking the only method; unlinking runs under a row lock on the user so concurrent unlinks can never leave an account with none.
- `PATCH /v1/me` completes the profile (`name`, `phone`, and `email` only while the account has none). A new email is **claimed, not written**: a verification link bound to that address is mailed, and only using it sets `users.email` (and verifies it); if someone registered the address meanwhile the link fails with `409 EMAIL_TAKEN`. This keeps the anti-squatting rule of P2-03. Changing an existing email, `GET`/`DELETE /v1/me` and suspension are P2-32.

## Consequences

- Three provider integrations to maintain; Facebook email unreliability handled by policy.
- Real-device checks are manual checklists; CI uses fakes at the verifier interface (local JWKS server, fake Graph API).
- Google Cloud / Meta / Apple developer accounts must exist and be company-owned (Q-14; P0-02…P0-04).

## Status note

Becomes **Accepted** with P2-03…P2-06 and the production readiness task P4-12 (G-06).
