# E2E account hygiene and reset — Arena Step 6 (incl. forced-elite)

**Scope:** Playwright specs under `e2e/bty/elite-action-contract*.spec.ts`, helpers `e2e/helpers/arena-step6-*.ts`, and server behavior in `runArenaSessionNextCore` / `fetchBlockingArenaContractForSession`.

**Goal:** Avoid flaky **403** (`user_ejected_from_arena`) and **409** (`action_contract_pending`, **`open_contract_exists_for_family`**) that are **environment state**, not product regressions.

**Cross-project contention (CI / `playwright test`):** `bty-loop`, **`chromium`** (arena-hub, journey, arena-play, …), and **`bty-loop-step6`** all reuse the **same** `e2e/.auth/user.json` principal. If **`bty-loop-step6`** runs **while** another project still exercises Arena for that user, you can see **409** `open_contract_exists_for_family` mid-test and **`policy-after` cleanup deleting rows another test created** — that is **E2E scheduling**, not a Step 6 product regression.

**Mitigation (default in `playwright.config.ts`):** project **`bty-loop-step6`** depends on **`setup`**, **`bty-loop`**, and **`chromium`**, so Step 6 runs only **after** those default-user suites finish. Selecting **`bty-loop-step6`** alone still pulls those dependencies (Playwright behavior). **Fast local path** when the DB is already clean: **`npm run test:e2e:bty-step6:isolated`** (`PW_STEP6_ISOLATED=1` → depend on `setup` only).

**Further hardening:** separate auth users for policy Step 6 vs forced Step 6 vs general BTY (extra secrets + storage states), or a **dedicated CI job** that runs Step 6 after other E2E in a separate process — optional if the dependency graph is not enough.

**Triage first (session router):** If **`GET /api/arena/session/next`** or **`GET /api/arena/n/session`** returns **409** or **403** in E2E (especially Arena Step 6 / forced-elite), **assume fixture hygiene** until disproven: blocking `bty_action_contracts`, **`arena_profiles.arena_status`**, or stale auth vs **`E2E_EMAIL`**. Re-run **`npm run e2e:seed-fixture-user`** (after **`E2E_EMAIL`** matches `expectedFixtureLoginEmail()`), then **`e2e:auth`**. See §2–§5 before filing a product regression.

---

## 1. Dedicated forced-elite E2E account policy

**Recommendation — one stable “Arena Step 6” principal per environment (staging / CI Supabase):**

| Policy | Detail |
| --- | --- |
| **Identity** | Use a **dedicated** auth user for Arena-heavy E2E — not personal dev accounts, not shared with manual exploratory testing on the same project. |
| **Alignment with seed** | Prefer credentials that match **`seedFixtureUser`** defaults: `e2e-fixture+bty@local.test` + password from `FIXTURE_USER_PASSWORD` in `src/engine/integration/e2e-test-fixtures.service.ts`, or set **`E2E_EMAIL` / `E2E_PASSWORD`** to match an operator-created user and pass **`E2E_FIXTURE_USER_ID`** to that user’s UUID so `seedFixtureUser` targets the same row. |
| **Forced-elite tests** | `installForcedEliteSessionRouter` **only rewrites successful (200) session-router JSON** to inject `eliteSetup`. It does **not** fix upstream **409** or **403** — those pass through unchanged (`e2e/helpers/arena-step6-forced-elite.ts`). The account must still get a real **200** from `GET /api/arena/session/next` (or `/api/arena/n/session`) **before** the route handler merges the fixture. |
| **Forced-elite — beginner path** | The app routes users with **`requiresBeginnerPath`** (from **`GET /api/arena/core-xp`**) to **`/[locale]/bty-arena/beginner`** and **does not** call the session router on that path. Forced-elite cannot apply there. The fixture must be **arena-ready and not on the beginner path** (onboarding complete per product rules). If `prepareFreshArenaSessionElite` returns **`reason: "beginner-path"`**, `elite-action-contract.forced-elite.spec.ts` **fails fast** with an explicit fixture message — not an intercept bug. |
| **State-aware tests** | `elite-action-contract.spec.ts` may **skip** when routing is beginner/non-elite; `elite-action-contract.forced-elite.spec.ts` **expects** `gate.proceed === true` — hygiene failures surface as hard failures there first. |

