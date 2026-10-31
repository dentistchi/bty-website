# Next clinical case details: observed QA and limits

## Scope

Cases 002, 003 and 008 receive separately appended English fictional packs at
`discovery-2026-10-31.2-review-b`. They contain 77 provenance-marked new/revised
entries (21/29/27), including 12 fixed per-root/per-tooth projections of broader
observations. Five entries remain explicitly unavailable. The exact statements
are in [CLINICAL_CASE_DETAILS_NEXT_REVIEW.md](CLINICAL_CASE_DETAILS_NEXT_REVIEW.md).

Only new attempts by the existing allowlisted Founder receive the new versions.
All 28 prior patient objects, including review A, retain their serialized SHA256.
The original catalog/author references and historical fixtures are unchanged.
API tests cover ordinary-user exclusion, attributed new details, old-attempt
version/hash/event preservation and continued owned access after Founder removal.
The neutral library GET exposes no additional patient answers.

No diagnosis, treatment rubric, grade, next-question menu or author decision is
added. The clinician chooses what to ask and when to record an assessment. The
reference remains gated until that assessment; added details carry visible review
labels at the encounter start, in issued responses and after assessment. The
recorded author perspective predates these additions and is not rewritten.

## Reproduction before interpretation repair

The original three-case subset has 27 turns and 12 required missing-information
turns (3/4/5), with no interpretation/answer/capture errors. This is not 12 unique
facts or a learner omission. The new design supplies pre-excavation and site
observations, but retains the Case 003 fracture/retreatment uncertainties; no
claim that all original unknowns have been definitively resolved is made.

An independent 72-turn oracle (24/case) was frozen before router tuning. With only
new data registration, the root run reproduced 34 routing/resolution issue turns,
23 checked-answer mismatches and five new extra available disclosures. There
were zero capture invariants and no real model calls. The corresponding initial
39 tests had 27 passes and 12 failures. Data registration/isolation construction
checks separately passed 15/15. Raw records are preserved in
`docs/clinical-next-case-details-qa/`.

## Interpretation and scope repair

The v10 router adds review-B-only subject metadata and clause composition:

- Patient cold symptoms, onset, procedure timing, medicines, allergies and
  preferences remain history in either input mode; examination results remain
  unavailable through Patient mode.
- Accessible structure, the caries-boundary-to-bone observation, axial height,
  isolation, cold testing, EPT and apical imaging are separate requested subjects.
  The restorative-margin-to-bone measurement is not supplied and cannot be
  substituted with the 2.5 mm caries-boundary measurement.
- Historical/current images, covered fracture status, retreatment feasibility,
  filling appearance, root-specific probing and adjacent-tooth tests stay separate.
- Missing-tooth identity, #3 position, #31 inclination, interarch/mesiodistal space,
  ridge widths and crest-to-canal distance are separately requested observations.
- Independent `then` requests and named elliptical subjects retain both parts.
  Covered negation, tooth/root scope and model-evidence checks reject the tested
  mismatches. A tooth number alone does not name a requested clinical examination.

The selector/3 prompt, transport, four-second deadline, flags, identity and rewards
are unchanged. Fixed metadata selects source facts; it generates no patient answer.
Genuine unknowns include unperformed excavation, covered root fracture, specialist
retreatment feasibility, achieved implant stability and a definitive replacement
plan. Smaller scopes may also be unavailable where no fixed observation exists.

## Oracle annotation correction: preserved v1, separate v2

The first fixture marked three deliberate wrong-target negative controls as
required while expecting an explicit unavailable acknowledgement. Once scope was
correct, those three turns correctly remained information gaps, contradicting the
journey test's zero-required-gap assertion. They are scope tests, not information
required for the focal case's finite clinical path.

Independent review confirmed the contradiction. V1 and its initial measurement
are retained byte-for-byte. V2 changes only those three `required: true` flags to
false. No question, expected fact ID, availability, resolution, answer pattern or
reason changed. The exact correction is in
`scripts/fixtures/clinical-discovery-case-details-next.v2.corrections.json`.
Both fixtures still test the acknowledgement and focal response; no unknown
result is replaced with a guessed normal finding.

