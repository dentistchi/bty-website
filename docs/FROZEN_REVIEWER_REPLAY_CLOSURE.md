# Frozen reviewer replay closure

## Scope and authority

This closes the one-shot frozen reviewer replay from retained evidence. Phase 2 completed in the legacy evidence checkout before this handoff. Both subjects were already consumed, so this handoff did **not** replay Run 4 or Run 5, call a reviewer or provider, generate a scenario, or change application behavior.

- Official authority: `cb6df0ca49d4e752370d1005b5b5eb7bff5d110f` (`origin/inner-main`).
- Implementation lineage: `728d7ae4b5c126f5ab4479e7041f6fc9eafd99db`.
- The replay harness, focused test, and `arenaScenarioGenerationService.ts` are byte-equivalent across those commits. `reviewConstraintCompliance` remains exported.
- Evidence source (read-only): `/Users/hanbit/Dev/btytrainingcenter/bty-app/.eval-artifacts/reviewer-replay-01/`.
- Durable evidence archive (outside all worktrees): `/Users/hanbit/Dev/project-evidence/bty-arena/reviewer-replay-01/`.
- Archive manifest and checksum file: `EVIDENCE_MANIFEST.md`, `SHA256SUMS` in that archive. Raw runtime evidence is not committed to Git.

## Recovered evidence

| Run | Evidence file / SHA-256 | Bytes | Source artifact SHA-256 | Scenario digest | Complete state |
| --- | --- | ---: | --- | --- | --- |
| 4 | `run4.replay.json` / `7d81ccbd43c5f9f0c396e612f5dc52d8255c857e23e358f130dc39a28184dbbe` | 333727 | `e52cc7896da89bcdb745bc4f2c4c7acae652810e359e72a7897102f7cf25644b` | `c917a9d33b581154768e19269c91a1553dd23da07c92b58b7d705cfed30e1390` | `consumed=true`, `status=complete` |
| 5 | `run5.replay.json` / `d0f0fbefb8bb147e6505e3568df66dbf1e24fa2f394d565236c32e8f95c72cea` | 186673 | `46d6882b78f7064de68310b8312fd4b0f9ab5c6f603150ed682a4f8f383b4fd8` | `cae7711899ddc565e3551b2666218986075fa60974fda133686da00a5df30be7` | `consumed=true`, `status=complete` |

The archive also retains the existing local `run4.log` and `run5.log`; their hashes are in `SHA256SUMS`. Archived JSON hashes were verified byte-for-byte against the legacy source.

Legacy artifact inventory: 151 total files, comprising 149 pre-replay files and the two replay evidence files. **HISTORICAL BASELINE SHA = DOCUMENTED, RECIPE NOT AVAILABLE IN CURRENT HANDOFF.**

## Harness contract verified from committed code

`scripts/practice-frozen-reviewer-replay.ts` provides the CLI/evidence writer, uses exclusive evidence creation, marks a subject consumed before the first reviewer dependency call, and persists partial evidence on failure. It runs broad review exactly once irrespective of `broadReviewAllowed`, recording `ON_PIPELINE` or `OFF_PIPELINE` rather than presenting an off-pipeline result as production behavior. The fixed output root is `.eval-artifacts/reviewer-replay-01/`.

The harness does not import or call Plan or Render generation. It passes no accounting context to reviewer dependencies and records `accountingMode: "inert"`. Focused harness coverage observed 19 passing tests. This proves zero generation calls, zero generation-call-sequence allocations, zero DB call-row writes, and zero submission-accounting writes on the harness path. It does **not** measure external provider request count; the retained call counts below are harness dependency calls.

Narrow receives no `boundaryCompliance` construction claim; broad receives constructions. The retained evidence records 0 narrow and 14 broad `boundaryCompliance` field occurrences for each run. Therefore all broad-result interpretation carries this limitation: **CLAIM VISIBLE, UNINSTRUCTED**.

## Run 4

