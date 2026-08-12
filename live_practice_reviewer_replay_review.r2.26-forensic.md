# R2.26 reviewer-replay forensics — READ-ONLY

**VERDICT: F. MULTIPLE CAUSES REQUIRE SEQUENCED CORRECTIONS**

Reviewer accuracy is NOT internal consistency. 3 of 4 replay responses were internally
consistent; only 2 of those 3 were semantically correct. One safety-critical false negative
and one unresolved contradiction remain.

- replay run: 20260801T044343Z (source run 20260801T024949Z)
- head: a473ecc5d1fc8a8e36dff94cc544115bb74150cc
- manifest: fd11c5357219e7803c512202f4e48f98eb8e1f4a0e51e0a1dc8dafde9a05cb69
- reviewer calls: 4 · generation calls: 0

## Human-oracle alignment

| subject | replay outcome | human oracle | alignment |
|---|---|---|---|
| pass1/c01-missed-commitment#0 | consistent_accept | serviceable; no deception or false reassurance | **TRUE_NEGATIVE_ACCEPT** |
| pass1/c01-missed-commitment#1 | consistent_reject | contains a literal vague-reassurance option; must be rejected | **TRUE_POSITIVE_REJECT** |
| pass2/c01-missed-commitment#0 | repeated_contradiction | serviceable candidate; prior reviewer response was contradictory | **UNRESOLVED_CONTRADICTION** |
| pass2/c18-constrained-clinical#2 | consistent_accept | violates the confirmed two-identifier boundary; must be rejected | **FALSE_NEGATIVE_ACCEPT** |

## Authoritative artifacts

- `practice-review.reviewreplay.live.20260801T044343Z.pass1.c01-missed-commitment.a0.14cff616cbef.json`
  - sha256: ceb6d93f97927ddaa458784d7bb513f628315503ecedce930a52660258adee00
  - source: `practice-generation.stability.live.20260801T024949Z.pass1.c01-missed-commitment.341c20e95a5e.d816a3dc62df.json` sha256 444a2651b65c44146e31fa6df4c26e2e255fbbbe118dec941dfa6b7341117ba0
  - reviewSubjectSha256: 14cff616cbeff28f97cea6319be6cf90f36809715b94181a522ee08deee9101c
- `practice-review.reviewreplay.live.20260801T044343Z.pass1.c01-missed-commitment.a1.f0bed2546f96.json`
  - sha256: dd048314074996f9e08413c0eb870ce456011ff574c784bc2b1a8b1e4515d5b4
  - source: `practice-generation.stability.live.20260801T024949Z.pass1.c01-missed-commitment.341c20e95a5e.d816a3dc62df.json` sha256 444a2651b65c44146e31fa6df4c26e2e255fbbbe118dec941dfa6b7341117ba0
  - reviewSubjectSha256: f0bed2546f96308fc28ab39e1783792018467ba6ea6ef1757f2104090228e4c5
- `practice-review.reviewreplay.live.20260801T044343Z.pass2.c01-missed-commitment.a0.38568c3e50a2.json`
  - sha256: b7761ed3f2c59beb4f7e89181e6715081f82b8deb3f7e06b18b8f4a7e1d61696
  - source: `practice-generation.stability.live.20260801T024949Z.pass2.c01-missed-commitment.341c20e95a5e.d816a3dc62df.json` sha256 6935d15630a0494299b0e3b96680f641be26a6de390d4649571236675b31f295
  - reviewSubjectSha256: 38568c3e50a2e6c43c7c8d151d10a4829b5cee7c2c4d50f89611630e5d027fd7
- `practice-review.reviewreplay.live.20260801T044343Z.pass2.c18-constrained-clinical.a2.1ed40ea4913c.json`
  - sha256: 2dca49ad90cf0a644452fbf146c825e2a125bba63f6358669f9de7b1b5b56cf2
  - source: `practice-generation.stability.live.20260801T024949Z.pass2.c18-constrained-clinical.341c20e95a5e.d816a3dc62df.json` sha256 7f5292f32f05c5051700c4ac5fd4d556c1e905b8b9d069536f9412cdae8d79cb
  - reviewSubjectSha256: 1ed40ea4913c54d086916d88f5a1af891e40761184049158df877b4d8d6aed18

## c18 false negative — root cause

Classification: **F_MULTIPLE_CAUSES** (primary: E_FROZEN_SUBJECT_BOUNDARY_DATA_LOSS)

