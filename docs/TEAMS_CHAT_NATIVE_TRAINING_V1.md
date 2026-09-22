# Teams Chat-Native Text Training + Quiz — V1

## The product decision

BTY stops trying to make Teams iOS open a training through a personal-tab HTTPS deep link. Repeated real-iPhone evidence showed Teams iOS controls that handoff and does not reliably preserve the destination: the app opened, the training did not.

The normal **internal** path is now:

Host in the BTY Teams tab → **Send in Teams** → choose employees → **BTY's bot** sends each of them a training Adaptive Card → the employee reads the text and answers the quiz **inside that chat** → score and completion are written to the **same canonical Foundry/Quiz backend** → the Manager sees the same score in the existing Control Room.

No browser. No Safari. No Google login. No personal-tab training link required.

Public QR / `/f/<token>` / anonymous participation remains, unchanged, for external participants.

**V1 scope: TEXT + QUIZ only.** A video or PDF training is refused calmly at send time.

## Host delivery

The Teams People Picker is kept (`people.selectPeople`, org-wide, multi-select — a personal app scope has no roster to scope to). What follows it changed: there is no drafted chat message and no deep link. The Host sees *"Send this training to 3 people?"* and presses **Send**, which is what authorizes the bot notifications. Nothing is sent on selection alone.

Only the Entra **object ids** leave the browser. Email, UPN and display name never do, because the server derives everything it needs about a recipient from Graph.

## Recipient authority

Server-derived: the Host from the session, event ownership from the database, the tenant from configuration, eligibility from Microsoft Graph (`User.Read.All`, single-user read, no enumeration) — **same tenant, user exists, `accountEnabled`, `userType = Member`**. `displayName` is fetched for presentation only.

Never accepted from a payload: recipient email, UPN, BTY user id, tenant id, conversation id, service url.

## Verified routing

`bty_teams_tenant_routes` maps a tenant to the Bot Framework `serviceUrl` **observed on a verified activity**. Its only writer is the invoke route, after `verifyBotFrameworkToken()` succeeds and the existing strict `resolveServiceUrl` rules accept the value against the token's own claim — including on lifecycle traffic such as installation and conversation updates, which is the first traffic BTY sees from a new person.

No regional endpoint is hardcoded anywhere, and a test asserts the module contains none. A tenant with no observed route cannot be messaged; that is a refusal, not a prompt to guess.

The migration seeds the route from BTY's own already-verified history **only if** the evidence is unambiguous, and it re-proves that condition in SQL rather than trusting an out-of-band measurement.

## Conversation

Existing `bty_teams_conversation_refs` is reused when present. Otherwise the existing per-person lease (`bty_begin_teams_conversation_creation` → `mark_creating` → `createOneOnOneConversation` → `confirm`) creates exactly one, with its ambiguous-delivery semantics preserved: a create whose response was lost keeps the claim, so nothing makes a second thread, and the recipient is reported as not-yet-deliverable rather than retried.

"The app is not installed for this person" is carried through by name, because it is the one failure a Host can act on.

## Cards

One card evolves in place: read → question 1..N → completion. `Action.Execute` with the documented `Action.Submit` fallback carrying the same verb. Verbs are allow-listed (`btyTrainingRead`, `btyQuizAnswer`, `btyQuizResume`); anything else is refused.

A card's action data carries the **opaque delivery id** and the learner's own answer, and nothing else — no event id, user id, tenant, address, score, total or correct answer. Tests assert this on the card JSON itself.

## Identity

A Teams-chat learner is the **verified `(tenant_id, aad_object_id)`** of the activity. `foundry_event_participants` gains two nullable columns plus a **partial** unique index over `(event_id, microsoft_tenant_id, microsoft_aad_object_id)` where both are present — so Teams learners are one-per-training-per-person, and the anonymous web path (one participant per device) is untouched.

`user_id` is set when the resolver says `RESOLVED` and left NULL otherwise. **An employee with no BTY account can still read, answer, score and complete.**

## Completion and late binding

Scoring and completion go through `finalizeQuizAttempt` — extracted from `submitPublicQuiz` so the web room and the Teams chat settle a quiz through the **same** code. One immutable attempt, one canonical completion, one XP path. No score is ever accepted from a client.

If the learner has no BTY account, the completion and score are still real; only XP has nobody to belong to. When that same verified tuple later resolves to a canonical user at Microsoft sign-in, `bindTeamsTrainingParticipants` binds the unbound rows — never re-pointing one already bound to someone else — and re-runs the idempotent canonical finalizer so XP and the assignment claim settle once. No claim code, no Google login, no learner action, and a failure never blocks sign-in.

## Next product direction — NOT built in this mission

**Quiz review conversation.** A manager taps a factual score — `4 / 5 · 80%` — and is offered **"Review one missed question"**. The learner then receives a Teams-native review invitation and BTY asks conversationally: *"Want to review one question?"* — a short 2–3 turn reinforcement around ONE missed concept.

It is not a punishment, not pass/fail, not a scheduled reminder, and not a manager ranking.

This is deliberately distinct from the existing 7/30-day Foundry follow-up, which is for **real-world behavioral application** — whether the person did the thing — and not for ordinary knowledge-quiz remediation. The two must not be collapsed.