---

## 2. What must be clean before each run (DB + app)

**A. Session router blockers (server)**

Implemented in `src/lib/bty/arena/blockingArenaActionContract.ts` and consumed by `runArenaSessionNextCore` (`src/lib/bty/arena/arenaSessionNextCore.ts`).

The session gate returns **409** `action_contract_pending` when **any** of these exist for the user:

- `bty_action_contracts.status` ∈ **`submitted`**, **`escalated`** (any row).
- **`pending`** with **`deadline_at` > now** (future deadline).
- **`approved`** with **`validation_approved_at` not null**, **`verified_at` null**, and **`deadline_at` > now** (awaiting verification window).

**B. Arena ejection (server)**

- **403** with `code: user_ejected_from_arena` when `getNextScenarioForSession` resolves to ejected / suspended access (`arenaSessionNextCore` + `arena-center-ejection` / `isUserArenaEjected` path).
- **`seedFixtureUser`** upserts `arena_profiles` but **does not** set `arena_status` on conflict — an existing **`EJECTED`** value can **persist** unless cleared explicitly (see migration `arena_status` in `supabase/migrations/20260428110000_arena_status_ejection.sql`).

**C. Browser-only (client)**

- Helpers call **`clearArenaStorage`** (`sessionStorage` + `localStorage` key `btyArenaState:v1`) before reload — this clears **client** residue only, **not** Supabase.

**D. What `seedFixtureUser` does / does not do**

- **Does:** `arena_profiles`, `weekly_xp`, healing phase, difficulty, onboarding **`step_completed = 5`**, avatar state, equipped assets cleared, minimal scenario/catalog helpers — see `src/engine/integration/e2e-test-fixtures.service.ts`.
- **Does not:** bulk-delete **`bty_action_contracts`**, reset **`arena_status`**, or clear **`arena_runs` / events** for the user. Treat those as **hygiene** when flakes appear.

---

## 3. Reset / clean open contracts and pending states

### Recommended reset approach (order)

1. **Identify user id** — match `E2E_EMAIL` in Supabase Auth (`auth.users`) or use `resolveE2ETestUserId()` / `E2E_FIXTURE_USER_ID`.
2. **Clear blocking contracts** — in **staging only**, resolve or delete rows that match §2A predicates (operator policy: cancel vs delete vs status moves must follow product rules; for **test-only** sandboxes, destructive cleanup is acceptable if FK-safe).
3. **Lift ejection** — set `arena_profiles.arena_status = 'ACTIVE'` for that `user_id` when ejection is test pollution (not when testing ejection itself).
4. **Re-seed baseline profile** — `npm run e2e:seed-fixture-user` (requires `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`).
5. **Refresh Playwright auth** — `npm run e2e:auth` so `e2e/.auth/user.json` matches the same deploy + cookies.

### Scripts / endpoints

| Mechanism | Role |
| --- | --- |
| **`npm run e2e:seed-fixture-user`** | Runs `scripts/e2e-seed-fixture-user.ts` → `seedFixtureUser()`. Baseline Arena onboarding + profile; **not** a full contract/ejection reset. |
| **`npm run seed:arena-release-gate-fixture`** | Same seed pattern for release-gate / ops (`scripts/seed-arena-release-gate-fixture.ts`). |
| **`POST /api/admin/recover-contract`** | **Creates/repairs** missing `bty_action_contracts` for a completed run (`requireAdminEmail`). **Not** a bulk cleaner for pending contracts. |
| **Supabase SQL / Dashboard** | **Authoritative** for deleting or updating stuck `bty_action_contracts` rows and fixing `arena_profiles.arena_status` when no first-class admin “reset test user” API exists. |

**Optional nuclear option:** `clearFixtureUser()` in `e2e-test-fixtures.service.ts` deletes the fixture auth user and related rows — use only when you intend to **recreate** the whole fixture (destructive).

---

## 4. Local vs CI — fresh allowed session

