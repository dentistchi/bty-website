# Teams announcement tracking V1

## Audit and compatibility

Base: `b20e715a1650c911ed97fe5d9269dfa52cfeeba8` (`origin/inner-main`).
Work is isolated on `feat/teams-announcement-tracking-v1`. Production is not changed.

- Manifest 1.0.13's `trackWithBty` used `context: ["message"]`, `fetchTask: true` and title `Track`.
- The verified invoke route authenticates first, parses source/identity, then opens the dialog on fetchTask. Submit calls `trackAnnouncement` after server-resolved identity and collaboration-participant checks.
- The previous dialog submitted framing and selected Entra object IDs without a mode. Successful submissions already returned `task.continue`; several refusal paths returned a compose-extension message, invisible in the reported iPhone experiment.
- Before the release fixes, `trackAnnouncement` ensured a capture with `intent: "track_source"`, then called the atomic `bty_track_announcement`. This left a capture behind on a rejected audience; V1 now uses one transaction for all three records. Track never stamps `saved_at`; a previously saved capture is reused without clearing it. Save remains private to the caller's Today.
- The database excludes every Microsoft identity belonging to the host. Self-only selection raises `zero_recipients`. The frozen recipient set, unique owner/source and announcement/tenant/object constraints already exist.
- Legacy `response` is `ACKNOWLEDGED`, `QUESTION` or `HELP_NEEDED`. **All three stamp the old `responded_at`.** It does not mean a required answer was submitted. Thread messages and per-message read receipts concern private BTY conversations, not Teams channel reads or announcement completion.
- Thread/recipient RPCs resolve authority from the actor and bound recipient. Existing table RLS, RPC grants, host-deletion retention and private thread isolation remain intact.
- Legacy `NeedsYourResponse`/`TrackingSent` use conversation outcomes and personal Today dismissals. The native 08:00 reminder previously counted brief reminders/follow-ups, excluding this independently fetched lane.
- Read-only production audit: 11 announcements, 11 recipients; 2 acknowledgments, 5 questions, 1 help request, 3 unanswered. No message bodies, names, tokens or directory IDs were fetched for this audit.

The existing rows therefore remain **NULL mode (legacy conversation)**. Neither acknowledgment mode nor response mode is a truthful default for that mixed history. No historical evidence is inferred/backfilled. A new-mode retry against an already tracked legacy source returns that existing run without conversion.

## V1 behavior

The menu is `Track announcement` / `공지 추적` in package 1.0.14. The dialog requires an explicit `acknowledgment` or `response` choice; no preselected fallback. Both languages are supported by the card and packaged manifest localization. Stale open dialogs without a mode get a visible refusal and must be reopened.

- Targeted means a frozen audience row exists. New V1 recipients must resolve to canonical users in the invoke tenant with an active membership in the actor’s active primary BTY organization. The whole selection is refused if any non-self recipient is malformed, unresolved, inactive or outside that organization. Legacy unbound rows remain in their original denominator.
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


## Verification

Release-fix gates use Node 25.9.0 and `NODE_OPTIONS=--no-experimental-webstorage` for Vitest.

- Focused including Save: 841 passed, 0 failed; 87 environment-gated tests skipped. PostgreSQL: 23/23 passed separately on a disposable localhost-only database.
- Rejection tests compare all seven related table counts before/after: captures, announcements, recipients, thread messages, thread reads, personal dismissals and tenant routes. Self-only, empty, malformed, unresolved, inactive, revoked, cross-tenant, cross-org, invalid mode, missing source and nine-valid/one-invalid selections have zero delta. An injected recipient insert failure also rolls the capture and announcement back.
- The synthetic eleven-row legacy fixture is byte-identical before/after migration replay. New completion dual-writes the old disposition/timestamp and the recipient dismissal version; the unchanged previous Worker Today selector hides completed cards. Opening alone remains pending in both versions. A later host conversation message can resurface a card under the old conversation contract.
- All six mutations were killed: opened-as-complete (8 failing tests), legacy responded_at fallback (3), self exclusion removed at both validation layers (4), idempotency guard removed (2), silent zero-audience response (2), reversed reminder rule (6). Every mutation was restored in an isolated scratch copy.
- TypeScript, production build, `cf:build`, Teams ZIP and official v1.25 manifest/localization schemas pass. Builds use placeholder configuration without production credentials.
- Supabase production advisors retain their baseline category/counts; the migration is NOT applied there. Local catalog/RPC tests verify client-deny tables and service-only function execution. This is not a claim that post-migration production advisors have run.
- Full unit against fresh `origin/inner-main` b20e715a: base 14,337 passed / 129 failed / 336 skipped; branch 14,378 passed / 129 failed / 359 skipped. Exact failing assertion sets and failed-file sets match: zero new failures. Both commands exit 1 for the existing baseline failures.
- Shared dirty checkout status/content hashes and local main are unchanged.

