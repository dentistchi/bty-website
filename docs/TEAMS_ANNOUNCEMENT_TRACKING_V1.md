# Teams announcement tracking V1

## Audit and compatibility

Base: `b20e715a1650c911ed97fe5d9269dfa52cfeeba8` (`origin/inner-main`).
Work is isolated on `feat/teams-announcement-tracking-v1`. Production is not changed.

- Manifest 1.0.13's `trackWithBty` used `context: ["message"]`, `fetchTask: true` and title `Track`.
- The verified invoke route authenticates first, parses source/identity, then opens the dialog on fetchTask. Submit calls `trackAnnouncement` after server-resolved identity and collaboration-participant checks.
- The previous dialog submitted framing and selected Entra object IDs without a mode. Successful submissions already returned `task.continue`; several refusal paths returned a compose-extension message, invisible in the reported iPhone experiment.
- `trackAnnouncement` ensures a capture with `intent: "track_source"`, then calls the atomic `bty_track_announcement`. Track never stamps `saved_at`; a previously saved capture is reused without clearing it. Save remains private to the caller's Today.
- The database excludes every Microsoft identity belonging to the host. Self-only selection raises `zero_recipients`. The frozen recipient set, unique owner/source and announcement/tenant/object constraints already exist.
- Legacy `response` is `ACKNOWLEDGED`, `QUESTION` or `HELP_NEEDED`. **All three stamp the old `responded_at`.** It does not mean a required answer was submitted. Thread messages and per-message read receipts concern private BTY conversations, not Teams channel reads or announcement completion.
- Thread/recipient RPCs resolve authority from the actor and bound recipient. Existing table RLS, RPC grants, host-deletion retention and private thread isolation remain intact.
- Legacy `NeedsYourResponse`/`TrackingSent` use conversation outcomes and personal Today dismissals. The native 08:00 reminder previously counted brief reminders/follow-ups, excluding this independently fetched lane.
- Read-only production audit: 11 announcements, 11 recipients; 2 acknowledgments, 5 questions, 1 help request, 3 unanswered. No message bodies, names, tokens or directory IDs were fetched for this audit.

The existing rows therefore remain **NULL mode (legacy conversation)**. Neither acknowledgment mode nor response mode is a truthful default for that mixed history. No historical evidence is inferred/backfilled. A new-mode retry against an already tracked legacy source returns that existing run without conversion.

## V1 behavior

The menu is `Track announcement` / `공지 추적` in package 1.0.14. The dialog requires an explicit `acknowledgment` or `response` choice; no preselected fallback. Both languages are supported by the card and packaged manifest localization. Stale open dialogs without a mode get a visible refusal and must be reopened.

- Targeted means a frozen audience row exists. Unbound people still count in the denominator and appear as numbered recipients if no trusted display name exists.
- `opened_at` is written by the explicit **Open announcement** action in BTY. Fetching Today, opening a Teams source or reading a private thread cannot stamp it.
- `acknowledged_at` is written only by the acknowledgment action in acknowledgment mode.
- Required written-answer evidence uses **`response_submitted_at` + `response_text`**. It is exposed as `responseSubmittedAt` and the dashboard's response-completed count. The separate name preserves legacy `responded_at` rather than silently changing its meaning.
- Opening is never completion. Acknowledgment mode completes only on acknowledgment; response mode only on a nonblank answer (1–1000 characters). Wrong-mode actions fail closed. Evidence is write-once across retries.
- Host counts targeted/opened/acknowledged/responded/remaining come from the same facts as person-level status. No acknowledgment evidence is not a claim that somebody has not read the Teams message.
- New-mode completed cards leave recipient Today and appear in the existing Past partition. Only pending new-mode cards add to the common open-work selector and 08:00 reminder. Legacy behavior is preserved.
- New source links use the existing Teams/browser/native source opener. A source link grants no access to the original message; Teams remains its access authority.
- Self-only/zero-audience errors and successful/repeated submissions return an Adaptive Card in `task.continue`. Repeated creation is serialized per owner/source before the original atomic RPC. It never changes the original audience or mode.

Microsoft documents that bot read receipts do not support team/channel/group scopes:
https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/conversation-basics#receive-a-read-receipt

The remaining `unread` identifiers and notification labels describe actual private BTY thread-message receipts or notification `is_read` accounting; they are not Teams read states and are not used for V1 completion. New UI says `No acknowledgment evidence` / `확인 증거 없음`.

## Migration and rollout gate

