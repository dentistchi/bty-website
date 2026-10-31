# Clinical case-detail preview QA

## Scope and review state

Three separately versioned fictional patient packs extend Cases 005, 006, 011:
`discovery-2026-10-31.1-review-a`. The final draft contains 73 marked new/revised
fact entries (29/23/21). Four are single-tooth projections of existing paired
cold/percussion observations, not new clinical measurements. Every such fact is
`fictional-extension-awaiting-review`. The English review table is
[CLINICAL_CASE_DETAILS_REVIEW.md](CLINICAL_CASE_DETAILS_REVIEW.md).

Only the existing server-side Founder allowlist receives these packs for NEW
attempts. Ordinary users retain current packs. Existing attempts resolve their
stored packVersion/hash even after access changes. No new flag, secret, migration,
permission, live learner trace or auth session is created. The preview label is
shown at start, on issued added details and in the post-assessment comparison.
The recorded Dr. Chi perspective predates these additions and remains unchanged.

All 25 pre-existing patient objects retain their exact serialized SHA256, checked
by a frozen manifest. Source arrays are not overwritten. In the NEW Case 011 copy
only, the crown fact retains the known screw-retained/mobile finding but removes
a stale unknown-source clause; that revision is marked and allowlisted explicitly.

## Reproduction and repair

The original three cases produced 14 required missing-information TURNS on their
27-turn paths (4+6+4), with correct interpretation. That is not 14 unique facts or
an omission by a doctor. The original 23-case/205-turn fixture is unchanged.

A separate 72-turn fixture (24/case) and 24 additional English paraphrase probes
were frozen before routing repair. These are visible regression expectations,
not a held-out model benchmark. The initial new-pack run had 26 routing/resolution
issue turns, 17 checked-answer mismatches and 5 newly disclosed extra AVAILABLE
findings. Other extra selections repeated previously issued facts. The final
72-turn rules run has 0 in those categories and 0 capture invariants.

The initial review repair used `discovery-intent/v8`; the evidence-scope follow-up
below uses `discovery-intent/v9`. Review-only subject metadata separates:

- Patient bite perception, jaw-shift reports and parafunction from objective exams.
- Prior RCT versus the new crown history. After both are disclosed, bare timing
  asks which procedure; after a specific single procedure it repeats only that fact.
- Other restorations, lower-anterior caries, root-surface caries and broad risk.
- Cusp thickness, bite testing, transillumination and unestablished crack extent.
- Initial crown mobility, directed movement-source assessment, isolated fixture
  stability, screw inspection, connection inspection and unknown compatibility.

Independent inspection then found 5 further scope defects despite the passing
script: explicit #30 history lost the RCT source, two mixed-tooth requests disclosed
#30 findings for #29, an objective jaw-movement order selected patient history, and
compound history repeated the missing-source problem. Five new assertions failed
before the final repair. They now pass unchanged. Requests and history facts are
scoped per independent clause; the model's offered choices follow that scope.

The initial independent jaw probe used the closure-occlusion ID as a direction-of-
subject expectation. Review clarified that the record contains no lateral result.
Its final regression requires an explicit unavailable excursion topic, never a
patient jaw-shift denial or an invented normal excursion. The original probe
report is retained. A supplementary root test initially expected #29 percussion
to be unavailable, overlooking the paired #29/#31 record. The requirement was
corrected to issue the known #29 result alone, and four fixed per-tooth projections
were added. The original 72-turn/24-paraphrase oracles were not changed.

## Observed verification

- Final serial standalone typecheck: exit 0. Fresh-checkout `cf:build`: exit 0,
  353 pages generated. Shipped artifact guard: 3,626 JavaScript files, zero unsafe
  matches, both middleware implementations safe. In 743 public text files, none
  of the sampled 60 patient-answer, 46 author-reference and 12 selector-instruction
  prefixes appeared. This sample scan is not an exhaustive disclosure proof.

- Final related Clinical, rewards, Practice and deployment-guard tests: 800/800
  across 44 files. New scope suite: 12/12. The independent requested subset passes
  72/72 UNIT tests across three files; that is separate from the 72-turn script.
- Final isolated browser encounters: 39/39 at 320/390/1280 px. These include 30 prior
  flows and 9 new preview flows. Each checks semantic expected facts/resolution/text,
  literal capture, provenance, working/final assessment, reference gating, comparison,
  reaction, completion and layout. All external network traffic is blocked; the
  transport and traces exist only in memory.
- Final independent fresh probes: 15/15, including the documented jaw qualification.
- New 72-turn fixture: 0 routing/answer/capture/new-extra issues, 0 REQUIRED gap turns,
  exit 0. Five optional true-unknown turns remain and are declared by the fixture.
- Frozen 205-turn fixture: 0 interpretation/answer/capture errors, 74 required gap
  turns across 22 cases; `--check` correctly exits 1. No 74-to-60 reduction is claimed:
  that fixture deliberately still uses the original versions.
- Frozen Case 005 four-turn history fixture:exit 0, unchanged original one-procedure
  response and timing behavior.

The new finite paths are useful regression coverage, not proof that every natural
question works or that these cases are clinically complete. Optional unknowns
include CR–MIP, covered crack extent, part compatibility and torque. Additional
scope probes acknowledge unavailable lateral findings and focal cold-test results.
No normal findings are guessed to turn those requests into passes.

