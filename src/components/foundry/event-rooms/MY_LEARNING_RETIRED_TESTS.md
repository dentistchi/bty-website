# Retired My Learning card tests — Slice My Learning Simplification (2026-09-22)

Five test files were removed with this slice. Each existed to pin a block that the Founder's
device review removed from the My Learning **list**, which now shows only a training title, its
completion date, and a door:

| file | what it pinned |
|---|---|
| `FoundryMyLearning.test.tsx` | the Shared Understanding block, the "no shared understanding" note, and the in-list reflection link |
| `FoundryMyLearning.semantics.test.tsx` | which prose section rendered from which source, and the DECIDED chip |
| `FoundryMyLearning.evidence.test.tsx` | the "Since this training" evidence-rung strip |
| `FoundryMyLearning.checkInAgain.test.tsx` | the in-list "Check in again" button |
| `FoundryMyLearning.openFollowUp.test.tsx` | the in-list unanswered-follow-up button |

**The behaviour that survived is still covered, in its new home.** The follow-up loop was NOT
removed — `canCheckInAgain` concerns a SETTLED obligation and the domain states it belongs to My
Learning, while Today shows only PENDING ones, so deleting the buttons would have stranded a live
NOT_YET → APPLIED loop. Both doors moved onto the training's own screen and are covered by:

* `FoundryTrainingDetail.test.tsx` — "the follow-up loop survives the list simplification"
* `BtyDailyAppShell.checkInAgain.test.tsx` — **retargeted, not retired**: it still walks
  Learn → My Learning → the follow-up end to end, now through one more tap.
* `noBrowserEscape.guard.test.ts` — follows the Center reflection link to its new location.

What is genuinely gone, by product decision, is the *presentation* of shared understanding, the
decision text, the evidence rungs and the score **in the list**. Those assertions were retired
rather than moved because the surface they described no longer exists.
