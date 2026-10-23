# ADR-010 — REST + OpenAPI, contract-first clients

| | |
|---|---|
| **Status** | Accepted (2026-10-12, tasks P1-07 and P1-09) |
| **Related** | README §11.5, §14; ADR-004, ADR-008, ADR-009 |

## Context

Two clients (Flutter app, React admin) must stay in lock-step with one API, and mobile apps in the wild lag behind the server.

## Decision

REST + JSON, URL-versioned `/v1`; additive changes within a version. The OpenAPI 3 document is **generated from code** (`@nestjs/swagger`), exported deterministically and **committed** at `packages/contracts/openapi.json`. `pnpm contracts:check` fails when the committed spec or generated TypeScript types differ from what the code produces, or when the typed client no longer compiles.

- **TypeScript (admin):** types generated with `openapi-typescript`, thin typed client on `openapi-fetch` (P1-07).
- **Dart (Flutter): hand-written `freezed` + `json_serializable` models, guarded by a contract test** (P1-09). The generated `dart-dio` client was evaluated and rejected (below). The guard `apps/mobile/test/core/api/models/contract_test.dart` reads `packages/contracts/openapi.json` and fails `flutter test` when any modelled schema differs in field names, requiredness, nullability, or `ErrorCode` values — and when a **new** schema appears that nobody modelled. Thin typed wrappers (`AuthApi`, `HealthApi`) sit on the app's own `Dio`, so the P3-11 interceptors apply.
- **Forward compatibility:** the Dart `ErrorCode` has an `unknown` member; a code added by a newer server decodes to it instead of failing the whole error response (README §11.5: support N−1 app versions).

## Evaluation of the generated Dart client (P1-09, `openapi-generator` 7.x `dart-dio` + `json_serializable`)

| # | Criterion | Result |
|---|---|---|
| G1 | Runs on our spec | pass |
| G2 | Resolves on Flutter 3.29 / Dart 3.7 | **fail as generated** — `copy_with_extension_gen ^7` conflicts with `json_serializable` on this SDK; resolves only after hand-pinning `copy_with_extension ^6` in the generated `pubspec.yaml` (a post-generation patch every regeneration would need) |
| G3 | `build_runner` completes | pass (after that patch) |
| G4 | `dart analyze` | pass (0 errors, 2 unused-import warnings) |
| G5 | Fidelity (nullability, optionality, enum, `allOf`-wrapped enum) | pass |
| G6 | Real payloads round-trip | pass |
| G7 | Works on our own `Dio` | pass |
| G8 | Weight / determinism | deterministic across runs; but ~3 000 lines for 4 endpoints, plus a Java toolchain and ~25 MB generator jar in CI |
| — | **Unknown error code from a newer server** | **fails the whole response** (`CheckedFromJsonException`); no generator option for an unknown-enum fallback |
| — | Naming / lint | enum members `UPPER_CASE`, DTO class names leak (`RegisterDto`), would need analyzer exclusions |

Decision rule agreed beforehand: adopt the generated client only if G1–G7 all pass. G2 failed, and the forward-compatibility flaw independently contradicts N−1 support, so hand-written models were adopted. The models are small (4 files, ~170 lines of source) and the guard makes drift impossible to miss.

## Consequences

- Any API change requires `pnpm contracts:generate` (TypeScript) **and**, when a schema changes, updating the Dart model and running `pnpm mobile:codegen` (the generated `*.freezed.dart` / `*.g.dart` are committed). CI fails on either omission: `contracts:check` for TypeScript, `flutter test` (the guard) for Dart.
- Endpoint wrappers are written by hand per endpoint (a few lines each); the guard covers schemas, not paths — path/method typos are caught by the per-endpoint tests.
- Breaking changes need a new version prefix; the API supports N−1 app versions (`min_supported_app_version`).
- Revisit if the API grows to dozens of endpoints and hand-written wrappers become the bottleneck, or if the generator's template becomes compatible with our SDK and gains an unknown-enum fallback.

## Evidence

P1-07: spec export, drift guard and typed TypeScript client (12 tests). P1-09: generator spike scored above; 56 Flutter tests including the contract guard, which was proven by eight spec-side mutations (renamed property, new required property, removed/added error code, nullability change, requiredness change, new schema, removed schema) and three Dart-side mutations.
