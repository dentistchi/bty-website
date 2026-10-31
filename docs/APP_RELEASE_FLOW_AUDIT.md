# App release flow audit — 2026-10-31

Base: `b913a7d9827d15629773fb36c70085debf6ab888`. This is isolated source
preparation. No production session, learner write, migration, configuration,
merge, or deployment is part of this audit.

Final integrated runtime verification is recorded in
[CLINICAL_COMPLETE_QA.md](CLINICAL_COMPLETE_QA.md): 1,618/1,618 reported related
tests (15 opt-in PostgreSQL bodies inactive), 135/135 isolated browser flows,
standalone types and fresh build/artifact checks. The earlier branch-only
verification paragraphs below remain historical; the exact full-suite comparison
now has zero new failing assertion identities while its existing baseline is red.

## Reproduced and repaired

| Flow | Frozen failure before repair | Smallest repair |
| --- | --- | --- |
| Tracking | A Today reselect read remains in flight while personal Remove succeeds and a newer canonical read returns empty. The older success restores the row; an older HTTP/body failure replaces the confirmed empty lane with an error. A delayed JSON body has the same race. Four probes fail before repair. | Read generations guard both fetch and body completion, plus the existing one-time auth retry. Effect cleanup invalidates earlier lifecycle reads. |
| Saved | StrictMode's earlier mount read returns after a later mount read and a confirmed triage/removal. It restores the old decision or removed row. Two probes fail before repair. | Earlier lifecycle reads cannot adopt state after their effect is cleaned up or a newer read begins. This is development/test effect replay evidence, not a claim of an observed production double mount. |
| Native Practice completion | Any HTTP 200 is accepted as persisted completion, including an empty body, `completed:false`, unrelated JSON, or HTML. Four invalid-response probes fail; the canonical `completed:true` control passes. | Require the completion route's actual `{ completed: true }` acknowledgement. Invalid/unreadable responses retain the existing error/retry path. |

The new read oracle is `src/components/app-shell/SupersededLaneReads.test.tsx`.
The acknowledgement oracle is appended to `arenaRoomActions.test.ts`.
Before-repair reports were recorded outside the source worktree while the
unchanged full baseline ran. No clinical data, router, reference, reward rule,
server ownership, or underlying learner record is changed by these repairs.

## Observed verification

The fresh full suite ran before any tracked edit with Node 20.20.2, one Vitest
worker, no inherited credentials, no application `.env`, no build, and no live
evaluation/seed/database opt-in variables. Its result is **15,595 passed / 152
failed / 409 pending**, 16,156 total, exit 1. There are **46 failed files total**:
45 have the 152 failed assertions; one cannot load because historical Git object
`e71b3c84` is unavailable. Exact normalized assertion names/messages and that suite
failure are in [baseline-normalized.json](release-flow-qa/baseline-normalized.json).
The raw report SHA-256 is
`6d29f1fdc24d24544114bb72a7ab689c37df079b506734405d0f818e4f09e74b`.

After repair, two disjoint focused runs pass **406/406 across 28 files**. They
cover the ten new failing-before probes, their canonical control, Saved gestures,
grouping and removal, Track mutation errors/source opening, Today overdue
dismissal, Teams navigation, Save/Track intent and ownership, Clinical assessment,
reference gating, lost acknowledgement/offline draft recovery, and Learning
Rewards evidence, caps, duplicate reconciliation, pending recovery and UI.
The baseline's `SavedForLaterSwipe` synchronization assertion passed on this
isolated rerun; no repair attribution is made for that difference.

Report summaries and raw hashes are in
[verification.json](release-flow-qa/verification.json). The complete suite has
not been rerun on this branch after repair. Its failing baseline remains a
release limit; a final integrated run must compare exact assertion identities,
not only failure counts. Browser, types, build and final integrated verification
are coordinated separately by the source owner.

## Existing legacy reward gates remain RED

These are separate from native Practice and the new Learning Rewards ledger.
Two synthetic, fully mocked route probes reproduce existing desired-invariant
failures, alongside ten passing authorization/business controls:

1. Repeating the same owned legacy `CHOICE_CONFIRMED` request invokes the private
   XP increment twice. The source SQL increment adds XP without an event receipt.
2. Beginner completion claims `DONE` before the weekly award. If that award fails,
   the initial request returns 500, but a retry returns stored completion success
   without retrying the award or saving the final reflection. Core award failure
   is also ignored by the current source path; that additional limit is source
   inspection, not a third executed failure probe.

The frozen desired-invariant fixtures are intentionally excluded from the normal
`src/` suite and remain reviewable through this explicit, credential-free command:

```sh
env -i PATH=/root/.npm/_npx/185e25162edaacfb/node_modules/node/bin:/usr/local/bin:/usr/bin:/bin \
  NODE_ENV=test CI=1 \
  /root/.npm/_npx/185e25162edaacfb/node_modules/node/bin/node \
  node_modules/vitest/vitest.mjs run --config scripts/release-flow-repro.config.ts \
  --maxWorkers=1 --minWorkers=1
```

Observed result: **10 controls pass / 2 desired invariants fail**, exit 1. No
live double-payment or controlled production completion was attempted. Current
live RPC privileges are recorded by the separate read-only catalog audit; the
older prelaunch document's pending-ACL wording is historical evidence, not proof
that authenticated EXECUTE is still granted.

Current source callers remain reachable in the legacy application:

| Caller | Use |
| --- | --- |
| `useArenaSession.ts` | Legacy choice fallback sends reward-bearing `CHOICE_CONFIRMED` through `postArenaEvent`; that helper catches errors while the caller continues its local XP display. |
| `bty-arena/beginner/page.tsx` | Calls Beginner completion; `useArenaSession` redirects eligible users to this route. |
| `BtyArenaRunPageClient.tsx` | Sends `JSON_SCENARIO_DECISION_COMPLETED` with zero XP through the event route. |
| `PracticeLanding` → `ArenaRoom` | Native published Practice explicitly awards zero legacy XP and uses the repaired completion acknowledgement. |

A reliable legacy repair needs an atomic server-owned receipt and award transaction
keyed by the owned run/reward source, with one replayable result and recoverable
partial failure. Read-before-write checks or moving the current writes cannot
guarantee concurrent retries. An additive reviewed service-only RPC/receipt is
the bounded option; it needs separate schema and historical-partial-state design.
This audit does not add a migration, infer missing historical awards, replay learner
records, or silently disable the reachable legacy flows.