| Context | How to get a “fresh enough” session |
| --- | --- |
| **Local** | Export `BASE_URL`, `E2E_EMAIL`, `E2E_PASSWORD`, Supabase keys; run **`e2e:seed-fixture-user`** if using the fixture account; then **`e2e:auth`**; run **`npm run test:e2e:bty`** or targeted spec. Use **deployed `BASE_URL`** that matches the Supabase project behind those credentials. |
| **CI** (`.github/workflows/e2e.yml`) | **`e2e:verify-fixture-email`** ( **`E2E_EMAIL`** must match **`expectedFixtureLoginEmail()`** for **`seedFixtureUser`**). **`e2e:seed-default-journey`** + **`e2e:seed-comeback`**, then **`e2e:seed-fixture-user`**, then **`e2e:auth`** / **`e2e:auth:comeback`**, then **`test:e2e:ci`**. Requires **`NEXT_PUBLIC_SUPABASE_URL`** + **`SUPABASE_SERVICE_ROLE_KEY`**. **`test:e2e:ci`** does not currently include **`bty-loop`** / **`bty-loop-step6`**; when you add full BTY E2E to CI, rely on **`bty-loop-step6`** project dependencies (or run Step 6 in a **second** workflow step after the rest) so it is not concurrent with other default-user Arena tests. |
| **Cookie jar** | `auth.setup.ts` clears cookies before login; `storageState` is reused per project — **one** principal per `bty-loop` project. Serial tests (`forced-elite` uses `test.describe.configure({ mode: "serial" })`) reduce cross-test interference. |

---

## 5. Hygiene vs real regressions

| Signal | Likely **hygiene / environment** | Likely **regression** (investigate code)** |
| --- | --- | --- |
| **409** on session/next before route mock | Open contract per §2A; stale pending with future `deadline_at` | Gate query wrong after schema change |
| **403** `user_ejected_from_arena` | `arena_profiles.arena_status = EJECTED` or true ejection rule firing on dirty AIR / slip history | Selection or ejection logic bug |
| **Forced-elite test fails immediately on `gate.proceed`** | Real response was not **200** (409/403/401) — clean DB + cookies | Router always fails even on clean user |
| **`gate.reason === "beginner-path"` in forced-elite** | Account is on **beginner / onboarding** route (`requiresBeginnerPath`); complete onboarding or use a seeded non-beginner fixture (`e2e:seed-fixture-user` + **`core-xp`** profile that does not require beginner). **Not** a session-router intercept issue. | Core-xp or beginner gate regression |
| **200** but UI does not reach Step 6 | Stale client storage (try `clearArenaStorage` path), slow load, or non-elite DOM path | Elite flow / testids broken |
| **After successful prior run** | Leftover **`submitted`/`escalated`/blocking pending** contract | Validator or commit path not updating status |

---

## Exact states to clear before forced-elite Step 6 (checklist)

For the **E2E user id** under test:

1. **Beginner / onboarding** — **`GET /api/arena/core-xp`** must **not** set **`requiresBeginnerPath`** for this user; otherwise the client navigates to **`/bty-arena/beginner`** and forced-elite session interception **never runs**. Seed and profile state should reflect **onboarding complete** for arena main path.
2. **`bty_action_contracts`** — no blocking rows per **`fetchBlockingArenaContractForSession`** (§2A); pending / conflicting contract state blocks **200** on the session router before the intercept can merge the fixture.
3. **`arena_profiles.arena_status`** — **`ACTIVE`** (not **`EJECTED`**) when the test is not ejection-focused.
4. **Auth + cookies** — valid session for the same **`BASE_URL`** as the app (`auth.setup` + secrets aligned).
5. **Browser** — optional `clearArenaStorage` + reload (already in `prepareFreshArenaSessionElite` / `reloadArenaFreshAndGateEliteStep6`).

---

## Related code references

- Blocking contract definition: `src/lib/bty/arena/blockingArenaActionContract.ts`
- Session next core: `src/lib/bty/arena/arenaSessionNextCore.ts`
- Forced-elite route: `e2e/helpers/arena-step6-forced-elite.ts`
- Fixture seed: `src/engine/integration/e2e-test-fixtures.service.ts`

---

## Next steps (operators)

- [x] CI: **`e2e:seed-fixture-user`** before **`e2e:auth`** + **`e2e:verify-fixture-email`** (`.github/workflows/e2e.yml`).
- [ ] Optionally add a **maintainer-only** script: `clearArenaE2EBlockingState(userId)` (service role) that applies §2A + `arena_status` reset — keep out of production deploy path; staging only.
