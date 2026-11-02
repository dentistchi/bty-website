# Synthetic frozen-reviewer seam fixtures

The Run-4 and Run-5 captures named in `docs/FROZEN_REVIEWER_REPLAY_CLOSURE.md`
are deliberately archived outside Git and are unavailable in this checkout.
These JSON files are **test inputs**, not recovered captures, measured reviewer
results, clinical cases, or replacements for either historical identity.

`frozen-reviewer-seam-synthetic-a.json` serializes the already tracked sanitized
`C18_SCENARIO` with fourteen canned construction records. Synthetic B changes the
title to exercise a second independently pinned subject identity. Construction
records use the existing `constructionFor` test-data helper; their
`boundaryCompliance` fields are deliberately claims, never compliance evidence.
No model was called to create these files. The immutable JSON bytes and scenario
digests have their own literal pins in `frozenReviewerSeamAuthority.ts`.

The always-run tests exercise real loading, hashing, narrow/broad projections,
reviewer-stage orchestration, inert accounting, exclusive evidence creation,
partial failure evidence, and exact dependency counts. Reviewers are injected
canned functions; success measures that software seam only. Test outputs carry
`sourceKind: "test-fixture"` and `historicalReplay: false`.

The separate `runSyntheticFrozenReviewerReplay` library wrapper requires one of
the fixed synthetic IDs, injected reviewer dependencies and an isolated absolute
output root. The historical CLI accepts only Run-4/Run-5 and retains the original
artifact/digest authority. It never falls back to these fixtures. Tests execute
that CLI and require nonzero exits for missing captures, a mismatched hash, and
an otherwise self-consistent synthetic file offered as Run-4.

`narrow-replay-v4.synthetic.json` is a minimal explicitly synthetic old-version
shape for the JSON compatibility check. Field-repair routing uses the separately
pinned `scripts/fixtures/c18-boundary.synthetic.v1.json` in explicit mock mode.
Neither test claims that a historical /4 artifact or the archived C18 run was
read or replayed. The narrow live entrypoint rejects synthetic selection before
calling any dependency.
