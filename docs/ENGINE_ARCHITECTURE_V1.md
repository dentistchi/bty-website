# ENGINE_ARCHITECTURE_V1

**Audience:** C4 (integration) and downstream implementers.  
**Normative locked sources cited herein:** `PATTERN_ACTION_MODEL_V1.md` (Sections 2, 4), **Philosophy Lock** (§9 equivalent — internal pattern / family identifiers non-exposure to clients), `LEADERSHIP_ENGINE_SPEC.md` (Stage/AIR/Mirror/TII boundaries), `ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` (BTY separation of Arena XP vs leadership metrics).  
**Repository note:** `PATTERN_ACTION_MODEL_V1.md` is referenced by Commander lock; if absent from repo, behavior is still governed by that document title + section references below.

---

## Section 1 — Service Boundaries

| Service | Responsibility (one sentence) | Primary inputs | Primary outputs | Governing locked document |
|--------|--------------------------------|----------------|-----------------|---------------------------|
| **Scenario Service** | Selects and serves the next scenario for a user without repeating scenario IDs already completed with a terminal **complete_verified** outcome, while respecting pool, tier, and mirror routing rules. | `user_id`, locale, history of served/completed scenario IDs, catalog metadata, optional `run_id` | Scenario payload (or structured error), optional mirror bundle, recall prompt | `LEADERSHIP_ENGINE_SPEC.md` (Mirror/role session), `ENGINE_ARCHITECTURE_DIRECTIVE_PLAN.md` §2; pool/rotation detail where specified in **Stage** scenario-router specs |
| **Pattern Engine** | Records discrete **pattern_signals** per run, accumulates **pattern_states** per user and family, evaluates thresholds, and fires triggers that enqueue validator/contract work without exposing raw family IDs to clients. | Run/step events, canonical `pattern_family` (server-side only), direction, timestamps | Signal rows, updated `pattern_states`, trigger events (internal) | `PATTERN_ACTION_MODEL_V1.md` §2 (families, caps, windows), Philosophy Lock §9 equivalent |
| **Action Contract Service** | Creates **action_contracts** rows with all ten PATTERN fields, validates **Layer 1** structural constraints, and drives **status** lifecycle through submission and verification linkage. | User id, run reference, validated contract payload, validator outcomes | Persisted contract row, status transitions, linkage to QR issuance | `PATTERN_ACTION_MODEL_V1.md` §4 (ten fields + status enum) |
| **Validator Service** | Performs **Layer 2** semantic validation on contract text and mapped pattern context, then routes outcomes to approve, reject, revise, or escalate with auditable reason codes. | Contract id, raw text, optional model/rule pack version | Outcome enum + structured feedback for UI (no internal family IDs) | `PATTERN_ACTION_MODEL_V1.md` §4 + validator stage annex (where defined) |
| **Execution Gate Service** | Mints **qr_tokens** encoding the user’s **verbatim** contract `raw_text`, exposes lock/unlock state for Step 7, and records verification receipts that satisfy **complete_verified** when combined with approval. | Contract id, approved contract snapshot, user action at gate | QR payload, token row, `verified_at`, lock flags | `PATTERN_ACTION_MODEL_V1.md` §4, Philosophy Lock §9 equivalent (no gaming surface) |
| **Level Engine** | Maintains **level_records** per user: band, `consecutive_verified_completions`, abandon counts; evaluates increase/decrease/hold per Section 5 rules; enforces post-change cooldown before the next band evaluation. | Last N terminal runs, `completion_state`, timestamps, `verified_at`, contract status | Updated band, counters, next evaluation eligibility timestamp | `PATTERN_ACTION_MODEL_V1.md` + committed cooldown in **Section 5** of this document |

---

## Section 2 — Data Schema

**Convention:** “**Spec**” = field defined in a named locked/stage document. “**impl-only**” = storage or ops convenience; **must not** change behavioral outcomes if omitted or replicated differently.

### `scenario_runs`

