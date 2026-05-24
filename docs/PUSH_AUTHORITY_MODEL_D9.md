# Push Authority Model — D-9 Push Posture Governance

**Class**: release governance, time-anchored
**Authority status**: Commander-reviewed verbatim record
**Scope**: outer repo `origin/main` advance only (Worker deploy is separate authority)
**Lane open**: 2026-05-24 (post Q-GEN STEP 0 closure)
**Mutation budget at draft**: 0

---

## 0. Model premise

Push authority in the D-9 freeze window is not a binary decision. It is
governed by a time-anchored gate model in which:

- authority does not emerge from working-tree state alone
- authority does not emerge from CI green alone
- authority emerges only at named time anchors where a defined gate is
  satisfied and a defined consequence chain is acceptable

`git push origin main` in this repo is established as repository-side
production-effective: it does not deploy, but it triggers CI workflows
that exercise shared Supabase via fixture seed/clean. Push is therefore
governed as a production-touching event.

**D-N labeling note**: prior lane records have used "D-9" as the
shorthand for "approximately 9 days before launch" loosely from
2026-05-22 onward. This model uses calendar-strict D-N counted from
D-0 = 2026-05-30. Today's strict D-N = D-6 (2026-05-24).

---

## 1. Definitions (ambiguity resolution: A1, A2, A5)

### 1.1 "Read-only-only commits" (A1)

The Stage 8 predraft and Mid-check predraft both permit advance of
`origin/main` to "later read-only-only commits" beyond their recorded
baseline `d5fe01c2`. A commit qualifies as **read-only-only** if and
only if it satisfies all of the following:

- touches no file under `bty-app/src/**`
- touches no file under `bty-app/supabase/migrations/**`
- touches no Worker configuration (`bty-app/wrangler.toml`,
  `bty-app/open-next.config.*`, `bty-app/next.config.*`)
- touches no GitHub workflow file under `.github/workflows/**`
- touches no `.env*` file
- contains no Cloudflare secret rotation, no script asset replacement
  with runtime semantics

Commits that touch only `docs/**`, `bty-app/docs/**` (symlinks), or
runtime-neutral documentation are read-only-only.

Applied to the current 5 unpushed commits:

