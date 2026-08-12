# R2.24 corrected forensic review — run 20260801T024949Z

LIVE EXECUTION COMPLETE · 6/6 EVIDENCE WRITTEN
STABILITY HARD GATES FAILED
HUMAN CONTENT REVIEW LIMITED TO GENERATED OUTPUTS

## Correction

The original R2.23D-R4 aggregate label was incorrect. Its counts were accurate; its verdict was not. The six immutable case artifacts remain authoritative and are unmodified.

- head: 341c20e95a5e5ddae35a13105f447e49debf36df
- contract manifest: d816a3dc62df9a797a875c89254e17d26efc155b9e2fe67d6dbaf89b320cfc90
- model: gpt-4o-mini

## Hard gate failures

- `generatedValid` — expected 6, measured 1
- `firstAttemptValid` — expected >= 5, measured 1
- `retryExhausted` — expected 0, measured 5
- `reviewerMalformed` — expected 0, measured 4
- `semanticDefectTotal` — expected 0, measured 11

## Metrics (from the artifacts, not the terminal)

- expectedCases: 6
- executedCases: 6
- generatedValid: 1
- generationRejected: 5
- infrastructureFailure: 0
- firstAttemptValid: 1
- retryRecovered: 0
- retryExhausted: 5
- reviewerMalformed: 4
- truncation: 0
- fallback: 0
- semanticDefectTotal: 11

## Authoritative artifacts

- `practice-generation.stability.live.20260801T024949Z.pass1.c01-missed-commitment.341c20e95a5e.d816a3dc62df.json`
  sha256: 444a2651b65c44146e31fa6df4c26e2e255fbbbe118dec941dfa6b7341117ba0
- `practice-generation.stability.live.20260801T024949Z.pass1.c09-transparency-verification.341c20e95a5e.d816a3dc62df.json`
  sha256: d65e50c04f65b5d27ea96ee9addd3185b70c1e5f9368f0dfc33b654f9297ed5a
- `practice-generation.stability.live.20260801T024949Z.pass1.c18-constrained-clinical.341c20e95a5e.d816a3dc62df.json`
  sha256: f9b3e22d0d2b91807771045ba3ada8fb1306f48d867288ef7d86bc56822f0417
- `practice-generation.stability.live.20260801T024949Z.pass2.c01-missed-commitment.341c20e95a5e.d816a3dc62df.json`
  sha256: 6935d15630a0494299b0e3b96680f641be26a6de390d4649571236675b31f295
- `practice-generation.stability.live.20260801T024949Z.pass2.c09-transparency-verification.341c20e95a5e.d816a3dc62df.json`
  sha256: bb4083d3fc074d90c5e42e78078726a3c1b32130d400c2994fe3df2d6721c91b
- `practice-generation.stability.live.20260801T024949Z.pass2.c18-constrained-clinical.341c20e95a5e.d816a3dc62df.json`
  sha256: 7f5292f32f05c5051700c4ac5fd4d556c1e905b8b9d069536f9412cdae8d79cb

## Attempt classification

### pass1 · c01-missed-commitment — rejected (review_verdict_contradicts_details)

generations: 2 · retries: 1 · recovered: false

- attempt 1 · `review_malformed` · `review_verdict_contradicts_details` → **B REVIEWER_OUTPUT_DEFECT**
  - scenario captured: true · review captured: true
  - review_verdict_contradicts_details fires only when the reviewer's overallVerdict is 'accept' while its own detail fields derive at least one defect. The reviewer intended to accept. The scenario was discarded and regenerated on the strength of a broken review, not a bad scenario.
- attempt 2 · `review_malformed` · `review_verdict_contradicts_details` → **B REVIEWER_OUTPUT_DEFECT**
  - scenario captured: true · review captured: true
  - review_verdict_contradicts_details fires only when the reviewer's overallVerdict is 'accept' while its own detail fields derive at least one defect. The reviewer intended to accept. The scenario was discarded and regenerated on the strength of a broken review, not a bad scenario.

### pass1 · c09-transparency-verification — rejected (repeated_action_meaning)

generations: 2 · retries: 1 · recovered: false

- attempt 1 · `gate_level_4` · `construction_metadata_generic` → **H UNRESOLVED_DUE_TO_MISSING_EVIDENCE**
  - scenario captured: false · review captured: false
  - UNRESOLVED: the deterministic-gate rejection path records findings but does not capture the draft, so the content behind this defect code no longer exists
  - Defect code is known; the scenario it describes is not recoverable from this artifact.
