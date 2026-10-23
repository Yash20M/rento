# Phase 2 acceptance run (P2-36)

One automated story, played from an **empty database** through the public HTTP contract, plus the real built CLI for the very first administrator. It lives in `apps/api/test/api/p2-36-acceptance.api.spec.ts` and runs with the other API tests (`pnpm --filter api test:api`).

| Step | What happens | What it proves |
| --- | --- | --- |
| A-1 | `bootstrap-super-admin` prints one link; the link sets the owner's password; the owner signs in | The system can be started with no seed data and no password in any log |
| A-2 | The owner creates a read-only role, invites a staff member, who accepts by e-mail link and signs in; staff can read drawers but get **403** creating a category | Roles are data, invitations work, access is denied by default |
| A-3 | Owner creates a drawer (hours, location), a category, a product and a unit | The inventory and drawer admin API is complete |
| A-4 | A customer signs in with Google (fake verifier at the adapter), finds the drawer nearby and reads its availability for the day | Social login, discovery and availability snapshots |
| A-5 | She books the slot; a second customer asking for the same slot gets **409 `BOOKING_SLOT_TAKEN`**; exactly one live occupancy row exists | The database constraint, not the app, guards double booking |
| A-6 | She cancels; the second customer now gets the slot | Cancelling frees the slot |

Notes

- The story uses the real clock because the CLI stamps its one-time link with it. The slot is 11:00 IST two days ahead, so the test never depends on opening hours "now".
- Payment, pickup, return and KYC have their own journeys (`m14-journey.api.spec.ts` and the per-feature specs); this run covers the booking-integrity spine.
- Real-device and real-account checks (Google sign-in, push, real payments) remain manual checklists, not part of this run.