One row per scenario attempt (canonical name). **Current implementation note:** `public.arena_runs` is the live table; a migration may rename or add a compat view to `scenario_runs`.

| Column | Type | Constraints | Spec source |
|--------|------|-------------|-------------|
| `run_id` | `uuid` | PK, default `gen_random_uuid()` | **impl-only** (PK shape) |
| `user_id` | `uuid` | NOT NULL, FK → `auth.users` | **impl-only** |
| `scenario_id` | `text` | NOT NULL | Scenario catalog / Stage scenario ID spec |
| `started_at` | `timestamptz` | NOT NULL | **impl-only** |
| `completion_state` | `enum` | `in_progress`, `locked_step7_abandoned`, `complete_verified` | **ENGINE_ARCHITECTURE_V1** §3 (this document) + PATTERN run lifecycle |
| `acknowledgment_timestamp` | `timestamptz` | NULL until Step 5 **Continue** activated | **ENGINE_ARCHITECTURE_V1** §5 (Step 5 ack rule) |
| `current_step` | `smallint` | CHECK 1..7 | **impl-only** (UI sync); semantics locked by §3 |
| `status` | `text` | Legacy: e.g. `DONE`/`ACTIVE` | **impl-only** during L→N migration; must map to `completion_state` |
| `reached_step_2_at` | `timestamptz` | NULL until first event with `step >= 2` | **ENGINE_ARCHITECTURE_V1** §5 rule 3 (7-run window eligibility) |
| `meta` | `jsonb` | Optional | **impl-only** |

### `pattern_signals`

One row per signal per run; **max one per family per run** (Steps 2–4 only) per §5.

| Column | Type | Constraints | Spec source |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK | **impl-only** |
| `run_id` | `uuid` | NOT NULL, FK → `scenario_runs.run_id` | **impl-only** |
| `user_id` | `uuid` | NOT NULL | **impl-only** |
| `pattern_family` | `text` | NOT NULL; **must** be canonical name from `PATTERN_ACTION_MODEL_V1.md` §2; **canonical family id = `explanation_substitution`** — no legacy “explanation” alias in schema or API | **PATTERN_ACTION_MODEL_V1.md** §2 |
| `direction` | `enum` | `entry`, `exit` | **PATTERN_ACTION_MODEL_V1.md** §2 |
| `step` | `smallint` | CHECK 2..4 | **ENGINE_ARCHITECTURE_V1** §5 |
| `recorded_at` | `timestamptz` | NOT NULL | **impl-only** |
| `payload` | `jsonb` | Optional non-identifying metadata | **impl-only**; must not embed client-trusted scoring |

**Unique:** `(run_id, pattern_family)` where `step` in (2,3,4) — enforces per-run cap.

### `pattern_states`

Per-user accumulation and trigger bookkeeping.

| Column | Type | Constraints | Spec source |
|--------|------|-------------|-------------|
| `user_id` | `uuid` | PK | **impl-only** |
| `pattern_family` | `text` | PK (composite) or separate id | **PATTERN_ACTION_MODEL_V1.md** §2 |
| `window_run_ids` | `uuid[]` or join table | Last 7 **eligible** runs (exclude runs that never reached Step 2) | **ENGINE_ARCHITECTURE_V1** §5 |
| `family_window_tally` | `numeric` | Server-only; rolling accumulation within the detection window for threshold evaluation | **PATTERN_ACTION_MODEL_V1.md** §2 (threshold semantics) |
| `last_trigger_at` | `timestamptz` | Per family | **PATTERN_ACTION_MODEL_V1.md** §2 |
| `updated_at` | `timestamptz` | NOT NULL | **impl-only** |

### `action_contracts`

All **10 fields** from `PATTERN_ACTION_MODEL_V1.md` §4 (names below are logical; physical column names may snake_case).

