# Arena pipeline cutover (`ARENA_PIPELINE_DEFAULT`)

**Authority:** `ENGINE_ARCHITECTURE_V1.md` §6.5.

## Production Auth Surface

Production and release-gate auth are authoritative in the root `bty-app` only.

The nested `bty-website/bty-app` demo stub is non-deployable and excluded from the production execution path.

All Arena release-gate checks must resolve against the root `bty-app` contract:

- Supabase-backed login
- cookie session
- `requireUser`-aligned protected access

## Binary conditions (both required before `new` in production)

1. **Abandoned lock backlog:** `COUNT(*)` of Pipeline L runs with `completion_state = locked_step7_abandoned` that **lack** an audited administrative acknowledgment flag (per product schema, e.g. `administratively_acknowledged_at`) **= 0**.
2. **Staging smoke:** A designated test account completes **one full Pipeline N path** (run start → steps → completion → contract/verify as applicable) with **zero 5xx** on N endpoints.

If either condition is false, keep **`ARENA_PIPELINE_DEFAULT=legacy`**.

## Operational checklist

- [ ] **G-B automation gaps closed or waived with evidence** — `bty-app/docs/CI_RELEASE_GATE_MATRIX.md` § **Gate automation — resolve before cutover evaluation** (G-B04, G-B05, G-B06, G-B07, G-B09, G-B10).
- [ ] Run backlog SQL / admin report against production-like DB.
- [ ] Execute staging smoke on the N entry path (`/{locale}/bty-arena` with `ARENA_PIPELINE_DEFAULT=new` in that environment).
- [ ] **G-B05 — Arena release gate:** green **`.github/workflows/arena-release-gate.yml`** run + downloaded artifact **`arena-release-gate-evidence`** whose `BASE_URL` line matches the **staging** (or evaluated) deploy. See § **G-B05 — Arena release gate** below.
- [ ] **G-B10 — Elite Arena smoke coverage:** not closed by this artifact alone; Step 3–7 coverage evidence not explicitly recorded in `arena-release-gate-evidence`.
- [ ] Set `ARENA_PIPELINE_DEFAULT=new` only after both gates pass.
- [ ] Monitor `GET /api/arena/session/next` for **410** volume (legacy clients) per §6.6.
- [ ] **Production `OPENAI_API_KEY`** is set (validator Layer 2, mentor/chat). Confirm in deploy dashboard / secrets — not only local or CI.
- [ ] **`POST /api/cron/action-contract-escalation-expire`** is scheduled (e.g. `.github/workflows/action-contract-escalation-expire-cron.yml` hourly) with **`DEPLOY_URL`** + **`CRON_SECRET`**. See `docs/ACTION_CONTRACT_ESCALATION_EXPIRE_CRON.md`.
- [ ] **Post-cutover P1 — Human escalation review UI** (§ **Post-cutover P1 (priority)** below) — **required backlog**, not optional polish. **Do not** treat production `escalated` contracts as fully supportable until that UI (or equivalent operator workflow) exists; expiry cron only reverts to `pending` after SLA — it does not replace human disposition.
- [ ] **C3 cutover readiness:** Include **PENDING-014** and **PENDING-017** on the checklist (§ **Cutover readiness checklist — C3** below). **Non-blocking** for cutover; **post-cutover resolution** required for both.

## Post-cutover P1 (priority)

These items are **post-cutover commitments** with **explicit priority and target dates**. They are **not** “nice-to-have” polish.

| Item | Priority | Target date (UTC) | Notes |
| --- | --- | --- | --- |
| **Human escalation review UI** | **P1** | **2026-06-30** | Ship an operator-facing workflow (admin or dedicated surface) to **review, approve, reject, or otherwise resolve** Action Contracts in **`escalated`** state. **`POST /api/cron/action-contract-escalation-expire`** only SLA-reverts to **`pending`**; it does **not** replace human disposition. Until this UI (or an equivalent documented operator process) exists, production **`escalated`** is **not** fully supportable end-to-end. |

## Cutover readiness checklist — C3 tracked items (PENDING-014 & PENDING-017; remain open)

**PENDING-014** and **PENDING-017** are **tracked open** work items. **Both must appear** on every cutover readiness checklist (table + checkboxes below). Per **prior classification**: **neither blocks** pipeline cutover (`ARENA_PIPELINE_DEFAULT=new`); **both require resolution** after cutover (track closure in `docs/CURRENT_TASK.md` / task board). Omitting either row from a cutover review is **not** allowed.

| ID | Scope (summary) | Blocks cutover? | After cutover |
| --- | --- | --- | --- |
| **PENDING-014** | E2E fixture `seedFixtureUser` + `GET /api/arena/core-xp` → `requiresBeginnerPath:false` — `bty-app/scripts/pending014-core-xp-verify.ts`; `POST /api/arena/run/complete` history sync **optional** when service role absent | **No** | Close per E2E / fixture plan |
| **PENDING-017** | Parallel queue / task-board premise — formal queue refill / splint closure (integration for current run verified via lint/test/build **PASS**; backlog item remains) | **No** | Close per `docs/agent-runtime/PARALLEL_QUEUE_REFILL.md` / board procedure |

