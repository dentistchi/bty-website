# CI release gate matrix (G-B01–G-B11)

Maps **`QA_INTEGRITY_FRAMEWORK_V1.md` Section 5** blocking gates to a **concrete verification method** in this repository.  
**Normative gate definitions:** `QA_INTEGRITY_FRAMEWORK_V1.md` at the **monorepo / documentation root** (same tree as `QA_C3_TESTABILITY_REVIEW_V1.md`).

| Gate | Pass condition (summary) | Verification method in CI / automation | Workflow or script |
| --- | --- | --- | --- |
| **G-B01** | **INV-M01–INV-M15** automated tests pass | **Vitest** full suite (`npm test`) on `bty-app` — exercises HTTP routes and domain tests that encode pipeline **410**, **409** pending contract, validator ordering, etc. | `.github/workflows/qa-integrity-gates.yml` → job `vitest` |
| **G-B02** | Pipeline N entry correct under **both** `ARENA_PIPELINE_DEFAULT` values | Vitest: `src/app/api/arena/n/session/route.test.ts` + related arena session tests; env mocked per case | `qa-integrity-gates.yml` → `vitest` |
| **G-B03** | `session/next` → **410** when `ARENA_PIPELINE_DEFAULT=new` | Vitest: `src/app/api/arena/session/next/route.test.ts` | `qa-integrity-gates.yml` → `vitest` |
| **G-B04** | Zero active **Pipeline L** `locked_step7_abandoned` at cutover | **Not automated in GitHub Actions** — pre-cutover **DB report** / operator checklist (per `ENGINE_ARCHITECTURE_V1.md` §6.5). Document as **manual blocking** before prod deploy. | *Manual* (document in runbook) |
| **G-B05** | Staging smoke: **zero 5xx** on critical path | **Not in PR CI** — `Arena release gate` workflow: **auth contract** — login **200**, **`Set-Cookie`** on success, **`GET /api/arena/session/next`** **200** + `ok:true`; **no** in-memory-only / demo-auth on prod path (see `bty-app/docs/BTY_RELEASE_GATE_CHECK.md` § Auth contract) | `.github/workflows/arena-release-gate.yml` (`workflow_dispatch`) |
| **G-B06** | Validator L1 returns **all** field errors at once | **Vitest:** `src/app/api/bty/action-contract/submit-validation/route.test.ts` (multi-field `revise`). **Manual POST** sign-off optional if CI green. | `qa-integrity-gates.yml` → `vitest` |
| **G-B07** | Validator L2 **no rationale** in API JSON | **Vitest:** same file — `approve` / `reject` / `escalate` responses **only** `{ outcome }` (no rationale keys). | `qa-integrity-gates.yml` → `vitest` |
| **G-B08** | `complete_verified` ⇔ **verified_at** + **approved** | **DB:** `bty_action_contracts` CHECK (`20260431240000_engine_pattern_level_state_machine.sql`). **Tests:** arena run / QR flows in Vitest where present | `qa-integrity-gates.yml` → `vitest` + **Supabase migration** applied on env |
| **G-B09** | No forbidden **UX_FLOW_LOCK_V1** §5 patterns in shipped copy | **Partial:** `npm run lint:ux-flow-gb09` + normative **`docs/terminology-locks/UX_FLOW_LOCK_V1.md`** §5; spot-check on copy changes | *PR / cutover:* run probe; evidence in **`BTY_RELEASE_GATE_CHECK.md`** |
| **G-B10** | Step 5 **Continue** only (no auto-advance) | **Partial:** `acknowledgment_timestamp` migration + engine rules. **Playwright** path **recommended** | `npm run test:e2e:ci` (optional extended job) |
| **G-B11** | Terminology forbidden-substitution **zero** violations | `node scripts/terminology-lint.mjs` | `.github/workflows/terminology-lint.yml` and `qa-integrity-gates.yml` → job `terminology-lint` |

## Cutover gate tracking (G-B04, G-B05, G-B06, G-B07, G-B09, G-B10)

