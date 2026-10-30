# App prelaunch reliability repair — 2026-10-30

Dr. Chi reported that overdue test training would not disappear and Track/Save
was unreliable. The repair adds repeatable regression and isolated screen checks
around the actual services and components, and examines the wider main app flow.
It is prepared on `fix/app-prelaunch-reliability` from `inner-main` PR82
`4c0ba329b0ad315c52f315364cf6cbe92cf54d7e`. Clinical QA PR84 remains separate.

## Product changes

| Area | Observed defect | Resulting behavior |
|---|---|---|
| Save | Failed stamp/restore UPDATE returned success | Confirm active Saved membership; report failed writes |
| Save + Track | Concurrent Track insert winner lost Save intent | Reconcile Save on the same canonical row, preserve source identity |
| Saved triage | Track-only/removed items could receive stale Soon/Later | Require active Saved membership in both UPDATE and reread |
| Overdue | Personal removal of closed training was ignored by Today | Apply the same owner-scoped dismissal to closed-training attention |
| Overdue | No removal action in the Today row | Closed rows offer explicit personal Remove; open rows explain close-first |
| Today | Tab reselect did not reload the brief | Honor refreshKey and cancel superseded reads; refresh after removal |
| Today | Caught-up claim appeared above outstanding team follow-ups | Show the measured team-follow-up message |
| Tracking | Remove/Handle failures were silent | Preserve the item and display an error for HTTP/transport/body failure |
| Teams source | Track source still used a new-window anchor | Reuse the same Teams-safe source opener as Saved |
| Action plans | Child submission/review returned to stale inventories | Reread canonical learner/reviewer state; suppress late responses |
| Teams resume | Focus could arrive before ready listeners were registered | Install the same gated listeners in the layout commit before the host-ready handshake |
| Teams navigation | Today changed /teams to frame-denied /en/app | Preserve the Teams document path and carry the target query |
| Teams sign-in | Optional directory-binding throw aborted a valid SSO | Retain verified identity/session; fail soft only for the optional binding |
| XP | Client-provided deltas and directly executable privileged RPCs | Calculate legacy choice reward on server and use a private writer |
| Beginner XP | Repeated/concurrent completion could pay again | Reuse stored completed feedback and claim the owned active run once |

Removal is personal projection state. No training, participant, response, deadline,
PENDING follow-up or clinical learner event is deleted or marked complete.
The existing dismissal endpoint independently rechecks ownership and CLOSED state.
No new removal endpoint or schema is needed for Today cleanup.

## Read-only production observations

The two screenshot titles were matched through follow-up source titles: one
training is CLOSED and one is OPEN; neither has a personal dismissal. Thus the
specific rows were not observed to have been successfully removed already. The
closed-dismissal/Today disconnect was independently reproduced with the actual
service and an in-memory database. The new closed-row button addresses its missing
entry point. An OPEN training requires an explicit End training/Manage transition;
this change does not silently end a shared session.

Live schema and the Track RPC signature were inspected without mutation. The Track
signature matches its seven named application arguments. Save/triage columns exist
and service_role has UPDATE access. Query logs in the inspected window showed no
Postgres error; that does not establish the cause of every reported live attempt.
No signed-in browser could be attached in this execution context, so the caller's
actual Teams Save/Track attempt was not replayed live.

## XP authorization change: pending migration

Live privilege inspection confirms that both `increment_arena_xp(uuid,uuid,integer)`
and `increment_weekly_xp(uuid,uuid,integer)` are SECURITY DEFINER, permit
`authenticated` execution, and accept supplied user IDs/deltas without an auth.uid
ownership check. Anonymous access is already denied. They are existing authenticated
SSR callers too, so revoking authenticated alone would break legitimate requests.

The seven application call sites now send ONLY these privileged XP RPCs through
getSupabaseAdmin after existing auth/ownership and business validation; their other
reads/writes retain the user client. `/api/arena/event` derives legacy choice XP and
deltas from the bundled server catalog, ignores caller rewards on non-reward events,
and refuses a mismatched run/scenario or unavailable private writer before capture.
Missing private writer is checked before new run-completion writes as well.

Prepared with Supabase CLI 2.83.0 `migration new`:

`supabase/migrations/20261030175508_restrict_xp_writes_to_server.sql`

It revokes EXECUTE on exactly the two signatures from PUBLIC/anon/authenticated,
retains service_role execution, changes no function body, and writes no learner row.
It is idempotent SQL. **It has not been applied or locally executed against Postgres.**