| Logical field (§4) | Type | Constraints | Spec source |
|--------------------|------|-------------|-------------|
| *(all ten §4 fields)* | per §4 | NOT NULL where §4 requires | **PATTERN_ACTION_MODEL_V1.md** §4 |
| `status` | `enum` | `pending`, `submitted`, `approved`, `rejected`, `escalated` | **PATTERN_ACTION_MODEL_V1.md** §4 |
| `verified_at` | `timestamptz` | NULL until execution verified | **ENGINE_ARCHITECTURE_V1** §5 (`complete_verified`) |
| `id` | `uuid` | PK | **impl-only** |
| `user_id` | `uuid` | NOT NULL | **impl-only** |
| `run_id` / `session_id` | `text`/`uuid` | Link to `scenario_runs` | **impl-only** linkage |

**Physical table `public.bty_action_contracts`:** migrated to `status` including `pending`, `submitted`, `approved`, `rejected`, `escalated`, `missed`; legacy `completed` is rewritten to **`approved`** with `verified_at` set. **`CHECK (status <> 'approved' OR verified_at IS NOT NULL)`** enforces §5 rule 5. Partial unique index **`(user_id, pattern_family)`** where `status in ('pending','submitted','escalated')` enforces §5 rule 4 when `pattern_family` is set.

### `level_records` (`public.arena_level_records`)

| Column | Type | Constraints | Spec source |
|--------|------|-------------|-------------|
| `user_id` | `uuid` | PK | **impl-only** |
| `current_band` | `text` or `smallint` | NOT NULL | Level band spec (Stage/Level doc; if unnamed, **ENGINE_ARCHITECTURE_V1** §5) |
| `consecutive_verified_completions` | `smallint` | NOT NULL, default 0 | **ENGINE_ARCHITECTURE_V1** §5 |
| `abandon_count_window` | `smallint` | Rolling window for 2-in-5 rule | **ENGINE_ARCHITECTURE_V1** §5 |
| `consecutive_abandons` | `smallint` | At current band | **ENGINE_ARCHITECTURE_V1** §5 |
| `last_evaluation_at` | `timestamptz` | NOT NULL | **impl-only** |
| `cooldown_until` | `timestamptz` | After any band change | **ENGINE_ARCHITECTURE_V1** §5 (**72 hours** committed) |

### `qr_tokens`

| Column | Type | Constraints | Spec source |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK | **impl-only** |
| `contract_id` | `uuid` | NOT NULL, FK → `action_contracts` | **impl-only** |
| `token_value` | `text` | UNIQUE, opaque | **impl-only** encoding |
| `payload_raw_text` | `text` | **Byte-for-byte** user verbatim from contract | **ENGINE_ARCHITECTURE_V1** §5 (no summarization/truncation) |
| `issued_at` | `timestamptz` | NOT NULL | **impl-only** |
| `verification_received_at` | `timestamptz` | NULL until gate records verification receipt | Execution Gate + **ENGINE_ARCHITECTURE_V1** §5 |

---

## Section 3 — State Machine

### A. Scenario run (`completion_state`)

States **must** be exactly: `in_progress`, `locked_step7_abandoned`, `complete_verified`.

| Transition | Trigger | Next state | Responsible service |
|------------|---------|------------|---------------------|
| *(start)* | `POST /api/arena/run/start` success | `in_progress` | Scenario Service |
| `in_progress` | Step advances through Steps 1–4 per policy | `in_progress` | Scenario Service + Pattern Engine |
| `in_progress` | Step 5 **Continue** (user activation) sets `acknowledgment_timestamp` | `in_progress` | Scenario Service |
| `in_progress` | User abandons at Step 7 without verification (per policy) | `locked_step7_abandoned` | Scenario Service |
| `in_progress` | Contract reaches **`complete_verified`** (§5) | `complete_verified` | Action Contract Service + Execution Gate Service |
| `locked_step7_abandoned` | *(no transition to deleted)* — row persists forever | `locked_step7_abandoned` | — |
| `complete_verified` | Terminal for that run | `complete_verified` | — |

