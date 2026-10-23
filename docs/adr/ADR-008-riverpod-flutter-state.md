# ADR-008 — Riverpod for Flutter state management

| | |
|---|---|
| **Status** | Proposed |
| **Related** | README §4.4, §11; P1-08 |

## Context

Availability and listings are essentially cached remote queries with loading/error/data states, refresh, and auto-dispose. Tests need to override dependencies without a `BuildContext`.

## Decision (proposed)

Use **Riverpod** (`AsyncNotifier` / `FutureProvider`) with `go_router`, `dio`, `freezed`/`json_serializable`, `flutter_secure_storage`. Feature-first folders with `data` / `domain` / `presentation` layers (README §11.2).

## Consequences

- Least boilerplate for async data and first-class provider overrides in tests (`mocktail` for repositories).
- Team conventions are needed (provider naming, where side effects live) since structure is not enforced.
- Bloc/Cubit remains a legitimate alternative if the team prefers strictly event-driven structure.

## Status note

The scaffold exists (P1-08): Riverpod 3 (`flutter_riverpod`, plain `Notifier`/`AsyncNotifier` — **no code generation yet**), `go_router`,
`dio`, `flutter_secure_storage`, feature-first folders, 30 unit/widget tests. It is not yet exercised by real features, so this ADR stays
**Proposed** until the first screens (P3-11…P3-15) validate the conventions.

Conventions fixed by the scaffold: configuration comes from `--dart-define` and enters the graph through an `envProvider` that has **no
default** (a missing override fails loudly); providers are overridden in tests with `ProviderContainer`/`ProviderScope` overrides rather than
service locators; screens read providers and hold no HTTP or business rules.
