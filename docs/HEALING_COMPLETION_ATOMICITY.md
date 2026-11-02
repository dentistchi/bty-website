# Healing completion persistence contract

Source preparation only. `20261101000728_healing_awakening_atomic_completion.sql`
is **unapplied**. No production data, sessions, permissions or deployment were
changed by this verification.

Two existing success responses could outlive a failed required write: act 3 was
inserted before its milestone, and the ritual milestone was written before its
starter unlock. Both ignored the second write error. Two frozen regressions fail
on that split-write implementation and pass after private transaction delegation.

## Existing workflows remain separate

| Private service-role RPC | Existing completion effect |
| --- | --- |
| `bty_complete_healing_awakening_act(uuid, integer)` | Record the next act in 1–2–3 order; act 3 also records the milestone, with no starter grant |
| `bty_complete_second_awakening(uuid, text)` | Record the ritual milestone plus the server-derived optional PRM/SAG starter; it does not invent act records |

Both serialize with the same per-user transaction advisory lock, independently
verify exactly 28 distinct completed train days and current milestone state, and
commit every required write together. New timestamps use the clock after lock and
eligibility resolution; existing timestamps are never rewritten. Required
`RETURNING` values and stored postconditions reject trigger-suppressed writes.

The starter is still computed by `getSecondAwakening` and the existing stat/event
threshold rules. Milestone, train, stat and event read failures cannot be treated
as absent progress or empty unlock inputs. A healthy existing milestone can be
read/replayed without recomputing its completed eligibility or starter. Optional
session/day display computations keep their existing behavior.

## Acknowledgement and historical state

The server accepts only `healing-completion/v1` acknowledgements bound to the
operation and canonical user, with valid timestamps and exact act prefix or
bounded starter fields. No missing-RPC, unavailable writer, transport failure or
malformed HTTP success falls back to owner-client writes.

- Existing healthy act duplicates remain `409 ACT_ALREADY_COMPLETED`. The UI can
  reload canonical progress, as it did before.
- Healthy ritual repeats are read-only `200` with `idempotent: true`; the frozen
  milestone/starter is returned, and no new unlock or timestamp is written.
- Three acts without a milestone, malformed act prefixes on a new write, or a
  claimed starter without its durable unlock require explicit review. Neither
  backfill nor inferred repair is performed.
- Combined Healing/Awakening reads and the standalone progress read return a
  dedicated review response for the known partial state. They must not display
  Phase I plus all-acts-complete, or a healthy completed ritual with a missing
  claimed starter. Authoritative read outages are unavailable `500`, not zero.
- The independent ritual workflow's healthy milestone remains valid even when
  legacy act history is non-prefix; it never depended on those three act records.

The public ritual response omits a null starter and carries a boolean
`idempotent`; review responses have the explicit
`HEALING_COMPLETION_REVIEW_REQUIRED` code. Client copy distinguishes review from
a genuine duplicate and from a retryable outage.

## Authority and rollout

Both SQL functions are `SECURITY INVOKER`, use an empty search path and permit only
`service_role` execution. Routes authenticate and require current consent before
invocation; actor IDs and derived starter choices never come from request bodies.
Owner reads/RLS remain. Owner-client writes to acts/milestones are revoked because
the two audited application writers now use these private functions. Existing
advanced-stat grant writers outside these completion paths keep their ACLs; a
pre-existing requested starter without a milestone is review-required, never
silently overwritten or regranted.

Applying the reviewed migration and deploying remain separate operations. Fence
both old completion endpoints and all domain/worker/version aliases, and prove
old split writers cannot finish before the new writes resume. Missing RPCs fail
closed with `503`; no fixed sleep or 100% deployment alone proves drain.

## Verification scope

The final service/API/follow-up suite reports 165/165 across 15 files. Frozen
before results include two split-write false-success failures, three unavailable
milestone failures, three unavailable train/stat/event failures, three partial
completion read failures and four claimed-starter read inconsistencies. Five independent read-review probes
additionally reject non-prefix history in act-progress serializers and a claimed
starter without a completion timestamp; the existing pure history validator is
reused. These checks do not invalidate a healthy independent ritual milestone.

Independent SQL verification applies the exact migration to isolated PostgreSQL
fixtures. PGlite semantics cover 52 checks, including rollback/suppressed writes,
service-only ACLs, owner read preservation, historical review and frozen replay.
Integration CI subsequently observed **58/58 native PostgreSQL17.11 checks**,
including all six independent-backend race groups with distinct backend IDs and
observed SQL lock waits. [Run 41258285658](https://github.com/dentistchi/bty-website/actions/runs/41258285658)
used source `5d287b4f`; [the native receipt](release-reliability/native-healing.json)
has an empty `unrun` list. Neither fixture is the full production Supabase
migration stack. Current SQL SHA256 is
`d1d9f2cc68ad36cbad0bcd1494091bfb5fe91c1d136e5c97c4429ccdd0a89d6f`.
