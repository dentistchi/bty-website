# Learning Rewards V1 — first application integration

## Product contract

Dr. Chi approved the navy/gold interactive rewards concept and requested implementation.
This change connects the first supported activities to real server-owned records; it does
not publish the feature, migrate production, convert old XP, or manufacture missing evidence.

Learning XP is participation in this program, not a clinical skill rating or job authority.
Legacy Arena Core XP, Weekly XP, ranking, Forge stage and their APIs stay separate. Nothing
historical is converted or credited. The policy activation timestamp is inserted once by the
reviewed migration, not reset on deployment, migration replay, or a learner's first Me visit.

| Activity | Learning XP | Required evidence |
| --- | ---: | --- |
| Learn | 10 | Owned completed training, content-specific exposure, and own-language completion response |
| Practice | 20 | Clinical Discovery assessment before reference release, followed by saved reference reaction |
| Revisit | 20 | Server-assigned distinct variant at least 72 hours after its baseline; no adapter yet |
| Follow-up | 10 | Due assigned checkpoint with its first immutable response audit |

Applied, Partly applied, Not yet and Blocked follow-ups count equally. A later check-in does
not move the original response into a new policy/day. Prior case exposure stays in clinical
traces for analysis but does not exclude a new qualifying post-activation practice completion.
Each case/version can receive Practice credit once in the new policy. Raw questions, original
answers, reference text, reflections and clinical interpretation remain unchanged.

The daily cap is one credit of each activity type per user BTY day, at most 60 XP. A capped
completion still records valid learning and advances eligible badges. Retry cannot claim it
on another day. Server locking, source identity, assignment/content/version uniqueness and
an atomic completion-plus-ledger transaction protect concurrent requests and partial failure.
The reward timezone is frozen at enrollment; a device timezone change cannot bypass the cap.

Weekly goal 60 XP is encouragement, not a requirement or penalty. Weekly XP is a date-filtered
sum of the permanent ledger: Monday 05:00 to next Monday 05:00 in the reward timezone, with
each local boundary independently converted across DST. Nothing resets the lifetime ledger.

Next-level cost is `min(60 × current level, 300)`, with no maximum level. Thresholds are
Level 2 = 60, 3 = 180, 4 = 360, 5 = 600, 6 = 900, 10 = 2,100, 20 = 5,100 and 50 = 14,100.
Milestones 5/10/20/50 have special presentation; Level 10/50 also have collection badges.
Badges and levels never award additional XP.

## Actual scope and evidence limits

All twelve badges have readable conditions and distinct circle/octagon/crest designs. Seven
can be earned from supported evidence: First Step, Four Learning Weeks, Clinical Explorer,
Follow-through, Thirty-day Return, Level 10 and Level 50. Earned badges may be featured.

Full Circle, A Second Look and Patient Conversations require explicit approved path/variant
assignments that the existing app does not supply. Shared Insight requires explicit sharing
consent, human review and Learning Brief adoption. Better Together requires frozen weekly
team rosters, leave exclusions and month participation snapshots. These five are honestly
unavailable, not zero-scored learner failures. Existing quiz-only learning lacks the approved
own-language response evidence and is not awarded Learn XP by this adapter.

Future team integration must retain the approved contract: one team IANA timezone; roster
fixed at weekly start; joining midweek counts next week; minimum five eligible people;
`ceil(0.8 × eligible members)` reach 60 XP; three qualifying weeks among the first four BTY
weeks beginning with the month's first Monday. A fifth week does not enlarge that denominator.
Response-pattern summaries separately require at least five valid responses. No automatic
raw-reflection sharing, nonparticipant names, ranking, HR decisions, spending or messages.

## Application behavior

- Me shows cumulative Learning XP, this week's progress, server-calculated level and badges.
- Signed-in successful Learn/Practice/Follow-up routes reconcile after canonical completion.
  Reward failure returns `learningRewards.status = pending`; saved learning stays successful.
- Entering or reselecting Me retries reconciliation. GET itself never grants rewards, enrolls,
  captures timezone, acknowledges achievements, or changes auth/session data.
- Server-persisted pending achievements survive completion-route awards and reconnects. Continue
  acknowledges only currently earned identifiers with an atomic union across devices. Replay is
  visual only and makes no reward request. Reduced motion shows a static final state.
- The UI distinguishes disabled, loading, proven zero, read failure and sync failure. Requests
  have a 15-second UI timeout and retry. Values are never recomputed in the browser.
- Existing Teams identity/auth flows are reused; no Google login or admin grant is introduced.

## Release sequence (not performed by implementation)

1. Review and merge the source PR targeting `inner-main`.
2. Rebuild and deploy through the existing source-identity wrapper with the reward flag unset.
3. Separately approve and apply only `20261030221620_learning_rewards_v1_atomic_ledger.sql`.
4. Enable the server-only `LEARNING_REWARDS_ENABLED=1`; preserve existing flags and secrets.
5. Verify both source versions and authenticated read-only empty/earned projections. Only
   separately authorized controlled completion may create live learning/reward records.

The four new tables enable RLS and revoke client access. The three RPCs are service-only,
SECURITY INVOKER with fixed empty search paths. Service table rights are explicitly narrowed,
including removal of Supabase-style broad default grants. No service secret is sent to clients.
Migration replay preserves activation and data. Rollback first disables the flag; preserve the
ledger and original learning. Do not drop tables or edit legacy XP to clear the screen.

## Verification

See `docs/learning-rewards/verification.json` for observed command results and limits. Database
rehearsal is opt-in through `scripts/verify-learning-rewards-db.mjs`, which refuses any URL except
an explicit loopback database named `bty_learning_rewards_test`. It uses fictional identities,
not Supabase credentials. UI fixtures and SQL rehearsal are not production or actual Teams proof.
