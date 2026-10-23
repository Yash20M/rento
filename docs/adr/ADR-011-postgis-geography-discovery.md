# ADR-011 — PostGIS `geography`, discovery filters first and ranks second, configurable policy

| | |
|---|---|
| **Status** | Proposed |
| **Related** | README §10; ADR-002; open questions Q-8 |

## Context

The nearest drawer may be closed, outside the serviceable zone, out of stock or inactive; proximity alone returns wrong answers. Location is sensitive personal data.

## Decision (proposed)

- Store drawer locations as `geography(Point, 4326)`; always `ST_MakePoint(lng, lat)` (**longitude first**).
- Discovery **filters first** (`ST_DWithin` radius, active zone containment, open hours/closures, optional stock) and **ranks second** (KNN `<->`, then availability within a tie threshold, then name).
- Policy lives in `app_settings` (`discovery.mode`, `max_results`, `radius_m`, `tie_threshold_m`, `require_in_zone`), editable by admins and cached.
- Privacy: user coordinates are used per request and never persisted or logged; precision may be reduced client-side.

## Consequences

- Slightly more query complexity than a haversine fallback, in exchange for indexed radius/zone/KNN queries.
- KNN on `geography` is computed on a sphere, so report `ST_Distance` for display.
- Swapped latitude/longitude cannot be caught by the database for Indian coordinates (both values are valid either way); it is guarded by input validation and tests (P2-20).

## Evidence

Drawer table with `geography(Point,4326)` + GiST index and a longitude-first round-trip test (P1-04). Becomes **Accepted** with P2-20.