| Commit  | Class               | Reason                                  |
|---------|---------------------|-----------------------------------------|
| 2faa66d | read-only-only      | docs/ only                              |
| 6789c7d | NOT read-only-only  | bty-app/public/images/** (runtime asset)|
| fa80de1 | NOT read-only-only  | bty-app/supabase/migrations/**          |
| 500b64e | NOT read-only-only  | bty-app/supabase/migrations/**          |
| 782cb5f | read-only-only      | docs/ only; outer-only commit, no bty-app/** tracked path touched; bty-app/docs/* symlink blobs unchanged |

### 1.2 "CI fixture seed/clean" as DB mutation (A2)

The `e2e.yml` workflow, on push to main, executes Playwright against
the staging BASE_URL and seeds/cleans fixture users on the shared
Supabase project. Per the single-Supabase topology (one project backs
all Workers, DB mutations are production-effective regardless of
Worker target), this is classified for the purpose of this model as:

- **fixture-class DB write** — bounded to fixture user IDs, lifecycle-
  managed (seeded then cleaned in the same workflow run)
- **production-touching but not production-data-mutating** — does not
  alter real user data, real arena state, real ledger rows
- **acceptable during freeze** only when:
  - no live user pilot is running against staging at the same time
  - the fixture seed/clean lifecycle is bounded to its workflow run
  - the workflow has not been observed failing mid-cleanup recently

A fixture seed/clean event during D-1 / D-0 launch-eve windows is
explicitly **not acceptable**.

### 1.3 Stage 8 predraft baseline (A5)

The Stage 8 predraft and Mid-check predraft were authored at `d5fe01c2`
and immediately committed as `ed2fed3`, making the predraft baseline a
self-referential anchor (predraft references the commit prior to itself).
The predraft's own escape clause "(or later read-only-only commits)"
resolves this self-reference:

- baseline for execution is **the predraft commit itself** (`ed2fed3`)
- advance to read-only-only commits beyond `ed2fed3` is pre-authorized
  by the predraft itself
- advance to non-read-only-only commits requires Commander explicit
  authorization at the time anchor in question

No baseline reset is required; the predraft's escape clause is
operative.

---

## 2. Time anchors

| Anchor | Date         | Class                | Push authority class       |
|--------|--------------|----------------------|----------------------------|
| D-9    | 2026-05-21 (passed) | (pre-freeze)  | (pre-model scope)          |
| D-8    | 2026-05-22 (passed) | freeze entry  | read-only-only only        |
| D-7    | 2026-05-23 (passed) | freeze mid    | read-only-only only        |
| D-6    | 2026-05-24 (TODAY)  | freeze mid    | read-only-only only        |
| D-5    | 2026-05-25   | freeze mid           | read-only-only only        |
| D-4    | 2026-05-26   | freeze mid           | read-only-only only        |
| D-3    | 2026-05-27   | mid-check gate       | conditional (see §3.2)     |
| D-2    | 2026-05-28   | mid-check fallback   | conditional (see §3.2)     |
| D-1    | 2026-05-29   | Stage 8 gate         | **freeze hard** (see §3.3) |
| D-0    | 2026-05-30   | launch day           | **freeze hard** (see §3.3) |
| D+1    | 2026-05-31   | post-launch          | gate opens (see §3.4)      |

---

## 3. Authority gates per anchor

### 3.1 D-8 through D-4 — read-only-only push authority

**Authority class**: pre-authorized by Stage 8 predraft escape clause
**Permitted scope**: push of `origin/main` advance where every commit
in the advance is read-only-only per §1.1

**Gate conditions** (all must be satisfied):

- working tree clean
- baseline CI green (vitest pass, tsc clean) — confirmed at HEAD
- every commit in `origin/main..HEAD` is read-only-only per §1.1
- no non-read-only-only commit is interleaved between read-only-only
  commits (no skip-push)
- consequence chain: a push consisting solely of read-only-only
  commits triggers ZERO workflows. All push-triggered workflows
  (e2e, qa-integrity-gates, terminology-lint, archetype-isolation)
  are path-filtered to bty-app/** or narrower; auto-merge and
  arena-release-gate are not push-triggered. Read-only-only commits
  per §1.1 touch none of these path filters, including the
  terminology-lint self-path (.github/workflows/**) which §1.1
  itself excludes.

**If gate satisfied**: push authorized.
**If gate not satisfied**: continue hold; the non-read-only-only commits
must wait for a higher-class anchor.

Applied to current state (D-6, 2026-05-24, local HEAD at the
governance-record commit produced by this lane):

The unpushed commits include 3 non-read-only-only commits (`6789c7d`,
`fa80de1`, `500b64e`). A simple `git push origin main` does NOT satisfy
this gate because read-only-only commits cannot be advanced without
also advancing the non-read-only-only commits interleaved between them.

Linear history does not permit selective fast-forward.

### 3.2 D-3 / D-2 — mid-check gate authority

**Authority class**: pre-authorized by Mid-check predraft execution
**Mode**: READ-ONLY ONLY (per Mid-check predraft L17, L117)
**Push permitted**: NONE during mid-check execution itself

**Gate conditions for push outside mid-check execution window**:

- Mid-check predraft executed read-only at D-3 or D-2
- Mid-check report returned NO blocking findings
- Commander authorizes a same-day push window
- Commit class still gated by §1.1 (read-only-only) unless Commander
  explicit override on a non-read-only-only commit

**Special class for D-3 / D-2**: a single Commander-authorized
non-read-only-only push window may open if and only if:

- the push is required to remediate a Mid-check finding
- the change has its own Commander-reviewed lane (not piggy-backed)
- CI green at the new HEAD before push
- rollback anchors `5a544379` and `a27781f5` confirmed still
  rollback-targetable

### 3.3 D-1 / D-0 — Stage 8 gate / launch day, freeze hard

**Authority class**: Stage 8 predraft execution
**Push authority**: **FROZEN HARD**

No push of any class, including read-only-only, during D-1 and D-0.
Reason: Stage 8 gate execution is the launch-eve verification window;
fixture seed/clean events on shared Supabase during this window risk
interfering with launch-eve validation runs and 20-user pilot
preparation.

**Sole permitted exception**: rollback. A `wrangler rollback` to anchor
`5a544379` or `a27781f5` is permitted without git push and without
gate satisfaction, on Commander explicit authorization in response to
a Stage 8 blocking finding.

### 3.4 D+1 onward — post-launch

**Authority class**: post-launch governance lane (not defined in this
model)

Push authority for the held non-read-only-only commits (`6789c7d`,
`fa80de1`, `500b64e`) and any subsequent commits resumes under a
post-launch governance model that is out of scope here. This model
covers only the D-8 → D-0 freeze window.

---

## 4. Hold continuation logic

The current ahead state continues to hold under this model until one
of the following authority-emission events occurs:

| Event                                                            | Authority class                |
|------------------------------------------------------------------|--------------------------------|
| Commit history is reshaped such that only read-only-only commits | §3.1 gate satisfaction         |
| are in `origin/main..HEAD` (e.g., the 3 non-read-only-only       |                                |
| commits land via a different path or are temporarily removed —   |                                |
| this model does not prescribe a method)                          |                                |
| Mid-check executed clean at D-3 / D-2, Commander opens window    | §3.2 conditional               |
| D+1 post-launch governance opens                                 | §3.4 post-launch lane          |
| Commander explicit override on a specific commit set, at any     | Commander-authorized exception |
| anchor outside D-1 / D-0                                         |                                |

In every other case, hold continues.

**Hold does not require active re-affirmation**. The default state
inside the D-8 → D-0 freeze window is hold. Authority is the named
event, not the absence of one.

---

## 5. Stage 8 predraft baseline interaction (A5 closure)

This model treats the Stage 8 predraft baseline `d5fe01c2` as
historically informative, not currently binding. The operative
baseline for Stage 8 execution at D-1 is the state of `origin/main`
at execution time, which may have advanced to read-only-only commits
per §3.1.

No predraft re-baselining is required.

---

## 6. Unresolved forensic dependencies

The following Stage A surfaces are noted as **unresolved forensic
dependencies** and are explicitly out of scope of this push authority
model:

### 6.1 Migration applied-state (A3)

`fa80de1` and `500b64e` contain Supabase migration files that have not
been applied via any CI workflow (no workflow applies migrations on
push). Whether these migrations have been applied to the shared
Supabase project via manual `db push` is not determined by this model
and does not affect push authority under §3.1.

→ Separate forensic lane candidate: "Unpushed migration applied-state
verification."

### §6.1 Resolution — Migration Applied-State Forensic (D-6, 2026-05-24)

Stage A read-only forensic (mutation 0) on `fa80de1` + `500b64e`:

| Migration | file in `migrations/` | unpushed commit | on `origin/main` | DB applied |
|---|---|---|---|---|
| `20260524000000_l15b_audit_columns_isolate.sql` (fa80de1) | YES | YES | NO | **YES** |
| `20260524000001_l15c_escalations_user_id.sql` (500b64e) | YES | YES | NO | **YES** |

**Tracking table queried**: `supabase_migrations.schema_migrations` (remote, project `mveycersmqfiuddslnrj`) via `supabase migration list`. Query succeeded; both versions recorded applied (2026-05-24 00:00:00 / 00:00:01).

**Determination**: DB applied-state is ahead of `origin/main` for both migrations. Pattern is consistent with file-header self-declaration ("Apply path: Commander SQL Editor (out-of-band) … history marked via `supabase migration repair --status applied`"). No unknown drift, no silent failure, no partial apply.

**Outstanding state (not a defect)**: DB-ahead-of-git asymmetry persists until push gate satisfied. Single-developer / single-Supabase environment → no immediate risk. Push auto-resolves the asymmetry.

**Out-of-scope surface (deferred)**: File headers reference `escalated_at / resolution` orphan columns ("out-of-band history drift") and "F2 (L1.6) reclassified to MVP product policy question". Both align with Memory #20 lever α/β/γ HOLD (post-launch governance cycle). Not part of §6.1 closure.

**§6.1 status**: **RESOLVED at forensic level**. Push of `fa80de1` + `500b64e` will close the git-side asymmetry; gate evaluation belongs to §3.1 (not §6.1).

### 6.2 Worker ↔ git correspondence (A4)

The active Worker version `b159f11f` carries no git-commit metadata
and cannot be forensically mapped to a specific commit in
`origin/main..HEAD` or before `origin/main`. This does not affect
push authority under §3.1 because push authority is governed by
commit class, not by Worker correspondence.

→ Separate forensic lane candidate: "Worker version ↔ git commit
forensic mapping."

### 6.3 TII weekly cron failure lineage

All 3 scheduled tii-weekly-cron runs in the recent window failed
(2026-05-04, 05-11, 05-18); 4 of 5 total recent runs failed; the
lone success was a manual workflow_dispatch on 2026-05-18. This is
a production-effective system failure unrelated to push posture.

→ Separate forensic lane candidate: "TII cron stability forensic."

---

## 7. Applied verdict — current state (informational, derived from §3.1)

At local HEAD at lane open (`782cb5f`), D-6 anchor:

- §3.1 gate evaluates as **NOT SATISFIED** because the 5-commit advance
  includes 3 non-read-only-only commits
- Hold continues per §4
- No anchor between D-6 and D-0 emits push authority for the current
  commit set without a higher-class event

This verdict is a derivation from the model, not the model's primary
output. The model's primary output is the gate definitions, time
anchors, and ambiguity resolutions. Any future change in commit
shape, time anchor, or Commander authorization re-evaluates against
the same model without amendment.

---

## 8. Model status

- Authored at: D-6 (2026-05-24)
- Lifetime: D-8 → D-0 freeze window only
- Post-launch authority: not provided; a separate model is required
  for D+1 onward
- Amendment policy: requires Commander-authorized governance lane;
  ambiguity-resolution sections (§1.1 / §1.2 / §1.3) are part of the
  model contract and cannot be modified by interpretation

---

## Document provenance

- **Author**: C3 (Claude, this chat), 2026-05-24
- **Authority**: Commander-reviewed verbatim record
- **Substrate**:
  - Stage A inventory return (this lane, 2026-05-24)
  - Q-GEN STEP 0 closure (`docs/Q-GEN_STEP_0_CLOSURE.md`, commit `782cb5f`)
  - Stage 8 predraft (`docs/STAB-07-P0-STAGE8-PREDRAFT.md`)
  - Mid-check predraft (`docs/STAB-07-P0-MIDCHECK-PREDRAFT.md`)
- **Mutation budget at draft**: 0
- **Verbatim status**: LOCKED 2026-05-24, Stage B v2