**Production migration required; NOT applied by this PR.**
`20260927051100_announcement_tracking_modes_v1.sql` adds one nullable mode column and four recipient evidence columns, plus two service-only RPCs. No existing rows are updated, no old RPC is replaced, and no new client table/RPC grants are added. It is ordered after the current migration tip and idempotent. Existing RLS stays enabled.

After SQL/application review and explicit operational approval:

1. Verify the canonical existing `bty_track_announcement(uuid,uuid,text,text,text,text,text[])` signature and migration history. The older repository history has a known parameter-order discrepancy; the existing local PG harness explicitly reconciles to production before testing newer migrations. Do not blindly replay unrelated pending migrations in production.
2. Apply only the reviewed migration, then verify columns, grants, constraints and legacy row counts without reading message contents.
3. Deploy reviewed code, then distribute/reinstall package 1.0.14. Do not distribute the new dialog before database support exists.
4. Run the device acceptance below, then review aggregate counts only.

Rollback before any V1 rows: restore prior application/package, then in an approved maintenance transaction drop the two **new** RPC signatures and five **new** columns/constraints. Never drop old tables/functions.
Rollback after any V1 row/evidence exists: retain additive schema and evidence; stop distribution of the new package and prefer a forward fix. Do not drop evidence or blindly restore an old app that interprets V1 rows as legacy. An application rollback needs a reviewed compatibility patch that preserves the V1 reader/completion rules. No destructive rollback or production action is included here.

## Verification

Final local gates (Node 25.9.0, `NODE_OPTIONS=--no-experimental-webstorage` for Vitest):

- Focused: 794 passed, 0 failed, 71 environment-gated tests skipped (865 total). The seven new PostgreSQL tests were run separately with a localhost-only database and all passed.
- Full unit comparison against `b20e715a`: base 14,337 passed / 129 failed / 336 skipped (14,802 total); branch 14,370 passed / 129 failed / 343 skipped (14,842 total). Exact failing assertion sets and failing file sets match: **0 new failures, 0 new failing files**. Both commands exit 1 because the pre-existing failures remain. Examples include absent historical `.eval-artifacts`, existing authorization fixtures, and stale repository-wide migration guards. Both runs used `env -i` with Node 25.9.0 and `vitest run --maxWorkers=4 --minWorkers=1`; production credentials were absent.
- Local migration applied twice; RPC concurrency/authorization and existing table RLS/client privilege checks passed.
- `npx tsc --noEmit`: exit 0. `npm run build`: exit 0 using build-only placeholder Supabase configuration, without production credentials.
- `node teams/package.mjs`: exit 0. Packaged manifest and Korean localization validated against Microsoft's v1.25 schemas. ZIP contains the manifest, both original icons, and `ko.json`.
- Shared checkout: status and content hashes match the pre-work snapshot; its HEAD and local main are unchanged. No other existing worktree was edited or removed.

Automated coverage includes:

- fetchTask, both mode choices, server parsing, zero/self-only visible cards, Save transport unchanged;
- isolated real PostgreSQL: migration replay, ten recipients, self exclusion, eight concurrent retries, immutable mode/audience, no inferred legacy evidence, ownership and role grants;
- explicit open/ack/answer semantics, both languages, ten-person dashboard and privacy whitelist;
- mode completion removes Today open work and cancels the native 08:00 reminder; Teams/browser/native regression suites;
- TypeScript, optimized production build (placeholder build-only configuration; no production credentials), manifest/ZIP checks and full unit comparison against the untouched base.

## iPhone acceptance after approved deployment

1. Install package 1.0.14. Verify the English/Korean menu and fetchTask dialog. Save a source independently and confirm it still belongs only to your Today.
2. Submit empty/self-only audience. Confirm the visible card says `추적할 다른 사람을 한 명 이상 선택하세요.`; no announcement/recipient is created. The idempotent source capture may already exist; it is not a Track or a saved item.
3. Choose ten **other** recipients and acknowledgment mode. Verify denominator ten, ten audience rows, no host. Repeat submission; verify the same run/audience and existing-run confirmation.
4. A recipient opens in BTY: opened increases, remaining does not decrease. Tap acknowledgment: acknowledged increases, remaining decreases, their Today card disappears.
5. Use another source for response mode. Opening must not complete it; no acknowledgment shortcut is offered. Submit a written answer: responded increases, answer is visible only to the host, card leaves Today.
6. Verify original Teams source links in Teams, browser and native shell. With no other work pending, completed items must not keep the 08:00 local reminder scheduled; pending items must.
7. Inspect the legacy 11 runs, old private conversations and Save behavior. Do not reinterpret their old response timestamps as new evidence.

Real iPhone rendering is a deployment-time gate, not claimed by unit tests or the production build.
