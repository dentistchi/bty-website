# BTY Release Gate Check

## Arena release signoff (blocking)

**Do not sign off** an Arena rollout (production or preview) until the **`arena-release-gate-evidence`** artifact from a **green** `.github/workflows/arena-release-gate.yml` run exists, with the artifact’s `BASE_URL` line **matching the deployed origin** (workflow `base_url` input or `BASE_URL` secret must target that deploy).

**Rejected (not valid for signoff):** local `verify:arena-release-gate` runs without this artifact; code or documentation claims alone; “deploy succeeded” / preview URL only; task-board or lint/test green without the artifact.

**Recorded signoff (final · 2026-03-25):** **`BASE_URL=https://bty-website.ywamer2022.workers.dev`** — green **`arena-release-gate.yml`** run **`https://github.com/dentistchi/bty-website/actions/runs/23525350606`**, artifact **`arena-release-gate-evidence`**; release status finalized on this evidence (no redeploy, gate not re-run).

## Production Auth Surface

Production and release-gate auth are authoritative in the root `bty-app` only.

The nested `bty-website/bty-app` demo stub is non-deployable and excluded from the production execution path.

All Arena release-gate checks must resolve against the root `bty-app` contract:

- Supabase-backed login
- cookie session
- `requireUser`-aligned protected access

## Arena automation (CI / post-deploy)

- **Deploy source of truth:** Production Worker / OpenNext builds **must** come from the **monorepo root** `bty-app/` (Supabase cookie auth + Arena). The nested `bty-website/bty-app` directory is a **legacy stub** — `npm run deploy` there is **blocked**; it must not serve as `BASE_URL` for signoff.
- **Fixture state (onboarding redirect / session/next):** Before HTTP checks, the gate script runs **`seedFixtureUser()`** when `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`) and `SUPABASE_SERVICE_ROLE_KEY` are set (`SKIP_SEED_FIXTURE=1` to opt out). That seeds the same rows as E2E (`user_onboarding_progress.step_completed = 5`, arena profile, difficulty, avatar, min scenario). Align **`E2E_EMAIL` / `E2E_PASSWORD`** with the fixture account (defaults: `e2e-fixture+bty@local.test` + password in `e2e-test-fixtures.service.ts`) or omit secrets so those defaults apply after seed.
- **Script:** `bty-app/scripts/arena-release-gate.sh` — `npm run verify:arena-release-gate` from `bty-app/`.
- **Env:** `BASE_URL` (deploy origin), `E2E_EMAIL`, `E2E_PASSWORD` (same smoke user as Playwright E2E).
- **GitHub Actions:** `.github/workflows/arena-release-gate.yml` — **workflow_dispatch**; optional `base_url` input overrides `BASE_URL` secret. On success, uploads artifact **`arena-release-gate-evidence`** as signoff evidence.

### Auth contract (release gate — **authoritative**; **blocking**)

Manual QA and automated gate **must** all pass for the **same** `BASE_URL` + `E2E_*` credentials. **Commander (C5):** release gate remains the **authoritative** check for the deployed **auth contract** (login → cookie → authenticated API).

| Check | Requirement |
| --- | --- |
| **Login success** | `POST /api/auth/login` with valid credentials returns **HTTP 200**. |
| **Session cookie** | Login response includes at least one **`Set-Cookie`** (session must not be “headerless success” only). |
| **Authenticated API** | Follow-up **`GET /api/arena/session/next?locale=en`** with the cookie jar returns **200**, JSON **`ok: true`**, body must **not** contain `no_scenario_available`. |
| **Production path** | **No** reliance on **in-memory-only** session/auth stores on the **production** or **release-gate** path (e.g. a dev-only `Map` session table that never persists). **Violations → blocking.** |
| **Demo / bypass auth** | Any **demo-auth**, **test-only bypass**, or **mock identity** wired into **production** or **release-gate** routes/handlers (not gated to non-prod builds) is **blocking** until removed or strictly isolated from prod deploys. |

**Pass (full gate, after auth rows):** `HEAD /en/bty-arena/run` (no redirect follow) → **308** with `Location` pointing at canonical `/bty-arena` (not `/run`); authenticated `GET /en/bty-arena/run` with `-L` → final URL on `/en/bty-arena` (or `/beginner`), not `/bty/login`.

## Arena release gate

- /[locale]/bty-arena first fetch includes /api/arena/session/next
- /[locale]/bty-arena/run lands on canonical Arena flow
- stale local state / invalid runId recovers to canonical session flow
- session/next returns at least one valid scenario or explicit guarded fallback
- /api/arena/session/next must never silently return empty pool without logs or fallback