Final v1 has zero semantic issues but three required gap turns and exits 1.
Final v2 has zero semantic issues and zero required gap turns and exits 0. These
results are reported separately; v1 is not relabeled as a passing quality gate.

## Independent additional probes

After the first repair, a separate reviewer froze 13 additional natural questions
and controlled-model requests, then observed six passes and seven failures.
The failures reproduced a missing regular-drugs history, unparsed `then` clauses,
cross-root broadening and the restorative-margin/caries-boundary conflation.
After the bounded repair, exactly the same 13 probes pass on Node 20.20.2.
The oracle is preserved in
`scripts/fixtures/clinical-discovery-case-details-next-independent.v1.json`.
The unit regression adds two further history/negated-`then` controls, totaling
15 assertions, alongside the independent 39-test journey/boundary suite.

The independent runner's raw `after.json` repeats the oracle's baseline source
head rather than measuring the execution head. Its unchanged raw output is saved
with `independent-after-run-manifest.json.gz`, which records the actual repaired
execution source `cdafb572d5ac2a88557bda4e08a8a471870581d6` and both hashes. Do not
read the raw baseline field as the execution SHA. Root audit output independently
records the current source and per-file hashes.

## Verification and remaining limits

Final related Clinical, Practice, rewards and deployment-guard tests: 897/897
across 49 files. The source-frozen standalone typecheck passes with an 8 GB heap.
Two optional agent typecheck attempts exhausted the default 2 GB heap with no
source diagnostics before failure; those attempts are not counted as passes.
Build and browser results, exact commands, input hashes and artifact checks are
recorded in `docs/clinical-next-case-details-qa/verification.json`.

The final isolated browser run passes 48/48 at 320/390/1280 px, including nine new
review-B runs with the real UI and an in-memory router/domain transport. The fresh
Cloudflare build passes; its artifact guard scans 3,626 JavaScript files with
zero unsafe matches and 2/2 safe middleware implementations. In 743 public text
files, none of the sampled 119 six-pack patient-answer, 46 reference or 12 selector
prefixes appears. This is a limited marker scan, not exhaustive disclosure proof.

The new v2 72-turn rules journey has zero routing, checked-answer, capture,
required-gap or new-extra-disclosure issues. The earlier review-A 72-turn journey
and original Case 005 four-turn regression also pass. The frozen 23-case/205-turn
journey still has 74 required missing-information turns across 22 cases and exits
1, with no interpretation errors. No 74-to-62 or other whole-catalog reduction is
claimed from these separately versioned preview measurements.

These are visible finite regressions and controlled selector responses, not
held-out qwen accuracy or proof that every natural question works. Evidence and
scope validation do not establish arbitrary same-clause topic semantics. Actual
Mac/qwen evaluation of the new packs, signed-in live Worker/Teams/iPhone flows and
the full unrelated repository suite remain unrun. No production auth/learner
write, migration, seed, secret change, service restart, merge or deployment is
part of this source preparation.

## Reproduce the new finite path

Use Node 20 and installed dependencies. This CLI does not load .env files and does
not import the persistence/auth/service boundary. Output creation is exclusive;
choose a new result path to preserve earlier measurements.

```sh
node --import tsx scripts/clinical-discovery-audit.ts --mode rules \
  --fixture scripts/fixtures/clinical-discovery-case-details-next.v2.json \
  --json /tmp/clinical-next-review-rules-unique.json --check
```

In the already authorized Mac gateway environment, the actual model run uses the
same fixture with `--mode model --base-url http://127.0.0.1:8788/v1`, the existing
model and key-file arguments. Inspect actual model turns, fallbacks, issued text,
extra/missing information and latency; correct rules fallbacks alone are not
evidence that the real model handled the questions.