Use this table **before** cutover gate evaluation (`ARENA_PIPELINE_DEFAULT=new` per `ENGINE_ARCHITECTURE_V1.md` §6.5). Each gate must be either **fully automated in CI** or **explicitly signed off** via the manual process below.

| Gate | Pass condition (normative) | Automation today | Manual / verification process (until full automation) | Evidence to archive before cutover | Next action toward full automation |
| --- | --- | --- | --- | --- | --- |
| **G-B04** | Zero blocking Pipeline L `locked_step7_abandoned` backlog (per §6.5.1 / matrix summary) | **None** in GitHub Actions | **Operator DB report:** SQL or dashboard proving `COUNT(*) = 0` for runs in `locked_step7_abandoned` state **without** `administratively_acknowledged_at` (or equivalent). Cross-check `ENGINE_ARCHITECTURE_V1.md` §6.5. | Dated query output or screenshot + sign-off line in release window notes | Optional: `bty-app/scripts/sql/gb04-pipeline-l-abandoned-backlog.sql` + evidence table in `ARENA_PIPELINE_CUTOVER.md` § **G-B04 — Production DB evidence** (still manual) |
| **G-B05** | Staging smoke: **zero 5xx** on critical path; **auth contract** (login **200**, **`Set-Cookie`**, authenticated **`session/next`**) | **Semi-auto:** **`workflow_dispatch`** only | Run **`.github/workflows/arena-release-gate.yml`** with `BASE_URL` = staging deploy + **E2E** secrets; script asserts **`Set-Cookie`** + **`session/next`**. **Blocking:** in-memory-only auth or demo-auth on prod/release-gate path. | `arena-release-gate-evidence.txt` from a green run + `BASE_URL` recorded | Wire post-deploy `workflow_call` from deploy workflow (optional) |
| **G-B06** | Validator L1 returns **all** field errors at once | **Vitest** `submit-validation/route.test.ts` (G-B06 case) | **Manual** POST optional if CI green. | Green CI + PR link | — |
| **G-B07** | Validator L2 **no rationale** in API JSON | **Vitest** same file (G-B07 approve/reject/escalate) | **Manual** negative test optional if CI green. | Green CI + PR link | — |
| **G-B09** | No forbidden **UX_FLOW_LOCK_V1** §5 patterns in shipped copy | **Partial:** `npm run lint:ux-flow-gb09` in `bty-app` (`scripts/ux-flow-lock-gb09-sweep.mjs`) — high-risk phrase probe; normative **`docs/terminology-locks/UX_FLOW_LOCK_V1.md`** §5 | **Manual** spot-check of Elite / validator surfaces on copy changes; automated probe before cutover | **`docs/BTY_RELEASE_GATE_CHECK.md`** G-B09 line (2026-03-28 PASS) | **Completed baseline** 2026-03-28; re-run probe + spot-check when shipped copy changes; optional ESLint pack later |
| **G-B10** | Step 5 **Continue** only (no auto-advance) | **Partial** (migrations + engine) | **Manual** QA: Elite Step 5 — only Continue advances; no timer auto-advance. Optional: **`npm run test:e2e:ci`** extended scenario when Playwright covers path. | QA notes + build ID / env | Add Playwright spec for Elite Step 5 (or extend `e2e.yml` job) |

**Evaluation order (recommended):** **G-B05** (staging smoke) + **G-B04** (DB) can gate environment readiness; **G-B06/G-B07** gate API contract; **G-B09** copy; **G-B10** UX. **G-B01–G-B03, G-B08, G-B11** remain covered by `qa-integrity-gates.yml` Vitest + terminology.

**Single source:** `QA_INTEGRITY_FRAMEWORK_V1.md` §5 (monorepo docs root); **`BTY_RELEASE_GATE_CHECK.md`** (repo root) — append cutover sign-off line when all rows above are satisfied.

### Gate automation — resolve before cutover evaluation