Automated coverage includes:

- fetchTask, both mode choices, server parsing, zero/self-only visible cards, Save transport unchanged;
- isolated real PostgreSQL: migration replay, ten recipients, self exclusion, eight concurrent retries, immutable mode/audience, no inferred legacy evidence, ownership and role grants;
- explicit open/ack/answer semantics, both languages, ten-person dashboard and privacy whitelist;
- mode completion removes Today open work and cancels the native 08:00 reminder; Teams/browser/native regression suites;
- TypeScript, optimized production build (placeholder build-only configuration; no production credentials), manifest/ZIP checks and full unit comparison against the untouched base.

## Authorization and transaction boundary

The Bot Framework verifier runs before the body is parsed. The existing invoke identity resolver establishes the actor; the creation RPC repeats that actor check and calls the same `bty_resolve_user_from_microsoft_identity(tenant, oid)` for each selected recipient. Its authority is Azure `auth.identities.identity_data.custom_claims.tid/oid`, never user metadata, email, UPN or display name. Active `bty_org_memberships` and the actor’s active primary organization form the organization boundary; membership/organization share locks span validation and creation. Canonical users are bound at creation, and self is excluded by resolved user identity.

The service-only SECURITY DEFINER creation RPC has a fixed search_path and revokes PUBLIC/anon/authenticated execution. The existing filename is retained, and the legacy RPC is not changed. Source capture, announcement, mode and all bound recipients commit or roll back together. Track requests never pre-save tenant routing; the validated routing coordinate is stored with the new announcement. Save retains its original writer and semantics.

## iPhone acceptance after approved deployment

1. Install package 1.0.14. Verify the English/Korean menu and fetchTask dialog. Save a source independently and confirm it still belongs only to your Today.
2. Submit empty/self-only audience. Confirm the visible card says `추적할 다른 사람을 한 명 이상 선택하세요.`; no announcement/recipient is created. Capture, announcement, recipient, thread/read, dismissal and routing row counts must be unchanged.
3. Choose ten **other active BTY users in the same organization** and acknowledgment mode. Verify denominator ten, ten audience rows, no host. Repeat submission; verify the same run/audience and existing-run confirmation.
4. A recipient opens in BTY: opened increases, remaining does not decrease. Tap acknowledgment: acknowledged increases, remaining decreases, their Today card disappears.
5. Use another source for response mode. Opening must not complete it; no acknowledgment shortcut is offered. Submit a written answer: responded increases, answer is visible only to the host, card leaves Today.
6. Verify original Teams source links in Teams, browser and native shell. With no other work pending, completed items must not keep the 08:00 local reminder scheduled; pending items must.
7. Inspect the legacy 11 runs, old private conversations and Save behavior. Do not reinterpret their old response timestamps as new evidence.

Real iPhone rendering is a deployment-time gate, not claimed by unit tests or the production build.

Rollback: keep the additive schema and every recorded evidence row. Deploy a reviewed compatibility Worker or a previous Worker validated against completion shadows. Production column drops are prohibited, even before the first V1 row. Migration first, Worker second.

The creation RPC validates tenant+OID using the canonical Microsoft resolver, and active BTY organization membership before writing. Capture, announcement and bound recipients commit together. No partial audience is accepted. Actual acknowledgment/response dual-write legacy responded_at and a legacy disposition plus recipient Today dismissal; these are rollback shadows, never new response completion evidence. The persisted V1 mode `response` means response required; `acknowledgment` means acknowledgment required.