### B. Action contract (`status` per `PATTERN_ACTION_MODEL_V1.md` §4)

| Transition | Trigger | Next state | Responsible service |
|------------|---------|------------|---------------------|
| *(create)* | Contract created after trigger / Step 6 submission path | `pending` | Action Contract Service |
| `pending` | User submits contract (Layer 1 pass) | `submitted` | Action Contract Service |
| `submitted` | Validator approves | `approved` | Validator Service |
| `submitted` | Validator rejects | `rejected` | Validator Service |
| `submitted` | Validator requests revision (if modeled as status) or escalate | `escalated` or `rejected` per §4 | Validator Service |
| `approved` | QR / gate verification receipt recorded: contract `verified_at` set and `qr_tokens.verification_received_at` set | `approved` (terminal; paired with verification) | Execution Gate Service |

**Note:** `complete_verified` is a **run**-level outcome (§5), not a contract status; it requires **`approved` + `verified_at`**.

---

## Section 4 — API Contracts

**C4 consumers:** use these shapes; internal `pattern_family` values and threshold math **must not** appear in responses in a gameable form (Philosophy Lock §9 equivalent).

### `POST /api/arena/run/start`

- **Request:** `{ "scenario_id"?: string, "locale"?: "en"|"ko" }` (optional pre-bind; else server selects)
- **Response:** `{ "run_id": string, "scenario": ScenarioPayload, "step": 1 }`
- **Errors:** `401`, `403` (ejection), `409` (prior contract blocks — align with session gate), `503` catalog
- **Service:** Scenario Service
- **Document:** `LEADERSHIP_ENGINE_SPEC.md` + scenario catalog Stage spec
- **Gaming flag:** Scenario payload must not include internal pattern family IDs.

### `POST /api/arena/run/step`

- **Request:** `{ "run_id": string, "step": number, "step_payload": object }` (choice, free text, structured step fields, etc.)
- **Response:** `{ "run_id", "step", "completion_state", "mirror?": MirrorDTO }`
- **Errors:** `400` validation, `409` illegal transition, `404` run
- **Service:** Scenario Service (orchestrates Pattern Engine on steps 2–4)
- **Document:** `PATTERN_ACTION_MODEL_V1.md` §2, §4; §3 state machine
- **Gaming flag:** If `mirror` includes family keys or raw counts exploitable for steering, **must** return **narrative mirror only** (Philosophy Lock).

### `GET /api/arena/run/:id/mirror`

- **Request:** path `id` = run_id
- **Response:** `{ "lines": string[], "attribution": "aggregated" }` — derived from **`pattern_signals` across prior runs**, not recomputed ad hoc at read time (§5)
- **Errors:** `404`, `401`
- **Service:** Scenario Service (read model over Pattern Engine storage)
- **Document:** `LEADERSHIP_ENGINE_SPEC.md` (Mirror), §5 mirror sourcing rule
- **Gaming flag:** **YES if** response exposes canonical family IDs, numeric thresholds, or per-family tallies tied to scoring. **Mitigation:** human-readable copy only.

### `POST /api/arena/run/:id/contract`

- **Request:** ten §4 fields (JSON), plus `run_id` consistency
- **Response:** `{ "contract_id": string, "status": "pending"|"submitted" }`
- **Errors:** `400` Layer 1 validation, `409` re-trigger block (§5)
- **Service:** Action Contract Service
- **Document:** `PATTERN_ACTION_MODEL_V1.md` §4

### `GET /api/arena/run/:id/gate`

- **Response:** `{ "lock_state": "locked"|"unlocked", "qr_url"?: string, "expires_at"?: string }`
- **Errors:** `404`, `401`
- **Service:** Execution Gate Service
- **Document:** `PATTERN_ACTION_MODEL_V1.md` §4, §5 QR rules
- **Gaming flag:** **YES if** token or URL decodes to internal scoring; QR must verify **verbatim text** only.

### `POST /api/arena/contract/:id/verify`