Run 4 had `broadReviewAllowed=false`, so its broad row is `OFF_PIPELINE`. Counts were narrow review 1, narrow repair 1, broad review 1. Timestamps were 2026-09-19T00:01:10.106Z started, 2026-09-19T00:01:10.110Z consumed, and 2026-09-19T00:01:54.869Z completed. Narrow request SHA-256: `49ff3937bdbad3df148f788cb903f5c9b74058e07ec5d8dae97384a7a20f91ef`; broad request SHA-256: `e43cc571b90e80127e6938eafae2e6d1e0668a7e679af1c6c0b69fb06e1e68ae`.

Narrow first returned `boundary_review_malformed`, then after its one repair returned `boundary_review_reject`; its retained primary `[1]` assessment was `non_governing` / `not_assessed`, so it did not directly identify the fixed p2 violation. Broad returned `reject` with defect codes `unsafe_delay` and `choice_bypasses_boundary`. Its boundary assessment explicitly lists `p2` as violated and says proceeding without verification violates the confirmed boundary. For primary/p2, broad retained `constructionAgrees=true`, empty construction dispute, `bad_faith_option`, and `defensible=false`.

Fixed human truth applies only to Run-4 primary/p2: initiating treatment without verifying both identifiers is a true constraint violation; `boundaryCompliance=["c1_verify"]` is not evidence. Broad is **ALIGNED** on p2. Narrow is **NOT_ALIGNED** for that coordinate. The other 13 choices are unadjudicated and excluded from choice-level scoring. `commitment_flag_mismatch` / CFOBS is **NOT_RETAINED** in the evidence.

## Run 5

Run 5 had `broadReviewAllowed=true`, so its broad row is `ON_PIPELINE`. Counts were narrow review 1, narrow repair 0, broad review 1. Timestamps were 2026-09-19T00:02:06.408Z started, 2026-09-19T00:02:06.411Z consumed, and 2026-09-19T00:02:45.763Z completed. Narrow request SHA-256: `b5c8de85b76d5816ca15239a90c55709fa2c2f7e3fddbbb84f9073d1e3ce7239`; broad request SHA-256: `46f6d55663d6327ea6363c900428cf5d24189825252bce5aaf687e5a70008fd4`.

Narrow returned `boundary_review_pass`, treating all assessed pairs as not applicable; it did not recognize the missing confirmed boundary or the boundary-blind scenario. Broad returned `malformed`, with no parsed verdict, boundary assessment, or phase-choice construction finding, so it cannot be scored on that question. Fixed human truth is subject-level `BOUNDARY-BLIND / VACUOUS COMPLIANCE` (Q1a FAIL, Q1b FAIL); no direct per-choice violation is adjudicated. Narrow is **NOT_ALIGNED**; broad is **NOT_SCORABLE**. CFOBS is **NOT_RETAINED**.

## Reviewer capability adjudication

| Subject | Reviewer path | Pipeline | Human-truth scope | Reviewer finding | Construction agreement/dispute | CFOBS | Alignment |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Run 4 primary/p2 | Narrow | ON_PIPELINE | p2 only | `boundary_review_reject`, but p2 retained as non-governing/not assessed | Not retained for narrow | NOT_RETAINED | NOT_ALIGNED |
| Run 4 primary/p2 | Broad | OFF_PIPELINE | p2 only | reject; `choice_bypasses_boundary`; p2 violated | agrees / no dispute | NOT_RETAINED | ALIGNED |
| Run 5 | Narrow | ON_PIPELINE | subject-level | pass; all pairs not applicable | Not retained for narrow | NOT_RETAINED | NOT_ALIGNED |
| Run 5 | Broad | ON_PIPELINE | subject-level | malformed; no valid verdict | NOT_RETAINED | NOT_RETAINED | NOT_SCORABLE |

This does not merge replay rows into the historical live-reviewer 2x2. The two subjects show an **OBSERVED ASSOCIATION**: narrow, which did not receive the forced construction claim, did not identify either fixed issue; broad, which did receive it, aligned on Run 4 but produced no scorable result on Run 5. Two observations do not establish causality. Run 5 contains no accepted or disputed broad construction claim because its broad output was malformed.

## Remaining product decision

The replay is closed. A separate, explicitly authorized product decision is needed before any application change: decide whether to improve reviewer handling of boundary-blind/vacuous-compliance cases and the reliability of broad-result parsing. No such change is included here.
