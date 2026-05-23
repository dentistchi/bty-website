# STAB-07-P0 Stage 8 — Launch-eve Verification Gate Pre-draft (v3 LOCKED)

Pre-drafted at D-9 (2026-05-22) for execution at D-1 (2026-05-29) or D-0
(2026-05-30). Spec v3 LOCKED post-D-9-dry-run.

v2 → v3 changes:
- V1: deployments-list serving-version authority (not versions-list top)
- V2: deploy-window timestamp from deployments .created_on; /api/version
  explicitly rejected (returns stale BTY_BUILD_TIME wrangler.toml var)
- V4: rate-based 3-layer detection (small-sample guard + rate + cron hard-gate);
  replaces distinct_user thresholds (which would re-trigger PII classifier)
- Companion mid-check: STAB-07-P0-MIDCHECK-PREDRAFT.md

Dispatch boundary: Stage 8.0 → V1 → V2 → V3 → V4 → V5 → Verdict →
Stage 8.G (Commander confirmation gate) → Stage 8.M (RELEASE_LOG mutation).

```text
============================================================
STAB-07-P0 Stage 8 v3 — Launch-eve verification gate (PRE-DRAFT)
============================================================

Status: PRE-DRAFT (작성 D-9 2026-05-22, 실행 D-1 2026-05-29 or D-0 2026-05-30)
Executor: VSCode Claude Code only.

[v3 변경점, v2 대비]
  - V1: "serving vs uploaded" 구분 강제 (deployments list 권위)
  - V2: deploy-window timestamp = deployments list .created_on (PRIMARY)
        + versions list cross-check + /api/version 명시 거부
  - V4: rate-based 측정 (γ proposal) — PII-free, 20-user staging false-positive 제거
  - 나머지 항목 (V3, V5, 8.0, 8.G, 8.M, Rollback) v2 그대로

Mode: READ-ONLY VERIFICATION (V1-V5) + LIMITED MUTATION (Stage 8.M)
      with explicit Commander confirmation gate (8.G) between them.

Baseline expected at entry:
  Inner:  35013b74 on inner-main (local)
  Outer:  d5fe01c2 on origin/main (or later read-only-only commits)
  Worker (staging): 6528ecf2-f0e0-4a8c-8996-f2b58bcd4b45 (or later authorized)
  Tests:  3314 / 0 / 6
  Anchor: a27781f5 (Cloudflare staging worker version UUID, untouchable)

Original Stage 5 deploy reference (for cross-check only):
  Worker 6528ecf2 uploaded ~2026-05-23T01:28:35Z, began serving ~2026-05-23T01:28:38Z

[/api/version 거부 사유, 메모리에 박을 lesson]
  /api/version returns BTY_BUILD_TIME, a hardcoded wrangler.toml var
  (currently 2026-04-27T18:21:00Z, stale). NOT the real deploy timestamp.
  Same family of trap as memory #3 (.env.local bundle-inlining).
  EXPLICITLY REJECTED as source for deploy-window derivation.

------------------------------------------------------------
Rollback authority clause (v2 그대로, binding throughout)
------------------------------------------------------------

Claude Code may:
  - prepare rollback commands
  - dry-run verification
  - compare target versions (5a544379 immediate / a27781f5 anchor)
  - validate rollback feasibility (target still listed, etc.)

Claude Code may NOT (without explicit Commander authorization in chat):
  - execute rollback (wrangler rollback)
  - deploy any rollback target
  - mutate worker state
  - git-revert any commit in STAB-07-P0 chain

If any V FAILs, Claude Code reports + dry-runs rollback plan, then STOPS.

------------------------------------------------------------
Stage 8.0 — Preflight (read-only)
------------------------------------------------------------

  outer: pwd && git rev-parse HEAD
  inner: cd bty-app && git rev-parse HEAD && cd ..
  outer: git status --porcelain
  inner: cd bty-app && git status --porcelain && cd ..
  outer: git fetch origin && git status -uno
       → confirm in sync OR ahead by D-3 mid-check / read-only commits only

  Anchor lineage:
    git log --all --oneline | grep -q 'canonical anchor a27781f5'
    → must exit 0

STOP CONDITIONS (Stage 8.0):
  - working trees dirty → STOP
  - anchor lineage grep fails → STOP
  - any inner/outer drift not explainable by mid-check trail → STOP

------------------------------------------------------------
V1 — Worker version integrity (serving-vs-uploaded corrected)
------------------------------------------------------------

Single source of truth = deployments list (which version is actually serving),
NOT versions list (which version was uploaded). Covert upload-without-deploy
would otherwise show false alarm at "top of versions list."

  npx wrangler deployments list --name bty-arena-staging --json \
    | jq 'sort_by(.created_on) | last
          | {window: .created_on,
             serving: (.versions | map(select(.percentage==100)) | .[0].version_id),
             split: (.versions | length)}'

Record:
  CURRENT_SERVING_VERSION = .serving
  DEPLOY_WINDOW_START     = .window
  VERSION_SPLIT_COUNT     = .split

Cross-check (must hold):
  - VERSION_SPLIT_COUNT == 1 (no gradual rollout / split traffic)
  - serving version's percentage == 100

PASS criteria:
  - CURRENT_SERVING_VERSION == 6528ecf2 OR later authorized version
  - 5a544379 still in versions list (rollback target preserved)
  - a27781f5 still in versions list (canonical anchor preserved)
  - VERSION_SPLIT_COUNT == 1

FAIL conditions:
  - CURRENT_SERVING_VERSION reverted to 5a544379 or earlier
  - a27781f5 absent from versions list
  - VERSION_SPLIT_COUNT > 1 (split traffic — gate assumes single active version)
  - Serving version not at 100%

If V1 FAIL → report, dry-run rollback, STOP. Do NOT proceed.
If V1 PASS → continue.

Also reject as version-resolution sources (explicit prohibition):
  - /api/version endpoint (returns BTY_BUILD_TIME, stale wrangler.toml var)
  - Top of versions list (upload time, not serving time)

------------------------------------------------------------
V2 — New-contract emission verification (deployments-derived window)
------------------------------------------------------------

Deploy-window timestamp = DEPLOY_WINDOW_START from V1 (deployments list
.created_on). This is the "began serving" timestamp, NOT upload time.

Cross-check before V2 queries:
  Compare DEPLOY_WINDOW_START against versions list .metadata.created_on
  for CURRENT_SERVING_VERSION:
    npx wrangler versions list --name bty-arena-staging --json \
      | jq ".[] | select(.id==\"<CURRENT_SERVING_VERSION>\") | .metadata.created_on"

  Validation:
    upload_time = versions.metadata.created_on
    DEPLOY_WINDOW_START >= upload_time   # serving cannot precede upload
    DEPLOY_WINDOW_START - upload_time < 1 hour  # gross sanity

  If validation fails (deployment created_on < upload time, or skew > 1h):
    STOP, escalate to Commander (source disagreement is the signal).

Queries:

  SELECT verification_type, count(*)
    FROM bty_action_contracts
    WHERE created_at >= '<DEPLOY_WINDOW_START>'
    GROUP BY verification_type;

  SELECT verification_type, action_type, count(*)
    FROM bty_action_contracts
    WHERE created_at >= '<DEPLOY_WINDOW_START>'
      AND action_type IN ('json_dev_action_contract', 'arena_run_completion')
    GROUP BY verification_type, action_type
    ORDER BY action_type, verification_type;

PASS criteria:
  - For the 2 swapped action_types, ALL post-window rows have verification_type = 'qr'
  - Zero self_attest rows from these 2 action_types post-window
  - Other action_types (if any new emerged) may still have self_attest legitimately
    — flag unexpected new action_type for Commander review

FAIL conditions:
  - Any self_attest row on swapped paths post-window
  - Mixed verification_type within a single swapped action_type
    (other than pre-deploy legacy rows, filtered by created_at)

If V2 FAIL → report counts, dry-run rollback plan, STOP.
If V2 PASS → record counts, continue.

------------------------------------------------------------
V3 — Scope C live verification (Commander manual)
------------------------------------------------------------

Three possible outcomes:

  PASS-with-evidence:
    - At least one escalated contract exists since DEPLOY_WINDOW_START
    - Commander opens staging, navigates to that contract's resolve screen
    - Confirms Scope C revise UI renders:
        - Form fields (Who/What/Result) accept input
        - "Submit for validation" button present and enabled
        - Yellow band notice (escalated-revise messaging) visible
    - Commander reports: "V3 PASS-evidence"

  GREY-vacuous:
    - Zero escalated contracts since DEPLOY_WINDOW_START
    - No regression evidence available, but no positive evidence either
    - This is NOT a PASS — it's evidence absence
    - Commander acknowledgment required to continue (Claude Code halts and
      asks: "V3 GREY-vacuous: zero escalated contracts since deploy. No
      regression evidence, no positive evidence. Acknowledge and continue
      to V4, or treat as block?")
    - On Commander acknowledgment → continue
    - On Commander block → STOP

  FAIL:
    - At least one escalated contract exists AND
    - Scope C revise UI is missing from resolve screen
    - Commander reports: "V3 FAIL"
    - STOP. This is Commander hard stop #3 (Scope C regress).

------------------------------------------------------------
V4 — Residue surge detection (rate-based, PII-free, γ proposal)
------------------------------------------------------------

Replaces v2's distinct_user thresholds (which would re-trigger PII classifier
block on shared infra) with rate-based detection. Same surge-detection
intent, executable end-to-end without PII egress.

Queries (PII-free, counts only):

  -- Since-deploy qr-emission counts
  total_qr_since_deploy:
    SELECT count(*) FROM bty_action_contracts
      WHERE created_at >= '<DEPLOY_WINDOW_START>'
        AND verification_type = 'qr';

  escalated_qr_since_deploy:
    SELECT count(*) FROM bty_action_contracts
      WHERE created_at >= '<DEPLOY_WINDOW_START>'
        AND verification_type = 'qr'
        AND status = 'escalated';

  -- Standing residue guards (all-time, also PII-free)
  total_escalated:
    SELECT count(*) FROM bty_action_contracts WHERE status = 'escalated';

  escalated_gt_72h:
    SELECT count(*) FROM bty_action_contracts
      WHERE status = 'escalated'
        AND created_at < now() - interval '72 hours';

Decision logic (3-layer):

  Layer 1 — Cron hard-gate (always applied, independent of rate):
    escalated_gt_72h > 0 → FAIL (72h cron broken; escalated should auto-reset
                                  to pending within 72h)

  Layer 2 — Small-sample guard (if total_qr_since_deploy < 10):
    rate-based detection is noisy. Fall back to absolute bounds:
      total_escalated ≤ 5  → PASS
      total_escalated 6-10 → GREY (Commander judgment)
      total_escalated > 10 → FAIL

  Layer 3 — Rate-based (if total_qr_since_deploy ≥ 10):
    escalation_rate = escalated_qr_since_deploy / total_qr_since_deploy
      ≤ 0.5         → PASS
      0.5 ≤ x < 0.8 → GREY (Commander judgment)
      ≥ 0.8         → FAIL (systemic Layer 2 failure or QR misconfig)

Reporting:
  V4 outcome must include:
    - total_qr_since_deploy
    - escalated_qr_since_deploy
    - total_escalated
    - escalated_gt_72h
    - Which layer applied (1/2/3)
    - escalation_rate (if Layer 3 applied)

If V4 GREY → escalate to Commander, do NOT auto-pass.
If V4 FAIL → report counts, dry-run rollback, STOP.
If V4 PASS → continue.

Distinct-user dimension (post-launch backlog):
  γ proposal's "concentrated vs spread" signal requires a Supabase RPC
  returning a bare integer (PII classifier-clean). Not included in v3.
  Logged for post-launch consideration.

------------------------------------------------------------
V5 — Baseline test integrity
------------------------------------------------------------

  cd bty-app
  npm run test -- --run        # full vitest suite
  npx tsc --noEmit             # type check
  cd ..

PASS criteria:
  - Test count == 3314
  - 0 fails
  - tsc clean

FAIL conditions:
  - count < 3314
  - any test fail
  - tsc errors

If V5 FAIL → STOP. Silent regression detected.
If V5 PASS → continue to verdict.

------------------------------------------------------------
V1-V5 verdict
------------------------------------------------------------

  ALL PASS (no GREY) → GREEN-LIGHT CANDIDATE
                       → Commander confirmation gate (8.G)

  ANY FAIL          → STOP. Do NOT launch.
                       → report + dry-run rollback

  V3 or V4 GREY     → Commander judgment required
                       → On Commander OK → GREEN-LIGHT CANDIDATE → 8.G
                       → On Commander block → STOP

Verdict reporting format:
  V1: PASS / FAIL / value
  V2: PASS / FAIL / counts table
  V3: PASS-with-evidence / GREY-vacuous-acknowledged / FAIL
  V4: PASS / GREY-acknowledged / FAIL / counts
  V5: PASS / FAIL / test count

------------------------------------------------------------
Stage 8.G — Commander confirmation gate (NOT auto)
------------------------------------------------------------

GREEN-LIGHT CANDIDATE state requires explicit Commander confirmation in chat
before any Stage 8.M mutation.

Claude Code reports verdict, then halts and asks:
  "V1-V5 verdict received. Status: GREEN-LIGHT CANDIDATE.
   Commander, authorize Stage 8.M (RELEASE_LOG.md catch-up mutation + push)?
   This is the launch artifact mutation gate. V1-V5 PASS ≠ automatic push."

Commander must reply with explicit authorization (e.g., "Authorize Stage 8.M").
Without it, Claude Code does NOT proceed to Stage 8.M.

Without Commander authorization, dispatch ends with:
  - Verdict report (V1-V5 + overall GREEN-LIGHT CANDIDATE)
  - No RELEASE_LOG mutation
  - Repos in V5 state (clean, unchanged)
  - Standing by for Commander next action

------------------------------------------------------------
Stage 8.M — RELEASE_LOG.md catch-up (only after 8.G authorization)
------------------------------------------------------------

This resolves the F-3 deferral.

  view docs/RELEASE_LOG.md
    Learn convention (per F-3 lesson, memory #29): format, ordering,
    entry granularity, cross-reference style.

  Draft an entry covering STAB-07-P0 deployment using learned convention.
  Required facts:
    - STAB-07-P0 L1 universal-QR swap, 3 paths
    - Worker version 6528ecf2 (or current authorized)
    - Smoke verification, Scope C live
    - Baseline 3314/0/6
    - Phase 0B sheet 9e53574, Phase 0C inner baf5f210 / outer ee0edb18
    - Ledger eb5f8183, release-gate-doc d5fe01c2
    - Launch-eve gate (this dispatch): V1-V5 verdict
    - Rollback targets: 5a544379 immediate, a27781f5 anchor
    - Status: launch-ready as of <Stage 8 timestamp>

  If format ambiguity emerged in `view` step → request Commander confirmation
  on draft before commit (F-3 same-pattern conservatism).

  Apply update, outer-only single commit:
    git add docs/RELEASE_LOG.md
    git status --porcelain  # must show only this file
    git commit -m "[STAB-07-P0] release log: launch-eve gate PASS, ready for launch" \
               -m "Stage 8 V1-V5 all PASS (or GREY-acknowledged). Universal-QR Lane 1 verified at worker <VERSION>. Sibling-doc catch-up deferred from F-3 (STAB-07-P0-DOC-1) per Commander Q2 decision."

  Push:
    git push origin main

  Verify:
    git status                 # must show in sync
    record RELEASE_LOG_COMMIT hash

STOP CONDITIONS (Stage 8.M):
  - More than 1 file changed → revert, STOP
  - Inner dirty → STOP
  - Format ambiguity unresolved at Commander confirmation step → STOP
  - Push fail → STOP

------------------------------------------------------------
Final output
------------------------------------------------------------

  - Stage 8.0 preflight: PASS / details
  - V1-V5 verdict table with values
  - Overall verdict: GREEN-LIGHT CANDIDATE / GREY-acknowledged / FAIL
  - Stage 8.G outcome: Commander authorization received? Y/N
  - Stage 8.M outcome (if applicable): RELEASE_LOG_COMMIT hash
  - Worker version, baseline, escalated count at gate time (snapshot)
  - Recommendation: launch on schedule / delay / rollback-prepare

If FAIL at any V:
  - Which V, condition, value
  - Dry-run rollback plan (no execution)
  - Recommended Commander action (investigation / rollback authorization / delay)

------------------------------------------------------------
Rollback procedure (if any stage post-Stage 3 triggers STOP)
------------------------------------------------------------

Code rollback:
  cd bty-app
  git revert <INNER_L1> --no-edit
  cd ..
  git revert <OUTER_L1> --no-edit
  # Stage 7 ledger commit (if reached) may also be reverted, optional
  # (STAB-07-P0 chain: inner baf5f210 / outer ee0edb18; tests 35013b74 / 25f0af02)

Worker rollback (memory #8, #30):
  npx wrangler versions list --name bty-arena-staging
  # Roll back to either:
  #   (a) 5a544379 (immediate previous, fast — restores pre-Phase-0C state)
  #   (b) a27781f5 (canonical anchor, deep rollback — restores pre-STAB-07-P0 state)
  npx wrangler rollback <target-version> --message "STAB-07-P0 Phase 0C v2 rollback"
  # NOT git rollback for worker — anchor is worker version, not git object

Existing-row verification post-rollback:
  Re-run Stage 2D-style counts (verification_type + status distribution).
  EXPECTED: identical to pre-mutation snapshot (no existing-row drift).

Scope C preservation:
  Scope C (outer 87df6ff / inner 3e63a5da) stays. Even after L1 rollback,
  Scope C remains valuable and independent (escalated-revise UI).

Phase 0B restoration commit 9e53574:
  Stays. Governance asset, docs-only, not rolled back.

============================================================
END STAGE 8 v3 PRE-DRAFT
============================================================
```
