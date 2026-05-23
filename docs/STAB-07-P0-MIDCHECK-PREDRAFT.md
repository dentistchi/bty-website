# STAB-07-P0 Mid-check — D-3/D-2 Light Health Verification Pre-draft (v1)

Pre-drafted at D-9 (2026-05-22) for execution at D-3 (2026-05-27, primary)
or D-2 (2026-05-28, fallback). Read-only early-warning, no mutation.
Companion gate dispatch: STAB-07-P0-STAGE8-PREDRAFT.md.

```text
═══════════════════════════════════════════════════
STAB-07-P0 Mid-check v1 — D-3/D-2 light health verification (PRE-DRAFT)
═══════════════════════════════════════════════════
[AUTHORED at D-9 by Stage-8-author, Commander-reviewed, approved for persistence.]
[Not pre-existing verbatim. Memory #28 (discipline_verbatim_reference_provenance) honored.]

Status: PRE-DRAFT (작성 D-9 2026-05-22, 실행 D-3 2026-05-27 or D-2 2026-05-28)
Executor: VSCode Claude Code only.

Mode: READ-ONLY ONLY. No mutation. No deploy. No DB writes. No commits.

Purpose:
  Light early-warning verification during freeze period. Detect drift/surprise
  before D-1 Stage 8 fires. Subset of Stage 8 V's: M1 (worker serving version)
  + M2 (baseline tests) + M3 (escalated bounds, lighter threshold) + M4 (anchor).
  V2 (full emission table), V3 (Scope C manual), and RELEASE_LOG mutation
  are deferred to Stage 8.

Scheduling:
  Primary execution: D-3 (2026-05-27)
  Fallback: D-2 (2026-05-28) if D-3 unavailable
  Reason: surprise buffer before D-1 Stage 8.

Baseline expected:
  Inner:  35013b74
  Outer:  d5fe01c2 (or later read-only-only commits)
  Worker (serving): 6528ecf2 (per spec v3 deployments-list authority)
  Tests:  3314 / 0 / 6
  Anchor: a27781f5

------------------------------------------------------------
M1 — Worker serving-version integrity
------------------------------------------------------------

Aligned with Stage 8 v3 V1 authority (deployments-list, not versions-list).
Detects covert upload-without-deploy.

  npx wrangler deployments list --name bty-arena-staging --json \
    | jq 'sort_by(.created_on) | last
          | {window: .created_on,
             serving: (.versions | map(select(.percentage==100)) | .[0].version_id),
             split: (.versions | length)}'

PASS:
  - serving == 6528ecf2 OR later authorized
  - split == 1 (no traffic split)
  - 5a544379 still in versions list (rollback target)
  - a27781f5 still in versions list (canonical anchor)

FAIL: any deviation.

If FAIL → escalate to Commander immediately, do NOT wait for Stage 8.

------------------------------------------------------------
M2 — Baseline test integrity
------------------------------------------------------------

  cd bty-app
  npm run test -- --run
  npx tsc --noEmit
  cd ..

PASS: count == 3314, 0 fails, tsc clean.
FAIL: any deviation.

If FAIL → investigate immediately. Could indicate silent dep drift,
dependabot/library update, or env change.

------------------------------------------------------------
M3 — Escalated residue early bounds (lighter than Stage 8 V4)
------------------------------------------------------------

  SELECT count(*) AS total FROM bty_action_contracts WHERE status='escalated';

  SELECT count(*) AS lt24h FROM bty_action_contracts
    WHERE status='escalated' AND created_at >= now() - interval '24 hours';

PASS: total ≤ 3, lt24h ≤ 2.
WATCH: total 4-5.
FAIL: total > 5, OR lt24h > total × 0.5.

M3 intentionally uses simpler absolute thresholds than Stage 8 V4.
It is an early-warning detector, not a launch gate.
Stage 8 V4 remains the authoritative escalation-health gate.

------------------------------------------------------------
M4 — Anchor lineage sanity
------------------------------------------------------------

  git log --all --oneline | grep -q 'canonical anchor a27781f5'

PASS: exit 0.
FAIL: anchor lineage rewritten — critical, halt immediately.

------------------------------------------------------------
Output format
------------------------------------------------------------

Single short report:
  M1: PASS / FAIL / serving version
  M2: PASS / FAIL / count
  M3: PASS / WATCH / FAIL / counts
  M4: PASS / FAIL

  Overall:
    GREEN — proceed to D-1 Stage 8 as scheduled
    WATCH — Commander review, no immediate action
    RED   — immediate investigation required before Stage 8

No mutation made. No commit. No push. Reports only.

═══════════════════════════════════════════════════
END MID-CHECK v1 PRE-DRAFT
═══════════════════════════════════════════════════
```
