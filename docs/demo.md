# Rento demo — how to run it and what to show

Local development only: throw-away credentials, a **fake payment gateway** (no real money, no real card), emails go to a catcher.

## Start (one command)

```bash
pnpm install          # first time only
pnpm demo             # database + mail catcher, migrations, API, demo data, admin panel, customer app in Chrome
```

Needs Docker, Node 22, pnpm and Flutter (with Chrome). `pnpm demo --no-app` skips the Flutter app; `pnpm demo --no-seed` skips the demo data. Ctrl-C stops everything it started.

| What | Where |
|---|---|
| Admin panel | http://127.0.0.1:5173 |
| Customer app | http://localhost:5555 (opens in Chrome, shown phone-sized) |
| API reference | http://127.0.0.1:3000/docs |
| Mail catcher | http://127.0.0.1:8025 |

| Who | Email | Password |
|---|---|---|
| Super Admin | demo.admin@rento.demo | Demo-Passw0rd!2026 |
| Owner Super Admin | `ADMIN_EMAIL` from your untracked `.env` | `ADMIN_PASSWORD` from your `.env` (created by the seed) |
| Front desk (bookings only) | frontdesk@rento.demo | Demo-Passw0rd!2026 |
| Customer | demo.customer@rento.demo | Demo-Passw0rd!2026 |

The demo data (7 drawers in Bengaluru (2), Delhi, Pune (2) and Hyderabad (2), 3 item models, 30 units, two sample bookings; the app offers a demo place in each city) is created through the real API and can be re-created any time; it never duplicates itself.

## Suggested 10-minute walkthrough

**1. The customer verifies and rents something (app)** — a NEW customer must first verify with an Aadhaar card (Account tab → *Verify your identity*, or the *Verify now* button when a reservation is refused): enter a 12-digit number with a valid check digit — demo numbers: **3456 7890 1240**, **4567 8901 2356**, **2345 6789 0130** (each card can verify only ONE account) — then the demo one-time code **123456**. The demo customer below is already verified. Staff can also approve by hand in the admin panel (*Customers*). Then: sign in as the customer → _Choose a place_ → **Bengaluru · Indiranagar** (or "Use my location") → the nearest open drawers appear with distance → open **Indiranagar Hub** (address, opening hours, pickup instructions, what can be rented and how many are free) → **PlayStation 5** → pick a day, a start time (shown in the _drawer's_ time zone), a length → the price (rental + refundable deposit) → **Reserve & pay**. The slot is now held for 10 minutes (countdown) → **Pay** → a "Razorpay checkout (demo)" sheet opens: pick the test card or UPI to pay, or the **declined** test card to see the slot stay held and try again → "You are booked!". No money moves and no keys are needed.

**2. The business sees it (admin panel)** — sign in as the Super Admin → **Dashboard** (confirmed bookings, money received) → **Bookings** → open the new booking: price split, payment, full history → _when the time comes_ **Hand over to customer** and **Take back**. Try **Cancel booking…** with a reason; the refund follows the cancellation policy, and an administrator with the refund permission can override it.

**3. Nobody can double-book** — in the app, reserve the same unit for the same time with a second customer account (register one): once all units of that model are held, the next customer gets "Someone just took that time". The guarantee lives in the database, not in the screens; `pnpm --filter @rento/api test:concurrency` fires 30 simultaneous requests at one unit and proves exactly one wins.

**4. Run the catalogue (admin)** — **Categories**, **Item models** (price in rupees, slot length, cleaning time between rentals, deposit, and **photos**: open a product → *Add photos…* → JPEG/PNG/WebP up to 5 MB; the first is the cover and appears in the customer app at once; the demo products already have generated pictures), **Assets** (set a unit to maintenance → it disappears from the app at once), **Drawers** (weekly hours, closures — a closed drawer is skipped in the app's nearby search).

**5. Control who can do what (admin)** — **Roles** shows the permission matrix (the Super Admin role is locked); **Staff**: invite someone (the invitation email appears in the mail catcher), give them a role limited to one drawer. Sign in as **Front desk**: the menu shows only what that role may do, and the server refuses anything else even if you type the address by hand.

**6. Run the day (admin)** — **Schedule**: pick a drawer and a day to see every unit as a timeline (bookings with their cleaning time, maintenance blocks) in the drawer's own time. **Block time…** on a unit takes it out of service: the panel first lists the bookings in the way and refuses to block until you move them (open the booking → **Move to another unit…**, same time and price) or cancel them — nothing is cancelled for you. **Reports** (bookings, hours rented, money taken minus refunds, by day / drawer / model), **Payments** (every payment and refund) and **Settings** (the rules in force, read-only) complete the panel.

**7. Everything is traceable (admin)** — **Audit log**: who cancelled what, when, why, with before/after.

## Automated check of the whole thing

With `pnpm demo` running: `pnpm demo:smoke` drives the real admin panel and the real customer app in a headless browser (sign in, find a drawer, reserve, pay, view, cancel; admin pages) and saves screenshots to `demo-shots/`.

## What is NOT in the demo (and where it is planned)

Real payments: the Razorpay adapter and its signed webhook are built and tested against a local fake of Razorpay's API, but they have never talked to the real service — switch it on with `PAYMENT_PROVIDER=razorpay` plus the three Razorpay keys and run the sandbox checklist first (P4-01…03). Push notifications (P2-30), pickup codes (P2-26), map pins and drawer photo upload, Google/Meta/Apple sign-in buttons (need real app IDs — Phase 0), the iOS/Android store builds, hosting and monitoring (Phase 4). The refund percentages (100 % ≥ 24 h, 50 % ≥ 2 h, 0 % below), the 10-minute hold and the 15-minute lead time are **placeholders** until the owner answers the business questions in `README.md` §19.3.