Checklist line items (copy into release window notes):

- [ ] **PENDING-014** reviewed — **non-blocking**; post-cutover resolution **required**
- [ ] **PENDING-017** reviewed — **non-blocking**; post-cutover resolution **required**

## G-B04 — Production DB evidence (Pipeline L `locked_step7_abandoned`)

**Normative pass:** For `arena_runs` with `completion_state = 'locked_step7_abandoned'` and **Pipeline L** (`pipeline IN ('L', 'legacy')` per `ENGINE_ARCHITECTURE_V1` §6.4), either **there are zero rows**, or **every row has** `administratively_acknowledged_at IS NOT NULL`. Equivalently, the query below must return **`blocking_without_ack = 0`**.

**Script:** `bty-app/scripts/sql/gb04-pipeline-l-abandoned-backlog.sql` (run in **production** Supabase SQL Editor or `psql`).

**Schema:** Requires columns on `public.arena_runs`: `completion_state`, `pipeline`, `administratively_acknowledged_at`. If any are missing, add the product migration before cutover evaluation — do not invent filters in application code without DB alignment.

### Evidence log (operator — append after each production verification)

| Field | Value |
| --- | --- |
| Date (UTC) | |
| Supabase project ref / env | production |
| Executed by | |
| `total_pipeline_l_abandoned` | |
| `with_administrative_ack` | |
| `blocking_without_ack` | **must be `0` for G-B04 pass** |

### Attached output (paste SQL result or screenshot reference)

**Latest run (replace with production output):**

```text
blocking_without_ack: <operator to fill — must be 0>
total_pipeline_l_abandoned: <operator to fill>
with_administrative_ack: <operator to fill>
```

*Automated agents cannot query production DB from this repo; attach evidence here after operator execution.*

---

## G-B05 — Arena release gate (workflow + `arena-release-gate-evidence` artifact)

**Normative pass:** GitHub Actions workflow **`Arena release gate`** completes **successfully** and uploads artifact **`arena-release-gate-evidence`** containing **`ARENA_RELEASE_GATE_AUTHENTICATED=PASS`** and a **`BASE_URL=`** line that matches the **origin under test** (staging / preview / prod as declared for cutover).

**How to run:** Repository **`dentistchi/bty-website`** → Actions → **Arena release gate** → **Run workflow**. **Always** set **base_url** to the deploy origin (e.g. `https://<staging>.…`) **or** ensure repo secret **`BASE_URL`** is set — empty **`BASE_URL`** fails immediately (`FAIL: BASE_URL is required`).

**Required secrets:** **`E2E_EMAIL`**, **`E2E_PASSWORD`** must authenticate against **that same origin** (`POST /api/auth/login` → **200**). If login returns **401** `Invalid login credentials`, update secrets or use credentials that exist on the target Supabase project.

**Auth contract (Commander / C5 — authoritative):** Full QA criteria and blocking rules: **`bty-app/docs/BTY_RELEASE_GATE_CHECK.md`** § **Auth contract**. In short: valid login **200**; response includes **`Set-Cookie`**; authenticated **`GET /api/arena/session/next?locale=en`** succeeds (**200**, `ok: true`); **no** in-memory-only auth on **production** or **release-gate** path; **demo-auth** or test bypass in prod → **blocking**. **`bty-app/scripts/arena-release-gate.sh`** enforces **Set-Cookie** + **session/next** after login.

**Status:** **PASS**

**Normative pass** confirmed by green GitHub Actions workflow:

- Workflow: `Arena release gate`
- Repository: `dentistchi/bty-website`
- Run ID: `23910789402`
- Run URL: https://github.com/dentistchi/bty-website/actions/runs/23910789402

### Evidence artifact: `arena-release-gate-evidence`

```text
ARENA_RELEASE_GATE_AUTHENTICATED=PASS
BASE_URL=https://bty-website.ywamer2022.workers.dev
```

---

## Environment

| Variable | Values | Default if unset / invalid |
| --- | --- | --- |
| `ARENA_PIPELINE_DEFAULT` | `legacy` \| `new` | **`legacy`** (fail-safe) |

### Environment secrets (operator log — example)

GitHub → Settings → Secrets and variables → Actions: `DEPLOY_URL`, `CRON_SECRET` (see `docs/ACTION_CONTRACT_ESCALATION_EXPIRE_CRON.md`).

Cloudflare / deploy dashboard: `OPENAI_API_KEY` server-side only (see `docs/SECURITY.md`).

**Example confirmation (replace when re-verified):**

- Date checked: 2026-04-02  
- `OPENAI_API_KEY` (production): confirmed present (operator)  
- `DEPLOY_URL` / `CRON_SECRET` (GitHub Actions): confirmed present  

Approved `DEPLOY_URL` format (no trailing path): `https://bty-website.ywamer2022.workers.dev`
