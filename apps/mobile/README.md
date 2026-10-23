# Rento mobile (Flutter)

Customer app for Android and iOS. Design: root [README §11](../../README.md); decisions: [ADR-008](../../docs/adr/ADR-008-riverpod-flutter-state.md),
[ADR-010](../../docs/adr/ADR-010-rest-openapi-contract-first.md). Task tracker: [DEVELOPMENT_PLAN.md](../../DEVELOPMENT_PLAN.md).

**Toolchain:** Flutter 3.29.x (Dart 3.7). `intl` is pinned to `^0.19.0` by `flutter_localizations` in this SDK — bump it together
with Flutter.

## Run

The app needs `--dart-define`s (README §11.4). Ready-made files live in [`config/`](config):

```bash
cd apps/mobile
flutter pub get

# Android emulator against the local API (pnpm dev:db && pnpm --filter api dev)
flutter run --dart-define-from-file=config/dev.json

# staging / prod (edit the URL first; prod must be https)
flutter run --dart-define-from-file=config/staging.json
```

| Define | Required | Notes |
|---|---|---|
| `FLAVOR` | no (default `dev`) | `dev`, `staging` or `prod`. Non-prod builds show an "Environment: …" chip on the home screen. |
| `API_BASE_URL` | dev: default `http://10.0.2.2:3000`; staging/prod: **required** | `http(s)` URL, no trailing slash needed. **Prod must be `https`.** |
| `SENTRY_DSN` | no | Wired up in P4-07. |

- `10.0.2.2` is the Android emulator's alias for the host machine's `localhost`. On a **physical phone** use your computer's LAN
  address (e.g. `http://192.168.1.20:3000`) and make sure the API listens on it (`HOST=0.0.0.0`).
- Cleartext `http` is only for local development; Android release builds must talk to an `https` API.
- A build with an invalid configuration shows a "Rento cannot start" screen with the reason instead of a blank screen.
- **No secrets in the app.** Anything compiled in can be extracted; keep keys on the server.

## Quality gates

```bash
flutter analyze                                                  # must report: No issues found!
dart format --output=none --set-exit-if-changed lib/main.dart lib/app lib/core lib/features test   # formatting (generated l10n excluded)
flutter test                                                     # unit + widget tests
```

Root shortcuts: `pnpm mobile:analyze`, `pnpm mobile:test`, `pnpm mobile:format:check`.

## API models (contract-first)

The API contract lives in `packages/contracts/openapi.json`. The Dart models in `lib/core/api/models/` are hand-written `freezed`
classes (a generated `dart-dio` client was evaluated and rejected — see [ADR-010](../../docs/adr/ADR-010-rest-openapi-contract-first.md)).
`test/core/api/models/contract_test.dart` compares them with the contract on every `flutter test` run, so a change to the API that is
not mirrored here fails the build. After editing a model run `pnpm mobile:codegen` (build_runner + gen-l10n); the generated
`*.freezed.dart` / `*.g.dart` files are committed. A server error code this app does not know decodes to `ErrorCode.unknown`.

## Android build notes

- Debug APK: `flutter build apk --debug --dart-define-from-file=config/dev.json` (first build downloads Gradle dependencies — several minutes on a slow link).
- `minSdk` is **23** (Android 6.0) and `compileSdk` is **36** because `flutter_secure_storage` 10 requires them.
- Gradle prints a harmless warning that two plugins prefer NDK 27 while the project uses NDK 26. Setting `ndkVersion` would trigger a ~1 GB NDK download for no functional gain, so it is left alone until a plugin actually needs it.
- The `INTERNET` permission is declared in the **main** manifest (the Flutter template only adds it for debug/profile). Cleartext `http` is allowed in **debug builds only** (`src/debug/AndroidManifest.xml`); release builds must use `https`.
- iOS allows `http` to local-network hosts only (`NSAllowsLocalNetworking`); public hosts still require `https`.
- Android SDK licences must be accepted once (`flutter doctor --android-licenses`) before building on a new machine.

## Localisation

Strings live in `lib/l10n/app_en.arb`. After editing run `flutter gen-l10n`; the generated Dart in `lib/l10n/generated/` is
**committed** (never edit it by hand).

## Layout (README §11.2)

```text
lib/
├── main.dart                 bootstrap, ProviderScope, boot-failure screen
├── app/                      app.dart, router.dart, theme.dart, providers.dart, config/env.dart
├── core/                     api/ (dio shell), storage/ (secure store), widgets/ (shared, P3-11)
├── features/<feature>/       presentation → application → data (home is a placeholder)
└── l10n/                     ARB + generated
```

## Before real accounts exist — read this

The Android `applicationId` and iOS bundle id are the **placeholder `com.rento.app`**. Google, Meta and Apple sign-in (P0-02…P0-04)
register SHA-1 fingerprints / bundle ids against them, and store listings are tied to them — **decide the real id before creating
those accounts**; changing it later is painful. (The brand name is also still open, Q-13.)

iOS cannot be built on Windows; the `ios/` project is generated and exercised on a Mac / CI only.