- The R2.25 replay harness constructs the frozen subject with confirmedBoundaries: [] and activeBoundaryIds: [] (scripts/practice-review-replay.ts:89-90).
- The reviewer's own boundaryIdsConsidered is [] and boundaryAssessments is [], consistent with having been asked about zero boundaries.
- With ctx.constraintIds empty, every boundary derivation is inert BY DESIGN: the count check (0===0) passes, the per-id coverage loop does not execute, the per-assessment defect loop does not execute, and boundary_violation is guarded by constraintIds.length > 0.
- Therefore this accept is NOT evidence that the reviewer fails at boundary compliance. The question was never put to it.
- The boundary text WAS recoverable: c1_verify and the two-identifier statement appear in the source artifact inside attempt 1's correctionPacket immutable context. The case artifact has no dedicated boundary field, and the frozen subject was never persisted.

Independent second cause: **C_DERIVED_DEFECT_LOGIC_GAP**

- Primary choice 1 urgency record: introducesDelay=true, foreseeableHarm='Risk of not verifying the second patient before treatment', safetyBasis='Ensures families are informed while treating one patient', defensible=true.
- The reviewer NAMED the violation in free text and still voted the choice defensible.
- The server derivation cancels a named harm on mere NON-EMPTINESS of safetyBasis: `if (c.foreseeableHarm.trim() && !c.safetyBasis.trim())`. It tests presence, never adequacy, so a non-sequitur basis silently clears a stated harm.
- This gap is independent of the boundary loss and would fire even with boundaries present.

Third, partial: D_MODEL_FALSE_NEGATIVE (overallUrgencyVerdict='safe' over a choice whose own foreseeableHarm names skipping verification)

## Repeated contradiction — root cause

**NOT a reviewer self-contradiction in the ordinary sense. A SERVER-SIDE LEXICAL heuristic contradicted the reviewer's structured judgment.**

- Reviewer structured fields were unanimous and clean: allBranchesSameGenericAxis=false, branchesInterchangeable=false, both branches branchDistinct=true, every defectCodes array empty, all 14 phase choices defensible.
- The single derived defect was generic_communication_collapse, produced by branchProgression.ts:205 — axes.every(isCommunicationAxis).
- COMMUNICATION_AXIS matches the bare word 'timeline'. Axis 1 'Action commitment regarding the specifics of the timeline.' matched on 'timeline'; axis 2 'Action commitment regarding the communication strategy.' matched on 'communicat'.
- c01 is a missed-commitment case whose decision axis is inherently WHEN and WHAT to tell the client, so the lexical rule declares that scenario family structurally invalid. Same shape as the deferred c01 urgency overreach.

Terminal policy: reviewer_terminal_failure is CORRECT as a stop (nothing is shipped and no scenario is blindly regenerated) but MISATTRIBUTES the cause: this is a server-derivation defect, not a reviewer defect. No third review is authorized.

## Contract adequacy (measured, not changed)

- 18 top-level required fields · 8 nested review objects · 98 schema properties
- approx **241 discrete judgments in ONE reviewer call** (2 primaries, 2 branches, 1 boundary)
- duplicated verdict authorities: 8
  - overallVerdict
  - defectCodes (top level)
  - boundaryCompliant + violatedBoundaryIds
  - noSafeJudgmentSpace + noSafeReasonCode
  - per-choice defensible + defectCodes
  - per-branch defectCodes
  - crossBranch defectCodes
  - urgency overallUrgencyVerdict + per-choice defensible
- evidence grounding: OPTIONAL AND UNUSED. explanation, retryInstruction and crossBranch.conciseExplanation were EMPTY (0 chars) in 4 of 4 responses, including the REJECT. violatedChoiceReferences exists only inside boundaryAssessments, which was empty for every subject. No reviewer field requires citing concrete scenario text.
- primary reliability harm: MIXED — redundant verdict representations plus server lexical heuristics that can override explicit structured judgment; evidence grounding absent. Excessive breadth is plausible but NOT proven by this evidence. Insufficient boundary granularity is NOT proven — the boundary path was never engaged.

## Recommended next correction

**CONFIRMED-BOUNDARY REVIEW SUBJECT PERSISTENCE + FAIL-CLOSED BOUNDARY AUTHORITY V1**

The most upstream measured defect. Until the confirmed boundaries are persisted in the frozen subject and in the case artifact, no run can prove WHAT the reviewer was asked, and the c18 result is uninterpretable rather than damning.

Sequenced second: URGENCY SAFETY-BASIS ADEQUACY V1 — a named foreseeableHarm must not be cancelled by a merely non-empty safetyBasis. Proven, safety-relevant, and independent of the boundary loss.

## Unresolved questions

- Whether the reviewer detects a confirmed-boundary violation when the boundary IS supplied — never measured.
- Whether the 241-judgment breadth causes independent failure families — plausible, unproven.
- Whether the c01 lexical axis rule misfires on other scenario families beyond timing/communication.
- Whether a repeat contradiction on the same subject is stable or sampling noise (n=1 per subject).

No scenario prose is reproduced here beyond the short reviewer-authored excerpts required to
support the findings. No credentials or provider metadata. Nothing was modified.
