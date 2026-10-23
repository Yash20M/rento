# Runbook — create the first Super Admin

The first Super Admin can only be created from the server, never through the API (README §13.5).

```bash
pnpm --filter api cli bootstrap-super-admin --email owner@yourcompany.example --name "Owner Name"
```

- Needs the same environment as the API (`DATABASE_URL`, `JWT_SECRET`, `PUBLIC_WEB_URL`, …; a root `.env` is read automatically in development).
- **New email** → the account is created, given the locked *Super Admin* role, and a **one-time link** is printed. Open it to choose the password (valid `RESET_TOKEN_TTL_MINUTES`, default 60; works once). The command never chooses, stores or prints a password.
- **Existing customer email** → that account is promoted in place (its password is untouched); no link is printed because it can already sign in.
- **Run it again for the same email** → nothing changes; if the account still has no password you get a fresh link (the previous one stops working).
- **A Super Admin already exists** → refused (exit 1). To add another one on purpose, add `--force-additional`.
- **Locked out** (the only Super Admin is suspended) → the command works again, because no *active* Super Admin exists.
- Suspended or deleted accounts are refused.

Exit codes: `0` done or nothing to do · `1` refused or failed · `2` usage error.

Treat the printed link like a password: anyone holding it can set the password. Do not paste it into chat or tickets.
