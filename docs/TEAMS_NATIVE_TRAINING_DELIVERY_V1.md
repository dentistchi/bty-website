# Teams-Native Training Delivery V1

## The boundary this fixes

A Host created training inside the BTY Teams app, but sharing handed the learner a public web URL (`/f/<token>`). On Teams mobile that is a "Link not supported" dialog or a jump into Safari, so the learner arrived in a browser with no Teams identity: they joined anonymously, and were asked to sign in with Google *after* finishing. The training was never the problem — the delivery was.

## The contract

Host in Teams → **Send in Teams** → Teams people picker → Teams chat opens with a prefilled invitation → Host presses Send → learner taps it → the **BTY personal tab** opens inside Teams → Teams SSO establishes identity silently → the training opens **in the tab** → study → quiz → score → completion. No browser handoff, no Google login, and XP attribution is already known.

Public QR / `/f/<token>` / anonymous participation / deferred XP claim remain, unchanged, as the fallback for external participants.

## Host side

`pages.shareDeepLink` and `teams.microsoft.com/share` are documented as unsupported on Teams mobile and are no longer used inside the tab. Instead:

- `people.isSupported()` → `people.selectPeople({ openOrgWideSearchInChatOrChannel: true, singleSelect: false })` — org-wide because a personal app scope has no roster to scope to; multi-select because assigning one training to a shift is the ordinary case.
- `chat.isSupported()` → `chat.openChat` (one person) / `chat.openGroupChat` (several), with the invitation **drafted**. BTY never sends as the Host. That also avoids a proactive-bot installation dependency.
- Every unsupported/failed path copies the **personal-tab deep link**, never the raw web URL.

**Identity vs transport.** `objectId` (Entra oid) is the coordinate. `email`/UPN is a *chat address* used only to open a conversation. `displayName` is presentation. `readTeamsSelection` keeps the three separate and drops anyone with no Entra id.

## Deep link

```
https://teams.microsoft.com/l/entity/374ec662-0deb-4e0b-8514-e38a035a349e/btyHome
  ?webUrl=<origin>/teams&label=<title>&context={"subEntityId":"foundry-training:<room token>"}&openInMeeting=false
```

`webUrl` is the **tab**, never `/f/<token>` — an old client that falls back must not land in the browser room. The target payload is the existing signed Foundry room token, so no database id is published.

**The grammar is the security boundary.** `parseTrainingTarget` admits exactly `foundry-training:<btyfr1.…>` and nothing else — no path, origin, query, route, event id or user. A forged `subPageId` can at most *name* a room; admission is still the signed token plus the server's own authorization.

## Learner side

`TeamsTabShell` reads `context.page.subPageId` (falling back to `subEntityId`) **after** the Teams bootstrap succeeds, parses it, and hands the shell `initialTrainingTarget`, which the shell commits in a lazy state initialiser so the training is on the first paint. The document stays `/teams` throughout: no `app.openLink`, no navigation.

`InShellLearnerRoom` then renders the **existing** learner clients — `FoundryJoinClient` (video), `FoundryDocumentClient` (PDF), `FoundryGuidanceClient` (text). One runtime, one quiz engine, one completion path; the web door and the Teams door differ only in how the room is opened.

## Participant identity

The public room recognises a learner by a per-event HttpOnly cookie. `/teams` is a third-party browsing context where that cookie cannot be relied upon — so for this path identity comes from the **session**, and the participant is resolved by `(event, canonical user)`.

`POST /api/bty/foundry/teams/room/open` takes only `{ target }`, derives the user server-side (cookie or the tab's bearer), and find-or-creates the participant. It returns the participant session token, which the client holds **in memory** and presents on the existing public endpoints via `X-BTY-Foundry-Participant` (cookie still wins wherever it exists).

**No migration.** `foundry_event_participants` has no `unique (event_id, user_id)` — and must not, because the web path is deliberately allowed one participant per device. Instead the account-backed session token is **derived**: `HMAC-SHA256(FOUNDRY_ROOM_QR_SECRET, "v1:<eventId>:<userId>")`. Its hash is a deterministic function of (event, user), and the table already carries `unique (participant_session_token_hash)` — so the database itself makes the open idempotent and atomic under concurrency, and a second device resolves the same participant. The anonymous path keeps minting random tokens and is untouched.

QR rotation keeps its meaning: a returning account is admitted after a rotation (as on the public path), a **new** participant is not.

## Display name

Resolved server-side from `auth.identities.identity_data` (provider-written, not account-editable) via the existing `resolveDisplayNames`. Presentation only, never identity, never accepted from a client. No name available → an honest generic label, never an email or an id.

## Completion

The participant is account-bound and the tab's transport carries the Supabase bearer, so the existing public completion/quiz-submit routes resolve the canonical user and `finalizeCanonicalTrainingCompletion` awards Core XP **directly**. No deferred claim is issued, which is what removes the "Save my XP" / sign-in CTA. The terminal's exit is an in-shell button back to Learn — an anchor would be sent to a real browser by the frame guard.

## Manifest

**No change.** The manifest already carries the `btyHome` personal tab, `identity` permission, `webApplicationInfo` and bot scopes. **No new Entra permission**: TeamsJS `people`/`chat` are host capabilities, not Graph scopes, and must not be replaced by Graph permission widening.
