# Two-step verification for administrators (P4-05)

**What it is.** Every administrator proves a second thing besides the password: a 6-digit code from an authenticator app (any TOTP app: Google Authenticator, Microsoft Authenticator, 1Password …). Ten single-use **recovery codes** are shown once at setup for a lost phone.

**Switching it on for the business.** Set `ADMIN_MFA_REQUIRED=true` in the API's environment (see `.env.example`). Until then it is optional and nothing changes. Switch it on before launch (README §13.2, gate G-05).

While it is required:

| Situation | What happens |
|---|---|
| Signed in, never set up | The panel shows only the setup screen (`MFA_REQUIRED` from every admin call except `GET /v1/admin/me`) |
| Set up, new sign-in | The panel asks for the code before anything else; a recovery code works instead (once) |
| Roles, staff or refunds (`roles:manage`, `admins:manage`, `bookings:refund`) | Need a code proved in the last `STEP_UP_MAX_AGE_SECONDS` (default 10 minutes). The panel asks in a pop-up and repeats the action by itself |
| Turning it off | Refused for administrators |

**Lost phone.** Use a recovery code. No codes left: another administrator with `admins:manage` (and at least the same power as you) resets yours in Staff, `DELETE /v1/admin/admins/{userId}/mfa`; it is audited (`admin.mfa_reset`). The only/last Super Admin: reset in the database is not needed — keep the recovery codes; the CLI bootstrap can recreate an administrator (`bootstrap-super-admin`).

**How it is built.**
- RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30 s, one step of clock drift either way). A code, or an older one, can never be used twice (`last_used_step`).
- The secret is stored encrypted (AES-256-GCM, key from `MFA_ENCRYPTION_KEY`, or derived from `JWT_SECRET`); recovery codes only as SHA-256 hashes. Neither is ever logged or returned again.
- Setting it up, new recovery codes and turning it off need the password (a stolen session alone cannot enrol its own device and lock the owner out).
- The proof belongs to the browser session: the access token carries `mfa_at`, and the session's refresh token family remembers it, so refreshes keep it. Signing in again starts unproved.
- Endpoints: `/v1/auth/session/mfa` (status), `/enrol`, `/enrol/confirm`, `/verify`, `/recovery-codes`, `/disable`; they need the access token **and** the session cookie.

**Not covered yet (P4-06).** Per-account lockout after repeated wrong codes beyond the general auth rate limit; MFA for the mobile app (customers do not need it; a staff member who also uses the app is covered by the panel's rule only).