- attempt 2 · `correction_packet` · `construction_metadata_generic` → **RETRY_BOOKKEEPING**
  - scenario captured: false · review captured: false
  - Ledger entry restating the previous attempt's defects; not a generation and not counted as one.
- attempt 3 · `gate_level_6` · `repeated_action_meaning` → **H UNRESOLVED_DUE_TO_MISSING_EVIDENCE**
  - scenario captured: false · review captured: false
  - UNRESOLVED: the deterministic-gate rejection path records findings but does not capture the draft, so the content behind this defect code no longer exists
  - Defect code is known; the scenario it describes is not recoverable from this artifact.

### pass1 · c18-constrained-clinical — rejected (unsafe_delay)

generations: 2 · retries: 1 · recovered: false

- attempt 1 · `gate_level_4` · `unsupported_boundary_compliance` → **H UNRESOLVED_DUE_TO_MISSING_EVIDENCE**
  - scenario captured: false · review captured: false
  - UNRESOLVED: the deterministic-gate rejection path records findings but does not capture the draft, so the content behind this defect code no longer exists
  - Defect code is known; the scenario it describes is not recoverable from this artifact.
- attempt 2 · `correction_packet` · `unsupported_boundary_compliance` → **RETRY_BOOKKEEPING**
  - scenario captured: false · review captured: false
  - Ledger entry restating the previous attempt's defects; not a generation and not counted as one.
- attempt 3 · `gate_level_3` · `unsafe_delay` → **G DETERMINISTIC_GATE_CORRECT_REJECTION**
  - scenario captured: true · review captured: true
  - Scenario captured alongside the finding; the rejection can be checked against the content.

### pass2 · c01-missed-commitment — rejected (unsafe_delay)

generations: 2 · retries: 1 · recovered: false

- attempt 1 · `review_malformed` · `review_verdict_contradicts_details` → **B REVIEWER_OUTPUT_DEFECT**
  - scenario captured: true · review captured: true
  - review_verdict_contradicts_details fires only when the reviewer's overallVerdict is 'accept' while its own detail fields derive at least one defect. The reviewer intended to accept. The scenario was discarded and regenerated on the strength of a broken review, not a bad scenario.
- attempt 2 · `gate_level_3` · `unsafe_delay` → **G DETERMINISTIC_GATE_CORRECT_REJECTION**
  - scenario captured: true · review captured: true
  - Scenario captured alongside the finding; the rejection can be checked against the content.

### pass2 · c09-transparency-verification — generated

generations: 1 · retries: 0 · recovered: false

- attempt 1 · `generated_valid` → **PENDING_HUMAN_REVIEW**
  - scenario captured: false · review captured: false
  - UNRESOLVED: automated generated_valid means no gate fired; it is not a quality verdict
  - Requires full human product review before any claim of quality.

### pass2 · c18-constrained-clinical — rejected (review_verdict_contradicts_details)

generations: 2 · retries: 1 · recovered: false

- attempt 1 · `gate_level_3` · `confirmed_boundary_absent` → **H UNRESOLVED_DUE_TO_MISSING_EVIDENCE**
  - scenario captured: false · review captured: false
  - UNRESOLVED: the deterministic-gate rejection path records findings but does not capture the draft, so the content behind this defect code no longer exists
  - Defect code is known; the scenario it describes is not recoverable from this artifact.
- attempt 2 · `correction_packet` · `confirmed_boundary_absent` → **RETRY_BOOKKEEPING**
  - scenario captured: false · review captured: false
  - Ledger entry restating the previous attempt's defects; not a generation and not counted as one.
- attempt 3 · `review_malformed` · `review_verdict_contradicts_details` → **B REVIEWER_OUTPUT_DEFECT**
  - scenario captured: true · review captured: true
  - review_verdict_contradicts_details fires only when the reviewer's overallVerdict is 'accept' while its own detail fields derive at least one defect. The reviewer intended to accept. The scenario was discarded and regenerated on the strength of a broken review, not a bad scenario.

## Human review

Automated `generated_valid` is not decisive. Only scenarios whose content was captured can be
reviewed at all; every attempt marked UNRESOLVED has a defect code and no recoverable content.
