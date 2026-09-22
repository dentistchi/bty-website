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
| `FoundryMyLearning.reviewedPlans.test.tsx` | the "Reviewed action plans" section (retired in the follow-up cleanup) |

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

## Follow-up cleanup (same day)

`reviewed-plans` was removed from the learner surface as well. It was a **Host-workflow artefact** —
"Reviewed action plans", carrying module versions and who/what/how/when rows — sitting under a list
whose job is to answer *"what have I completed"*. Reviewing is something that happens **to** a plan,
and naming that state here made a learner read an internal workflow label to find their own
learning.

It was deliberately **not renamed** into a learner-facing section: there is no measured need for a
distinct learner concept there, and inventing one would be a new product idea rather than the
removal that was asked for. **The `/api/bty/action-contract/reviewed-plans` API is untouched.**

After this cleanup the component fetches exactly one endpoint (`/api/bty/foundry/history`) and
renders exactly one thing per row: a title, a completion date, and a door.
