# BTY Release Gate Check

## Arena release signoff (blocking)

**Do not sign off** an Arena rollout (production or preview) until the **`arena-release-gate-evidence`** artifact from a **green** `.github/workflows/arena-release-gate.yml` run exists, with the artifact’s `BASE_URL` line **matching the deployed origin** (workflow `base_url` input or `BASE_URL` secret must target that deploy).

**Rejected (not valid for signoff):** local `verify:arena-release-gate` runs without this artifact; code or documentation claims alone; “deploy succeeded” / preview URL only; task-board or lint/test green without the artifact.

**Recorded signoff (final · 2026-03-25):** **`BASE_URL=https://bty-website.ywamer2022.workers.dev`** — green **`arena-release-gate.yml`** run **`https://github.com/dentistchi/bty-website/actions/runs/23525350606`**, artifact **`arena-release-gate-evidence`**; release status finalized on this evidence (no redeploy, gate not re-run).

## Arena automation (CI / post-deploy)

- **Script:** `bty-app/scripts/arena-release-gate.sh` — `npm run verify:arena-release-gate` from `bty-app/`.
- **Env:** `BASE_URL` (deploy origin), `E2E_EMAIL`, `E2E_PASSWORD` (same smoke user as Playwright E2E).
- **GitHub Actions:** `.github/workflows/arena-release-gate.yml` — **workflow_dispatch**; optional `base_url` input overrides `BASE_URL` secret. On success, uploads artifact **`arena-release-gate-evidence`** as signoff evidence.
- **Pass:** `POST /api/auth/login` → 200; `GET /api/arena/session/next?locale=en` → 200, JSON `ok: true`, body must not contain `no_scenario_available`; `HEAD /en/bty-arena/run` (no redirect follow) → **308** with `Location` pointing at canonical `/bty-arena` (not `/run`); authenticated `GET /en/bty-arena/run` with `-L` → final URL on `/en/bty-arena` (or `/beginner`), not `/bty/login`.

## Arena release gate

- /[locale]/bty-arena first fetch includes /api/arena/session/next
- /[locale]/bty-arena/run lands on canonical Arena flow
- stale local state / invalid runId recovers to canonical session flow
- session/next returns at least one valid scenario or explicit guarded fallback
- /api/arena/session/next must never silently return empty pool without logs or fallback