- **Request:** `{ "receipt": string }` (or signed payload per gate design)
- **Response:** `{ "contract_id", "verified_at", "run_completion_state": "complete_verified" }` when eligible
- **Errors:** `400`, `409` (contract not approved), `404`
- **Service:** Execution Gate Service + Action Contract Service
- **Document:** §5 `complete_verified`

### `GET /api/arena/user/:id/state`

- **Response:** `{ "band": string|number, "active_locks": [...], "pending_contracts": [...] }` — **no** pattern_family IDs
- **Service:** Level Engine + Action Contract Service
- **Document:** §5 level rules + §4 contract status
- **Gaming flag:** **YES if** exposes internal families or evaluation internals; strip to user-safe summaries.

---

## Section 5 — Critical Implementation Rules

Hard rules (locked / committed in this doc):

1. **`explanation_substitution`** is the **only** canonical family id for the former “explanation” concept — **no** legacy `explanation` alias in DB columns, enums, or public API.
2. **Per-run signal cap:** at most **one** `pattern_signals` row per `pattern_family` per run, **Steps 2–4 only**.
3. **Detection window:** last **7** runs, **excluding** runs that **never reached Step 2**; per-user per-family accumulation for threshold evaluation uses **`pattern_states.family_window_tally`** (and `window_run_ids`) within that window.
4. **Re-trigger prevention:** no **new** contract for family **F** until the prior F contract is **`complete_verified`**.
5. **`complete_verified`:** requires **`verified_at IS NOT NULL` AND `status = approved`** on the governing contract — **neither alone suffices**.
6. **Level increase:** requires **N = 3** consecutive **`complete_verified`** completions **at the current band** (`level_records.consecutive_verified_completions` reaches 3 under that band); the count is broken by **`locked_step7_abandoned`** or any **`in_progress`** run left unresolved per policy (reset `consecutive_verified_completions` per Level Engine rules).
7. **Level decrease:** fires on **2-in-5** abandons **OR** **2 consecutive** abandons at the current band — **whichever occurs first**.
8. **Anti-thrash cooldown:** after **any** level change (up or down), the Level Engine **must not** run another band evaluation until **`cooldown_until = last_change_at + 72 hours`** (committed number: **72 hours**).
9. **`acknowledgment_timestamp`:** set only when the user activates **Continue** on Step 5; **no** dwell time, viewport, or impression proxies.
10. **QR token:** encodes **verbatim** user `raw_text` from the action contract — **no** summarization or truncation; execution receipt is recorded on the token row as **`verification_received_at`** (non-null iff gate verified).
11. **`locked_step7_abandoned`:** rows **persist** — no delete/archive to bypass the lock.
12. **`GET /run/:id/mirror`:** must **read** from stored **`pattern_signals`** (prior runs); **no** display-time-only recalculation that could drift from audit trail.

### C3 implementation map (this repo)

| Rule / area | Code / migration |
| --- | --- |
| §5 (1) `explanation` → `explanation_substitution` | `src/domain/pattern-family.ts`; DB `CHECK` on `pattern_signals` / `pattern_states`; `recordPatternSignal` normalizes on insert |
| §5 (2) Per-run signal cap | `supabase/migrations/20260431240000_engine_pattern_state_machine.sql` — partial unique index; `recordPatternSignal` |
| §5 (3) Window + `family_window_tally` | `src/lib/bty/pattern-engine/syncPatternStates.ts`; `reached_step_2_at` on `arena_runs` via `POST /api/arena/event` |
| §5 (4) Re-trigger prevention | Partial unique index + `ensureActionContractWithAdmin` pre-check when `patternFamily` is passed |
| §5 (5) `approved` + `verified_at` | DB `CHECK`; `POST .../qr/validate` sets both; `completion_state = complete_verified` on `arena_runs` |
| §5 (6–8) Level consecutive + 72h cooldown | `src/lib/bty/level-engine/arenaLevelRecords.ts` (`onArenaRunCompleteVerified`, `resetConsecutiveVerifiedCompletions`); **decrease / abandon windows** not yet wired |
| Pattern signal intake | Optional JSON body `pattern_signal: { pattern_family, direction }` on `POST /api/arena/event` (steps 2–4) |

