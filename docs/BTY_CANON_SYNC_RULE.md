# BTY Canon Sync Rule

Status: LOCKED
Version: 1.0

## Scope

This document governs edition-sync between:

- BTY_CANON.md (Korean Canonical Authority)
- BTY_CANON.en.md (English Canonical Edition)

It does not govern repository synchronization (outer ↔ inner).
Repository-sync remains governed by HK8_OUTER_INNER_SYNC_POLICY_CLOSURE.md.

## Authority

BTY_CANON.md is the Canonical Authority.
BTY_CANON.en.md is the Canonical Edition.
If any divergence exists, the Korean edition governs.

A change to BTY_CANON.md automatically places BTY_CANON.en.md under review.
Until review is completed, EN may be marked STALE.

## Sync Trigger

A sync review is required whenever:

- BTY_CANON.md changes
- A new canon section is added
- A canon section is removed
- Canon terminology is modified
- Canon authority structure changes

A sync review is not required for:

- formatting-only edits
- typo corrections
- non-canon documentation

Commander initiates review.
Claude Code executes approved mutations.

## Sync States

SYNCED
EN reflects the current KO canon.

STALE
KO canon changed.
EN review has not yet been completed.
STALE represents sync debt, not authority conflict.

DIVERGED
EN meaning conflicts with KO authority.

Only KO may declare EN stale.

If EN is DIVERGED:

1. KO interpretation governs.
2. EN must be corrected.
3. State returns to SYNCED.

## Resolution Order

1. Review KO change.
2. Determine whether EN impact exists.
3. Update EN if required.
4. Mark state as SYNCED.

If uncertainty exists, KO interpretation governs.

## Amendment Rule

Changes to this document require:

- Commander approval
- explicit ledger entry

This document may define canon synchronization.
It may not redefine canon authority.
