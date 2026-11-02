# Repository-scope verification repair — 2026-10-31

This change repairs test portability and stale verification registrations. It does
not change application behavior, apply SQL, approve migration semantics, or rewrite
any historical source.

## Historical file-scope evidence

Three tests name real historical commits. Their Git objects are absent from this
source checkout, so direct `git show` fails (one failure occurs during collection
and prevents 42 otherwise active assertions from running). The connected repository's
GitHub commit API supplied the exact full SHA and changed paths:

| Commit | Changed files |
| --- | ---: |
| `ab8177e8e001c34b0da4c062b9773f025c7ccab5` | 2 |
| `e71b3c84112ec9ac453fe2ef48d471cda17296f5` | 9 |
| `1aa3d30784fa395a88f003c688379c15ea4e2183` | 7 |

`src/test-support/fixtures/historical-change-scopes.json` retains repository/commit
URLs, nonempty path lists and the SHA256 of the API's returned patch text. The
helper pins the complete fixture digest, refuses unknown commits or changed bytes,
and compares exact filenames against local Git whenever that object is available.
A source-only checkout uses the independently retrieved fixture rather than an
empty list or mocked Git result. Existing forbidden-path and non-vacuity assertions
remain. This is a historical **file-scope** proof, not a reconstructed historical
source tree or proof of that old code's runtime behavior.

## Later migration source registrations

Six older guards deliberately register subsequent SQL by filename, but their lists
stopped before later application changes. A shared, hash-pinned snapshot names the
21 post-20260917 SQL files already present at source commit `a611a32`, recording each
file's SHA256. The older named lists and empty-list checks remain: unknown additions
are still returned as failures, while edits to registered SQL fail the hash check.

This is an observation of existing source. It grants **no semantic review approval
or production application authorization**. A future source migration must be
registered deliberately: preserve the old entries, record the actual new filename
and bytes, update the snapshot source commit and its helper digest, and test the
unknown-file/changed-byte negative controls. Do not make the snapshot auto-expand
at runtime or suppress a guard failure by deleting the assertion.

## Current-path registrations

- Learn front-door assertions now target the actual `non_author` access branch;
  Required Learning still precedes Learning History and all ordering checks remain.
- Apply narration checks seven named materialization paths: three video/Quick Quiz
  entries and two each for document and guidance. Each named function must contain
  exactly one materialization capture; the one-helper/no-rederived-state checks remain.
- Participant identity reads now explicitly name the fourth, owner/event-scoped
  server-only Host Quiz follow-up path. Its exact public detail DTO is tested to
  exclude canonical account and Microsoft coordinates; the fake query enforces
  actual owner/event filters, with foreign-owner and foreign-event denial controls.
  No projection is broadened.

Two test names are clarified (`non_host` to `non_author`, and the participant-read
label previously said ONE despite already expecting THREE). Assertions were not
removed. Additional helper-integrity/privacy controls and restored collection
coverage increase the active check count.

## Observed checks

- Before: 168 passed / 14 failed in the owned test group, plus one collection error.
- Final: **243/243 passed in 13 files**, Node 20.20.2, one worker.
- Full standalone TypeScript: **exit 0**, 8 GiB heap, no incremental reuse.
- `git diff --check`: exit 0.
- Raw JSON/logs: `release-guards-before`, `release-guards-final` and
  `release-guards-private-read-after` under the task scratch root. These are isolated
  tests and source reads; no production data, auth session or service was touched.

Additional prepared SQL source registered at `daea15d6c771db48c63d8040ac81ccf327b13caf`: Healing atomic completion and Foundry atomic Core receipts. The registry now pins 23 later migration files by name and SHA256. This records source identity only and grants no production application approval. Unknown or changed SQL remains rejected.