Rollout requires the application change AND migration. Deploy the server callers
first while the old grants still work, then apply the reviewed permission migration,
then re-read both ACLs and verify authenticated denial/service-role success using
safe controlled QA. The normal deployment wrapper does not run migrations.
An app deployment alone leaves the direct-RPC authorization issue open.

The XP system is not certified as fraud-proof: existing legacy same-run reward
replay and non-atomic partial-failure recovery remain outside this bounded repair.
The Beginner CAS prevents two completion requests from awarding twice, but a
reward failure after the completion claim is not an atomic retryable transaction.
These limits must remain visible in the public-release decision.

## Verification

Application source tree: `b4dcf55d75d4209941099148a3ff400fbb0eb38a` (tested bytes
matched the staged tree and uploaded blobs exactly). Final evidence includes a
subsequent test-only synchronization correction and this report.

- New regression assertions: **41/41 passed** in the complete run.
- Final focused rerun: **48/48 passed** (Save/triage, Today, Teams bootstrap/resume,
  learner refusal messages and the XP security cases).
- Isolated browser tests: **38/38 passed**, including 10 new Today/Track/Saved flows
  at 390/1280px and 28 existing Practice/Clinical geometry/flow checks at their
  configured 320/390/1280px sizes. This is synthetic UI evidence, not live storage.
- TypeScript: exit 0, --noEmit --incremental false, 6 GiB Node heap. The final
  Cloudflare build also performs type validation; the final separate type command
  was run against the built tree.
- `cf:build`: exit 0. Artifact guard: 3,624 JS files, 0 unsafe matches, 2/2 safe
  middleware implementations. Client scan details are in the evidence notes below.
- Complete suite with the same Node/PATH/workers: baseline **15,085 passed /
  149 failed / 409 pending**, final full run **15,129 passed / 146 failed /
  409 pending** (15,684 total). Five former Teams-bootstrap failures resolved.
  Two additional full-run failures were learner refusal tests that asserted final
  text as soon as the loading gate existed. The production learner component is
  unchanged; the tests now wait for the same final text. The final 48-test rerun
  passes. **The entire suite was not rerun after that test-only correction.**
  The remaining 144 full-run failures match baseline assertion IDs. No repository
  green/public-ready claim is made.

The initially intermittent Teams resume failure was treated as a product issue.
A deterministic child-ready focus reproduction failed on the original listener
order (1 failed / 12 passed), then passed 13/13 after layout registration. It is
not discarded as a timing flake. Bootstrap/token calls remain one each.

Full-run summary, failed assertion IDs, exact raw report hashes and test-correction
provenance are preserved under `docs/prelaunch-qa/`. Raw complete test JSON remains
in the execution scratch outputs. The evidence identifies unavailable environment
checks and stale mocks; no failing assertions were removed or relaxed.

The new tests use real production functions/components with synthetic, stateful
transports. The browser suite uses actual TodayHome/SavedForLater/TrackingSent
bundles at 390 and 1280px. It blocks external network and checks removal across a
fresh mount, failure rollback/errors and Today reselect. It creates no app server,
auth session, production message, training event or database row.

Run isolated screens with:

```sh
PLAYWRIGHT_SKIP_GLOBAL_SETUP=1 PLAYWRIGHT_NO_WEB_SERVER=1 \
  npx playwright test e2e/prelaunch.public.spec.ts --project=public --workers=1
```

The public-text scan checked 237 private case/reference prefixes across 1393 emitted text files and found 0 matches. It is a sample scan, not proof of every possible disclosure path.

The default Playwright global setup seeds a database; the flags are required for
this isolated run. Tests under the normal `src/` tree run with ordinary Vitest.

Environment: Node 20.20.2, lockfile unchanged. Full npm ci initially failed because
the Supabase CLI postinstall could not download its release binary. A cached,
offline npm ci --ignore-scripts installed real dependencies; build verification
uses a separate real directory copied from that exact install, not a symlink.
Supabase CLI local migration creation uses the already installed same-version
binary from the previous verified checkout. No framework/package upgrade is included.

TypeScript uses a 6 GiB Node heap. Builds use loopback Supabase placeholders and
no real API/service credentials. The existing unsupported-Next warning remains.

## Release limits

No merge, deployment, migration application, permission change, auth-session
creation, real Teams message, or learner-store write was performed. Actual iPhone,
Teams authentication/messaging and production persistence remain live acceptance
checks. The requested two training rows are still unchanged in production.

The complete repository suite has a recorded failing baseline. New feature checks
and a successful build do not turn the entire repository or public release green.
Old authority mocks, missing evaluation artifacts, sandbox CLI/socket restrictions
and static source guards are recorded rather than deleted or weakened.