The standalone typecheck/build results and artifact scan are recorded with exact
commands and source hashes in `docs/clinical-case-details-qa/verification.json`.
An earlier simultaneous tsc/build attempt failed TS6053 while Next regenerated
`.next/types`; that execution is not a source-type error or PASS. A repeated build
also failed its `.next/export` cleanup with ENOTEMPTY after 353 generated pages.
Final verification uses a fresh checkout with real dependencies and separates
standalone typecheck from mutation of its generated files. No deployment guard,
configuration or dependency was changed to bypass either problem.

Actual Mac/qwen testing of THESE NEW packs, live Worker/Teams/iPhone and the full
unrelated repository suite remain unrun. The previously operator-reported 179/205
model selections refer to the original packs and are not a new-pack score. No
merge, deployment, service restart or production write is part of this preparation.

## Repeatable commands

Use Node20 with actual installed dependencies. The CLI loads no .env file and
imports no persistence/auth/service boundary. JSON paths must be unique; exclusive
creation preserves earlier measurements.

```sh
node --import tsx scripts/clinical-discovery-audit.ts --mode rules \
  --fixture scripts/fixtures/clinical-discovery-case-details.v1.json \
  --json /tmp/clinical-review-rules-unique.json --check
```

In the existing authorized Mac gateway environment, the same fixture can be run
without creating an app session or training rows:

```sh
node --import tsx scripts/clinical-discovery-audit.ts --mode model \
  --fixture scripts/fixtures/clinical-discovery-case-details.v1.json \
  --base-url http://127.0.0.1:8788/v1 --model qwen3-coder-next:q4_K_M \
  --key-file "$HOME/.config/bty/clinical-discovery-gateway.key" \
  --json /tmp/clinical-review-model-unique.json --check
```

`--check` alone does not establish model operation: inspect modelTurns, fallback
reasons, issued text, extra/missing selections and latency. A transport fallback
can still produce a correct rule response. This command does not restart the
model, gateway, tunnel or another app.

## Preserved evidence

`docs/clinical-case-details-qa/` contains the original-three-case baseline, the
new 72-turn before/after, the frozen 205/4-turn rechecks, the independent probe
before/after and the five-scope-test failing baseline as compressed JSON. Runtime
file/fixture hashes identify measured content even when a local commit or working
copy supplied the run. No archived original PR84 measurement is replaced.

## Follow-up: model evidence must retain its clause and tooth

Continuing verification reproduced a gap outside the rules-only paths. In Case 005,
`Check cap borders on tooth #29. Describe background details.` left the authored
selection empty, but the unscoped second clause made the #30 crown-integrity topic
eligible. A controlled model response selecting that topic and quoting only
`cap borders` was accepted. Case 011 had the same failure for fixture stability;
an evidence quote crossing the sentence boundary also passed the old guard.
These are observed router failures with stubbed model responses, not observed
qwen accuracy failures.

The independent seven-test reproduction was frozen before the repair: three
failed and four passed, confirmed on Node 20.20.2. The final v9 router requires
each selected real fact's evidence to fit wholly within a clause whose tooth
scope permits that fact. It cannot borrow eligibility from a different clause.
A rejected selection records `local_model_evidence_scope_mismatch` and falls back
to the authored result. Shared evidence within one clause remains supported.
The selector/3 prompt, model transport/deadline, patient packs and historical
records are unchanged by this follow-up.

Observed final checks on runtime source `27a14f08a2804c47d60cea3d2f066d4c66215878`:

- Eight model-boundary tests pass, including the original seven unchanged tests
  and an additional shared-evidence history control. Independent Node 20 rerun:
  8/8; an additional controlled wrong-tooth paraphrase also disclosed no facts.
- Related tests: 808/808 across 45 files. Isolated browser encounters: 39/39.
- New 72-turn rules fixture: no routing, checked-answer, capture, required-gap or
  new-extra issues. Frozen original 205-turn fixture retains 74 required gaps
  with no interpretation errors (exit 1); the original four-turn fixture exits 0.
- Fresh-checkout Cloudflare build exits 0. Artifact guard: 3,626 JavaScript files,
  zero unsafe matches, 2/2 safe implementations. The sampled 60 patient, 46
  reference and 12 selector prefixes have zero hits in 743 public text files.

The final serial typecheck, exact source hashes and commands are in
`docs/clinical-case-details-qa/model-scope-verification.json`. Five append-only
`model-*` archives preserve this follow-up separately from the initial evidence.
This guard checks quoted evidence and tooth scope; it does not establish whether
an arbitrary same-clause topic choice is semantically correct. Actual qwen and
live Worker/Teams checks remain required and are not replaced by these tests.

## Remaining execution and content work

The current browser connection could not access an existing Founder session. Both
unauthenticated version probes from this execution environment returned HTTP 403;
they do not establish a new live version. There is no Mac execution channel here.
No login session, deployment or service restart was created to clear these limits.

The existing authorized Mac executor can run the model command above from a
verified PR #90 checkout using its existing gateway and key file. Inspect the
actual model-turn count and fallbacks as well as routing, answer and extra/missing
disclosure fields; a correct rules fallback is not model verification. Then run
the existing signed-in Founder `GET /api/bty/clinical-pilot?view=model-check` to
verify the production Worker path. This GET is connection-only and does not
create learner attempts or establish new-pack accuracy. Preserve the current
gateway/model services and do not mint an auth session for this check.

The read-only remaining-case map and proposed next batch (002, 003, 008) are in
[CLINICAL_CASE_DETAILS_NEXT_BATCH.md](CLINICAL_CASE_DETAILS_NEXT_BATCH.md).
No additional fictional findings were added by this scope follow-up.