---

## Section 6 — Pipeline N Entrypoint Resolution (Option B — committed)

**Option B:** After cutover, **`/{locale}/bty-arena` is the permanent home of Pipeline N.** Pipeline L is **legacy only** and is not the long-term architecture.

### 6.1 — Target entrypoint

- **`/{locale}/bty-arena`** (e.g. `/en/bty-arena`) **exclusively** mounts the **Pipeline N** client shell and data path **once cutover is complete** (`ARENA_PIPELINE_DEFAULT=new` in production).
- Pipeline L remains available **only** under `ARENA_PIPELINE_DEFAULT=legacy` (pre-cutover or rollback).

### 6.2 — Feature flag: `ARENA_PIPELINE_DEFAULT`

| Property | Committed value |
|----------|-----------------|
| **Name** | `ARENA_PIPELINE_DEFAULT` (environment variable, server-side) |
| **Permitted values** | `legacy` → Pipeline L \| `new` → Pipeline N |
| **Production default after cutover** | `new` |
| **Where read** | **`middleware.ts`** first (request classification for Arena routes), echoed or enforced by **Pipeline N API routes** (`POST /api/arena/run/start`, `POST /api/arena/run/step`, etc.) so the client cannot bypass L vs N by skipping middleware. The **`/[locale]/bty-arena` page** may read the same resolved value via **server component props or a small internal config endpoint** so the correct root client bundle mounts. |
| **When absent / unset** | **Fail-safe default = `legacy`**. Missing or invalid value MUST be treated as Pipeline L until operations explicitly sets `new`. This avoids partially deploying N handlers without intent. |
| **Scope** | **Global** per deployment environment (one value per runtime), **not** per-user. Per-user pipeline is carried only by **run row** `pipeline` / `engine_version` for in-flight L runs (§6.4). |

### 6.3 — Routing logic under Pipeline N (`ARENA_PIPELINE_DEFAULT=new`)

When the flag resolves to **`new`**, a request to **`/{locale}/bty-arena`** MUST:

1. **Pending contract gate** — Query `bty_action_contracts` for `user_id` where `status IN ('pending', 'submitted', 'escalated')` **and** any deadline / open-state rule in §4 still applies (rows that block new play).
2. **If such a row exists** — **Redirect (307)** the user to **My Page: `/{locale}/bty` (protected dashboard)** with query **`arena_contract=resolve`** so the existing My Page / hub surface owns contract resolution. **No separate anonymous “contract screen” is required** for Option B; a dedicated route may be added later but **My Page is the committed resolution entry**.
3. **If no blocking contract** — Load **Pipeline N** UI and **initiate or resume** via **`POST /api/arena/run/start`** and **`POST /api/arena/run/step`** only (Pattern Engine active on applicable steps), then **`POST` run completion** and contract trigger paths per §4 when thresholds fire — **not** the legacy session router.
4. **Hard rule:** Under `ARENA_PIPELINE_DEFAULT=new`, the client and server **MUST NOT** call **`GET /api/arena/session/next`** for scenario acquisition or progression. That endpoint is Pipeline L only (§6.6).

### 6.4 — Migration path for active Pipeline L runs at cutover

| Situation | Committed handling |
|-----------|-------------------|
| **`completion_state = in_progress`** on a run **created under Pipeline L** (run row marked `pipeline=legacy` or equivalent) | **Complete under L:** the user **finishes that run** using **L APIs and L client branch** until terminal `completion_state`. **No mid-run state migration** into N step indices. New **N** runs start only after that run reaches a terminal state or is administratively closed per ops policy. |
| **`completion_state = locked_step7_abandoned`** under Pipeline L | **Persist forever; no silent delete or archive.** User must see lock / resolution path on **My Page** (`arena_contract=resolve` or equivalent). **Philosophy Lock §4 (no-action-no-progression):** progression and new N runs remain blocked until the lock is resolved or **administratively acknowledged** (audited row); acknowledgment does not delete the abandoned run record. |
| **New runs after cutover** | **Always Pipeline N** (`pipeline=new` on new `scenario_runs`), regardless of prior L history, **subject to** contract gates and abandoned-lock rules above. |

