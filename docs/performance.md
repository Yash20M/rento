# Performance baseline (P3-28)

Measured 2026-10-22 on the developer laptop (Windows 11, Docker PostGIS 16, API in-process). Numbers are milliseconds; each read was repeated 20 times after a warm-up, p50 = median, p95 = 95th percentile.

**Data volume:** 10 000 bookings, 2 000 customers, 60 drawers (180 units). Rerun with
`PERF_OUT=<file> pnpm --filter api exec vitest run --project api test/api/p3-28-performance.api.spec.ts`.

| Read | p50 | p95 | CI limit (p95) |
|---|---:|---:|---:|
| Admin bookings, first page | 23 | 25 | 400 |
| Admin bookings, status filter | 11 | 13 | 400 |
| Admin bookings, one drawer | 8 | 11 | 400 |
| Admin customers, first page | 7 | 10 | 400 |
| Admin customers, search | 6 | 7 | 400 |
| Dashboard | 8 | 9 | 600 |
| Report, 90 days | 4 | 5 | 600 |
| Payments ledger | 3 | 4 | 400 |
| Nearby (60 drawers, with a product) | 4 | 18 | 600 |
| Drawer stock list | 3 | 3 | 400 |
| Availability for a day | 5 | 6 | 600 |

The CI limits are deliberately many times the measured values (shared CI machines are slower); they exist to catch a missing index or an N+1 query, not to benchmark. The spec runs with the other API HTTP tests (`api:http` gate) and fails if a limit is crossed.

## Admin panel

- **Tables are paged by the server** (25 rows by default, rows-per-page selectable), so a table never holds 10 000 rows in the browser; the 10 000-row case is the API read above.
- **Bundle:** before 624 kB JS (183 kB gzip) in one file; after splitting every page into its own download, the first load is 522 kB (162 kB gzip) and each page is 2–15 kB fetched when first opened. Most of the rest is React, the router, TanStack Query and zod.

## Not measured yet (needs a real device)

- Flutter cold start and discovery render time on the Pixel 7 emulator/phone; image cache sizing. The app's lists already use lazy builders and every picture fades in once decoded; numbers to be added when a device run is made for this purpose.
