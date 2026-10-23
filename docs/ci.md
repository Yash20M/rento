# Quality gates and CI

One list of gates, run two ways: locally with `pnpm verify`, and in GitHub Actions on every pull request and push to
`main`. The list lives in [`scripts/verify-steps.mjs`](../scripts/verify-steps.mjs); the workflow is
[`.github/workflows/ci.yml`](../.github/workflows/ci.yml); `scripts/ci-config.test.mjs` fails if they drift apart.

## Running the gates locally

| Command | What it does | Needs |
|---|---|---|
| `pnpm check` | `pnpm lint` + `pnpm typecheck` (seconds) — run while coding | Node |
| `pnpm verify:fast` | everything except the Docker and browser steps | Node, Flutter SDK |
| `pnpm verify` | **all 16 gates**, with a per-step summary and exit code | Node, Docker, Flutter SDK, Playwright Chromium |
| `pnpm verify --only lint,api:unit` | just those steps | — |
| `pnpm verify --skip admin:e2e` | everything but those | — |
| `pnpm verify --keep-going` | do not stop at the first failure (report all) | — |
| `pnpm verify --list` | print the plan, run nothing | — |

`verify` stops at the first failing step (later steps are reported `skip`) and exits non-zero. If Docker or Flutter is missing it
**refuses to start** and tells you which flag to use, rather than failing halfway.

```text
── verify summary ─────────────────────────────────────
  lint            pass    4.1s  ESLint + Prettier
  typecheck       pass    6.3s  TypeScript (all packages)
  api:unit        FAIL   11.8s  API unit tests
  contracts       skip       -  OpenAPI contract drift + client compiles
  …
  2 passed, 1 failed, 13 skipped in 22.2s
  VERIFY FAILED
```

## The gates

| id | Command | Proves |
|---|---|---|
| `lint` | `pnpm lint` | ESLint (0 warnings) + Prettier |
| `typecheck` | `pnpm typecheck` | strict TypeScript in every package |
| `scripts` | `pnpm test:scripts` | the tooling itself: verify logic, migration guard (against real temp git repos), CI workflow rules |
| `migrations` | `pnpm check:migrations` | applied migrations were not edited or deleted (ADR-005) |
| `api:unit` | `pnpm --filter api test:unit` | domain rules, config, auth primitives, docs ↔ code consistency |
| `contracts` | `pnpm contracts:check` | `openapi.json` + generated TS types match the code; client compiles |
| `contracts:test` | `pnpm --filter @rento/contracts test` | the contract tooling |
| `admin:unit` | `pnpm --filter admin test` | admin component tests |
| `mobile:format` / `:analyze` / `:test` | `pnpm mobile:…` | Flutter format, analyzer (strict), unit + widget + contract-guard tests |
| `mobile:codegen` | `pnpm mobile:codegen:check` | committed freezed/json/l10n code equals a fresh regeneration |
| `api:db` | `pnpm --filter api test:db` | schema, constraints, transactions, harness (real PostGIS container) |
| `api:http` | `pnpm --filter api test:api` | HTTP behaviour incl. auth (real PostGIS container) |
| `api:concurrency` | `pnpm --filter api test:concurrency` | no double booking under parallel load (5 rounds × 2 policies) |
| `admin:e2e` | `pnpm --filter admin test:e2e` | Playwright smoke in Chromium against the production build |

## GitHub Actions

Triggers: `pull_request` and `push` to `main`. Read-only token (`permissions: contents: read`), no secrets, superseded PR runs are
cancelled, installs use `--frozen-lockfile`, actions are pinned to a major version, Flutter is pinned to **3.29.2** (keep equal to
your local SDK). No job uses `continue-on-error`, retries or skip flags — **a flaky test is a bug**.

| Job | Runs |
|---|---|
| `static` | lint, typecheck, `test:scripts`, migration guard (PR: against `origin/<base>`; push: against the previous commit) |
| `api` | unit, db, http, concurrency, `contracts:check`, contracts tests (Docker comes with the runner) |
| `admin` | component tests, Playwright (Chromium installed in the job; report uploaded on failure) |
| `mobile` | `flutter pub get`, codegen check, format, analyze, test |
| **`ci-success`** | needs all of the above; `if: always()`; fails unless every job is `success` |

### Required status check

Require **only `ci-success`**. It is red if any job failed, was cancelled or was skipped, so you never have to update branch
protection when jobs are added or renamed.

Recommended branch protection for `main`: require a pull request, require the `ci-success` check, require the branch to be up to
date, block force-pushes and deletions.

### One-time setup you must do (cannot be done from this repository state)

1. Create the GitHub repository and add the remote (`git remote add origin …`); make the first commit and push `main`.
2. Settings → Branches → add the protection rule above (select `ci-success` once it has run once).
3. The workflow has **not been executed on GitHub yet** (no remote exists). It is validated statically by `scripts/ci-config.test.mjs`
   and the same gates were dry-run on a clean copy of the repository (see the P1-11 Evidence in `DEVELOPMENT_PLAN.md`). Expect the
   first real run to need small fixes (runner images, action versions) — fix forward, never by skipping a gate.

## Known limits / follow-ups

- The concurrency suite runs once per CI run (it already repeats each scenario 5 times on fresh databases). The release gate **G-01**
  (5 consecutive green CI runs) is verified by looking at run history after P2-29.
- Flutter `integration_test` (emulator) is not in CI yet — P3-24.
- No deploy/CD stages yet — P4-09.
- The `db:codegen:verify` drift check runs inside the database test suite (`harness.db.spec.ts`), so it needs no separate step.