### 6.5 — Cutover condition (binary)

Production switches **`ARENA_PIPELINE_DEFAULT` to `new`** only when **both** are true:

1. **`locked_step7_abandoned` backlog clear:** `COUNT(*)` of Pipeline L runs with `completion_state = locked_step7_abandoned` that **lack** an **`administratively_acknowledged_at`** (or equivalent audited flag) **= 0**.
2. **Smoke test pass:** A **designated test account** completes **one full Pipeline N path** on the **staging** environment (run/start → steps → complete → contract/verify as applicable) with **zero 5xx** on N endpoints.

If either condition is false, **`ARENA_PIPELINE_DEFAULT` remains `legacy`**.

### 6.6 — `GET /api/arena/session/next` deprecation (Pipeline L)

| Topic | Committed rule |
|-------|----------------|
| **Status** | **Deprecated.** Pipeline L entrypoint only. |
| **After cutover (`ARENA_PIPELINE_DEFAULT=new`)** | Endpoint **remains callable** for a **bounded migration period** (max **90 days** post-cutover) so old clients and scripts fail loudly. |
| **Response when called under `new`** | **`410 Gone`** with body `{ "error": "arena_session_next_deprecated", "message": "Use Pipeline N run/start and run/step APIs." }` — **recommended and committed** (alternatively **409** with the same JSON is acceptable only if edge proxies block 410; default spec is **410**). |
| **Full removal** | **Day 91** after production cutover to `new`, or when analytics show **zero** calls for **30 consecutive days**, **whichever is later**; then route returns **410** permanently until removed, then **404** after route delete. |

### 6.7 — Implementation reference (C3)

| Item | Location |
| --- | --- |
| `ARENA_PIPELINE_DEFAULT` fail-safe (`legacy`) | `src/lib/bty/arena/arenaPipelineConfig.ts` — `getArenaPipelineDefault()` |
| Pipeline N My Page redirect (307, `arena_contract=resolve`) | `src/middleware.ts` → `/{locale}/bty?arena_contract=resolve`; `src/app/[locale]/bty/(protected)/page.tsx` **server-redirects** to `/{locale}/my-page?arena_contract=resolve`; `MyPageLeadershipConsole` scrolls to `#bty-action-contract-hub` |
| Blocking contract query (submitted / escalated / pending+deadline) | `src/lib/bty/arena/blockingArenaActionContract.ts`, `src/lib/bty/arena/arenaSessionNextCore.ts` |
| Pipeline N session router (replaces client calls to `session/next`) | `GET /api/arena/n/session` — `src/app/api/arena/n/session/route.ts` |
| `session/next` **410** under `new` | `src/app/api/arena/session/next/route.ts` |
| Arena shell uses N router when `new` | `src/app/[locale]/bty-arena/page.tsx` passes `getArenaPipelineDefault()` → `useArenaSession` |
| Optional client mirror for embedded shells | `NEXT_PUBLIC_ARENA_PIPELINE_DEFAULT` — `ScenarioSessionShell` uses `getArenaPipelineDefaultForClient()` |
| Pattern engine + state machine (§2–§5) | `supabase/migrations/20260431240000_engine_pattern_state_machine.sql`; `src/lib/bty/pattern-engine/*`; `src/lib/bty/level-engine/arenaLevelRecords.ts`; `POST /api/arena/event` |

**Cutover governance:** binary conditions in §6.5 — see `docs/ARENA_PIPELINE_CUTOVER.md`.

---

**End of ENGINE_ARCHITECTURE_V1.md**
