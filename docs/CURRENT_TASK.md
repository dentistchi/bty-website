# Active application task contract

## FROZEN-REVIEWER-REPLAY-CLOSURE — completed evidence handoff

This is the active application task contract for the inner repository. The integration branch is `inner-main`; outer documentation remains historical/reference material only.

- Official code authority: `cb6df0ca49d4e752370d1005b5b5eb7bff5d110f` (`origin/inner-main`, verified 2026-09-18).
- Replay implementation lineage: `728d7ae4b5c126f5ab4479e7041f6fc9eafd99db`; the replay script, focused test, and scenario-generation service are byte-equivalent between that commit and the official authority.
- Worktree: `/Users/hanbit/Dev/worktrees/bty-arena-replay-handoff`.
- Working branch: `codex/frozen-reviewer-replay-closure`.
- Objective: close the already-completed Run-4 and Run-5 frozen reviewer replay using retained evidence only. No application behavior changes are authorized.
- Evidence archive: `/Users/hanbit/Dev/project-evidence/bty-arena/reviewer-replay-01/`; raw runtime evidence is deliberately outside Git. See `docs/FROZEN_REVIEWER_REPLAY_CLOSURE.md` for hashes, analysis, and limits.
- Delivery: documentation-only PR to `inner-main`; merge is not authorized.

## Scope and acceptance

- Preserve the legacy evidence checkout read-only; neither frozen subject may be replayed because both were already consumed.
- Record verified artifact identity, completion state, reviewer findings, fixed human-ground-truth comparison, claim-visibility limitation, CFOBS retention state, and zero-generation/zero-accounting evidence.
- Stage only reviewed documentation files. Do not update the outer repository, call providers or reviewers, generate scenarios, deploy, migrate, write production data, or access Supabase, Teams, Entra, or Cloudflare.

Status: closure evidence recovered and analyzed; this branch records the reviewable closure. The next product decision is whether the reviewer behavior documented in the closure warrants a separately authorized product change.