Treat cutover evaluation as **blocked** until every row below is either **done (automation)** or **done (manual evidence on file)**. “Resolve” means **no open gap** for that gate in this table.

| Gate | Open automation gap (if any) | Resolve by | Evidence when resolved |
| --- | --- | --- | --- |
| **G-B04** | No CI for Pipeline L abandoned backlog | **Manual:** DB/report **COUNT = 0** per `ENGINE_ARCHITECTURE_V1.md` §6.5 | Dated SQL output + operator sign-off in release notes |
| **G-B05** | Not on every PR; `workflow_dispatch` only | **Manual:** green **`arena-release-gate.yml`** on **staging** `BASE_URL` | Artifact **`arena-release-gate-evidence`** + run URL |
| **G-B06** | Multi-field L1 bundle may lack dedicated Vitest | **Automation:** add `submit-validation.route.test.ts` **or** **Manual:** saved multi-field invalid POST + all L1 errors in one body | Vitest green in `qa-integrity-gates` **or** archived JSON + reviewer |
| **G-B07** | Response-key contract may lack negative Vitest | **Automation:** Vitest asserts no L2 rationale keys **or** **Manual:** saved responses + checklist | Same |
| **G-B09** | Full UX copy not 100% lint-encoded | **Automation:** `npm run lint:ux-flow-gb09` (probe) + spot-check on Elite copy | **`BTY_RELEASE_GATE_CHECK.md`** line + probe PASS log; re-run when shipped copy changes |
| **G-B10** | Step 5 UX may lack Playwright | **Automation:** Playwright spec **or** **Manual:** QA script + build ID | CI job **or** signed QA notes |

**Core CI already green for cutover-adjacent gates:** **G-B01–G-B03, G-B08, G-B11** via `qa-integrity-gates.yml` (Vitest + terminology). **Do not** conflate that with closing **G-B04–G-B07, G-B09–G-B10** rows above.

**Operator shortcut:** Copy the table into release-window notes and tick each **Resolve by** row before scheduling `ARENA_PIPELINE_DEFAULT=new` review.

### C3 — cutover readiness (PENDING-014 & PENDING-017 remain open; non-blocking)

**PENDING-014** and **PENDING-017** **remain open**. They **must appear** on the cutover readiness checklist (`ARENA_PIPELINE_CUTOVER.md` § “Cutover readiness checklist — C3 tracked items”). **Neither blocks** cutover per prior classification; **both require resolution post-cutover** (not optional).

| Item | Summary | Blocks cutover? |
| --- | --- | --- |
| **PENDING-014** | E2E `seedFixtureUser` + core-xp `requiresBeginnerPath:false` (`scripts/pending014-core-xp-verify.ts`); run/complete history sync optional without service role | **No** |
| **PENDING-017** | Parallel queue / board closure (refill / splint); current-run integration still **PASS** via lint/test/build | **No** |

**Normative pointer:** `ARENA_PIPELINE_CUTOVER.md` (this repo, `bty-app/docs/`).

## Related schema (C3 testability §1.3)

- **`public.validator_evaluations`** view → underlying `bty_action_contract_validator_evaluations` (evaluation **id**, **layer2_invoked**, **layer1_failure_count**).
- **`public.bty_action_contract_escalation_resolutions`** — secondary disposition audit (**INV-M05** / **INV-S04**); populate when implementing human **escalated → approved** API path.

---

*Last updated: § **Gate automation — resolve before cutover evaluation** (scannable gaps + evidence); **G-B09** baseline sweep **complete** (2026-03-28 — `UX_FLOW_LOCK_V1.md` §5 + `npm run lint:ux-flow-gb09` PASS); cutover tracking table (G-B04–G-B07, G-B09, G-B10); C3 migration `20260431260000_validator_evaluations_escalation_audit.sql`; C3 **PENDING-014 / PENDING-017** remain **open**, **must appear** on cutover readiness checklist (non-blocking cutover; **post-cutover resolution** required).*
