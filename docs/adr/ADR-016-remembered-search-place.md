# ADR-016 — The app remembers the last search place, rounded to ~1 km

| | |
|---|---|
| **Status** | Accepted (owner decision 2026-10-23; implemented in M27 / P3-50) |
| **Amends** | README §10.6 "Do not persist raw user coordinates" |
| **Related** | README §10.6, §11.4; ADR-008 |

## Context

README §10.6 kept the customer's search place in memory only, so every start of the app asked "Where are you?" again. Testing the live demo, the owner found this tiresome ("it does not save the location") and chose to keep the place between runs, as long as the phone never holds a precise position.

## Decision

1. The place chosen for a search stays **exact in memory** for the current run, as before.
2. A copy is written to the platform's **secure storage** (key `last_place`): latitude and longitude **rounded to 2 decimals** (≈ 1.1 km — a neighbourhood, never a home), plus the name when the place is a named one (e.g. a demo area). Nothing else.
3. At start the app searches around the saved copy straight away. A copy that is not well-formed or out of range is ignored.
4. The copy is **deleted whenever the session ends** (sign-out, account deletion, a session the server refused), together with the saved bookings, and the in-memory choice is forgotten at sign-out — the next person on the same phone starts fresh.
5. Unchanged: coordinates are never sent to the server except in the search request body, never in URLs, never logged, never stored server-side.

## Consequences

- Reopening the app shows nearby drawers at once. After a restart the distances are measured from the rounded point, so they can be off by up to ~0.8 km until the customer searches again.
- The privacy policy should mention that the app keeps an approximate last search area on the device until sign-out.
- Tested by `apps/mobile/test/features/navigation_test.dart` L-01…L-05 (rounding, restore, name, wipe at sign-out, malformed copies).
