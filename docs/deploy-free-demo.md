# Putting a free demo of Rento online

**Read this first.** This is a **demo**, not production. The project rule is *no free-tier hosting for real bookings* (README §17, `AGENTS.md`): free instances sleep when idle (the first request after a pause takes about a minute), have no uptime promise, and the free database has limits. The demo therefore runs with the **fake payment gateway** (no money moves) and **no outgoing e-mail server**. Use it to show the product and to test the Android app — do not take real customers on it. The real deployment is Phase 4 (P4-09, P0-06).

What you get: **one web address** that serves both the API (`/v1/...`) and the admin panel (`/`), a free PostgreSQL+PostGIS database, and an installable **Android APK** that talks to that address.

```
phone (APK) ──https──▶  https://rento.onrender.com  ◀──https── browser (admin panel at /)
                                  │
                                  ▼
                      Neon free PostgreSQL + PostGIS
```

One address for both is deliberate: the admin panel's session cookie is `SameSite=Strict`, so panel and API must share a site.

## 0. What I already prepared (in this repository)

| File | What it does |
|---|---|
| `Dockerfile` | Builds the API and the admin panel into one image; on start it migrates the database, then runs the API |
| `render.yaml` | Render "blueprint": the free web service and its settings |
| `ADMIN_STATIC_DIR`, `TRUST_PROXY` | Settings that make the API serve the panel and trust the host's proxy (both set in the image) |
| `scripts/build-apk.mjs` | `pnpm mobile:apk -- --api https://…` builds the APK for that address |
| `apps/api/scripts/seed-demo.mjs` | Fills a demo business; **refuses a non-local API unless `SEED_PASSWORD` is set** |

## 1. The database (Neon, free)

1. Sign up at <https://neon.tech> and create a project (region near you).
2. Copy the connection string (**pooled or direct both work**), it looks like `postgres://user:password@ep-….neon.tech/neondb?sslmode=require`.
3. PostGIS is available on Neon; the migrations enable `postgis`, `btree_gist`, `pgcrypto` and `citext` themselves.

## 2. The service (Render, free)

Render builds from a Git repository, so the code must be on GitHub (private is fine):

1. Create a repository, then from this folder: `git add . && git commit -m "Rento" && git remote add origin <url> && git push -u origin main`. (`.env` is ignored by git: your secrets stay on this computer.)
2. On <https://render.com>: **New → Blueprint**, pick the repository. It reads `render.yaml`.
3. Fill the two values it asks for: `DATABASE_URL` (from Neon) and, after the first deploy tells you the address, `PUBLIC_WEB_URL` and `CORS_ALLOWED_ORIGINS` — both exactly `https://<your-service>.onrender.com` (no trailing slash). Redeploy once after setting them.
4. Wait for "Live". Open `https://<your-service>.onrender.com/healthz` — it should answer `{"status":"ok"}`; `/readyz` should say the database is reachable.

## 3. The first administrator and demo data

Run these **on your computer**, pointing at the live address and the Neon database (never type the password into chat or commit it):

```powershell
$env:DATABASE_URL = "<the Neon connection string>"
$env:JWT_SECRET   = "<any 32+ characters; only the CLI needs it>"
# the first Super Admin — prints a one-time link to set the password
pnpm --filter api exec node dist/cli/main.js bootstrap-super-admin --email you@example.com --name "Your Name"
```

Open the printed link, but replace its host with your live address (`https://<service>.onrender.com/reset-password?token=…`), set a password, sign in at `https://<service>.onrender.com/`.

Optional demo catalogue (drawers, products with pictures, a demo customer). It needs a **secret password** you choose; it creates a Super Admin, a front-desk user and a customer with it:

```powershell
$env:API_URL       = "https://<service>.onrender.com"
$env:SEED_PASSWORD = "<a long secret password>"
node apps/api/scripts/seed-demo.mjs
```

## 4. The Android APK

```powershell
pnpm mobile:apk -- --api https://<service>.onrender.com
```

Result: `dist/rento-demo.apk`. Copy it to a phone and open it (allow "install from this source"), or `adb install dist/rento-demo.apk` with a phone attached. It is signed with the debug key — fine for a demo, not for the Play Store (P4-11). The app asks for location to find drawers near you; choose a demo place if you are not in Bengaluru.

## 5. Known limits of the free demo

- **Sleeps after ~15 minutes idle**; the first request wakes it (about a minute). The app shows its normal "try again" state meanwhile.
- **No e-mail** is sent (the SMTP host is a placeholder). Verification and reset links are therefore not delivered; use the CLI link for the first admin and the admin panel's Staff page to invite others only after a real mail server is configured.
- **No Google/Meta/Apple sign-in** until their client IDs are set (P0-02…P0-04).
- **Payments are the fake gateway.** The booking flow, holds, cancellations and refunds all work, with simulated money.
- Background jobs (expiring unpaid holds, reminders) run only while the instance is awake.
- Turn on `ADMIN_MFA_REQUIRED=true` in Render's environment once the first admin has set up an authenticator app (`docs/mfa.md`).
