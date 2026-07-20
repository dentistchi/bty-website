# Slice 3.1B-3A — Identity-Bound Foundry Participation Contract

**PLAN ONLY.** No code, migration, commit, or deployment. Measured 2026-07-20 against
inner-main `22bb9f6f` / outer `3d4ce6de` / Worker `a1080cf0` and live staging
`mveycersmqfiuddslnrj`.

---

## 1. Verdict

**GO for implementation — with one significant correction to the proposed direction.**

The proposed A/B participation modes are implementable and correct in shape, but the
measurement changes *how* identity binding should work:

> **The identity-reconciliation mechanism already exists, is live, and works.** Participants
> join anonymously, then **claim** their work by authenticating. `linked_user_id` is already
> populated on 5 of 12 progress rows through exactly this path.

So ASSIGNED mode must **not** be built as "log in before you may join." It should be built as
**assignment + claim**, extending the proven claim seam. This is a smaller, safer, and more
backward-compatible design than login-gated joining, and it preserves the anonymous room.

A second correction: **audience intent is already frozen at publish.** `module_snapshot`
(jsonb, immutable) already contains `audienceType` and `audienceDetail` on every published
event. What is missing is not the *declaration* but the *resolved recipient set*.

---

## 2. Current Foundry participation lifecycle (measured)

| Stage | Surface | Identity |
|---|---|---|
| Draft creation | `foundry_module_drafts` (`owner_user_id`), `PATCH /modules/[id]` | Host (authenticated) |
| Audience choice | draft `answers.audienceType` / `audienceDetail` | — (descriptive) |
| Publish | `foundryPublishService.publishDraft` → `foundry_events` + **`foundry_event_module` immutable snapshot** (`source_draft_id` UNIQUE = idempotency) | Host |
| Link/QR | `foundry-room-token`, `rotate-qr` | — |
| Participant join | `POST /public/[token]/join` — **anonymous, name only** | **none** |
| Session | HttpOnly cookie, raw token; DB stores only `participant_session_token_hash` | pseudonymous |
| Content | `/public/[token]/progress/*`, `/public/[token]/doc/*` | pseudonymous |
| Reflection | `/public/[token]/reflection` → `response_text` | pseudonymous |
| **XP claim** | `/public/[token]/progress/claim-xp`, `/doc/claim-xp` — **requires `auth.getUser()`, 401 if absent** | **AUTHENTICATED** |
| Identity link | `claimDocumentXp` / training equivalent set `linked_user_id = authUserId`, `xp_awarded_at` | **binding happens here** |
| Learner history | `/foundry/history` — `requireUser`, scoped `linked_user_id = self` | authenticated |
| Host history | `foundryHostHistoryService` — completion projection only | Host |
| Close | `/events/[eventId]/close` | Host |

**The lifecycle is pseudonymous end-to-end until XP claim, where it becomes identity-bound.**

## 3. Authentication and identity reality

- Host/admin: Supabase SSR cookies; `requireUser` / `requireAdminEmail`.
- Installed app: Capacitor **hosted-URL WebView** loading the live Worker → same cookie
  contract as the browser, plus **iOS Keychain durable session restore**
  (`src/lib/native/durableSession.ts`) that re-seats the session on cold reopen.
- **Therefore an app learner opening a Foundry link almost always already carries a readable
  authenticated Supabase user.** This is the single most important enabling fact.
- Participant routes deliberately do **not** require auth (that is the open-room product).
- Absent session → participant routes still work (anonymous); claim routes 401.

## 4. Anonymous participant contract (measured)

`foundry_event_participants`: `id, event_id, display_name, participant_session_token_hash,
status('joined'|'removed'), joined_at, last_seen_at, removed_at`. **No `user_id`.**

Constraints: PK `id`; **UNIQUE `participant_session_token_hash`** (global); UNIQUE
`(event_id, id)`; FK `event_id → foundry_events ON DELETE CASCADE`; `display_name` 1–60 chars.

- Re-entry with a **valid existing session cookie** is idempotent (no duplicate row).
- **A new session (new device, cleared cookies, private window) creates a NEW participant
  row.** Nothing prevents one human from holding several participant rows. This is the
  deterministic-duplicate-prevention gap ASSIGNED mode must close.

## 5. Canonical membership contract (measured)

`bty_org_memberships`: `user_id → auth.users`, `organization_id`, `status(active|inactive)`,
`is_primary`, `job_family_key`, `primary_role_key`, `role_started_on`, `identity_source`;
UNIQUE `(user_id, organization_id)`; partial unique **one active primary per user**.
Responsibilities: `bty_org_membership_responsibilities` (active|removed) + audit.
Live: 24 memberships, 1 organization (`BTY_LEGACY`), 1 eligible leader.

Multi-organization is **modelled but not exercised** (single org today).

## 6. Audience metadata lifecycle (measured)

- Persisted in draft `answers.audienceType` / `audienceDetail`.
- **Survives publish inside the immutable `module_snapshot` jsonb** — verified live: every
  snapshot row contains `audienceType` and a non-null value.
- **Not** a column on `foundry_events`; **not** queryable; **no route consumes it after
  display** (validation, labels, AI prompt text, passthrough only).

**Conclusion: historical audience intent is already preserved and immutable. Do not
re-architect it — index/extract it.**

## 7. Assignment precedent (measured)

Existing patterns worth extending rather than reinventing:

| Pattern | Where | Reusable as |
|---|---|---|
| **Immutable publish-time snapshot** | `foundry_event_module` (`module_snapshot`, `source_draft_id` UNIQUE) | the audience/recipient snapshot model |
| **Per-user due/completion funnel** | `le_activation_log` (`chosen_at`, `due_at`, `completed_at`), `bty_action_contracts` + `bty_action_contract_followups` | assignment status funnel + follow-up due |
| **Anonymous → authenticated claim** | `claim-xp` routes + `linked_user_id` | the identity reconciliation contract |
| **Identity-scoped learner read** | `foundryHistoryService` (`linked_user_id = self`) | "my required learning" queries |
| **Capability grant, not role** | `foundry_host_grants` | who may create/see assignments |

Additional precedents found in the full-system sweep:

| Pattern | Where | Relevance |
|---|---|---|
| **`slip_recovery_tasks`** | `20260429130100_slip_recovery_tasks.sql:3-22` — `user_id, task_type, assigned_at, completed_at`, partial index on open tasks | **Closest existing analogue**: system-assigned required work with a completion funnel. No due date, no revoke. |
| `bty_action_contracts` | `20260431230100:4-24` + `20260402120000:19-29` | `required boolean`, `deadline_at`, `draft→committed→pending→submitted→approved/rejected/escalated/missed` — the richest status funnel in the repo |
| `user_memory_trigger_queue` | `20260430330000:84-110` | cleanest queue shape: `status(pending/processing/processed/cancelled/failed)`, `due_at` (scaffold, not fully wired) |
| **`bty_event_participation`** | `20260624000000:19-40` | scan-in participation with **UNIQUE `(event_id, user_id)`** — direct precedent for one-row-per-member-per-event |
| **`join_version` rotation** | `foundry-room-token.ts:16-18`, `rotate-qr` | **bulk revoke already exists**: bumping the version invalidates every previously minted join token |

**No assignment/invitation/recipient/roster/due-date table exists for Foundry.** There is no
"required now" queue anywhere in the product. No audience or recipient snapshot exists
anywhere — **every snapshot in the repo freezes content or metrics, never a set of people.**

### ⚠️ The architecturally significant finding

**No table anywhere in this product lets actor A create a required item for target user B.**
Every per-user table is either RLS-scoped `auth.uid() = user_id` (self-service:
`user_learning_paths`, `foundry_recommendations`) or written by a system engine
(`slip_recovery_tasks`). Even `dojo/assign` is a `GET` that **self**-assigns from the session.

Host-assigns-to-member is therefore a **genuinely new authorization shape** for BTY, not an
extension of an existing one. Consequences the implementation must respect:

- Assignment writes MUST be service-role-only through a SECURITY DEFINER RPC. Client-side
  RLS self-scoping cannot express "a Host wrote this row for someone else."
- The Host↔assignee relationship must be authorized explicitly (Host capability + the
  assignee being an active member of the Host's own organization), because no existing
  policy shape covers it.
- This is the single largest new-risk surface in 3.1B-3 and justifies the schema-only first
  slice (3.1B-3B) landing before any behavior.

`foundry_recommendations` is **not** a precedent: it is a derived scoring cache
(`program-recommender.service.ts:121` deletes all rows for the user then reinserts top-3),
carrying no status, no opened-at, no due date, and no history.

## 8. Product decision — participation modes

**Adopt A/B, with ASSIGNED implemented as assignment + claim (not login-gated join).**

- `ASSIGNED` — organization-required learning; recipients resolved and **snapshotted at
  publish**; assignment rows created; learner sees it in-app; completion reconciles to the
  canonical member via the existing claim seam.
- `OPEN_LINK` — today's behavior, unchanged. **All 19 existing events are OPEN_LINK.**

Mode is chosen explicitly at publish. Default for anything pre-existing or unspecified is
`OPEN_LINK`.

## 9. ASSIGNED state machine

```
ELIGIBLE            (resolver output; NOT persisted — preview only)
  → ASSIGNED        (publish: snapshot row created; due_at optional)
  → OPENED          (assignee authenticated + opened the link; first claim of assignment)
  → IN_PROGRESS     (content progress recorded against the claimed participant row)
  → COMPLETED       (completion + linked_user_id set)
  → FOLLOW_UP_DUE   (only when the module defines followUpDays)
  → FOLLOW_UP_COMPLETE
Terminal side-states: REVOKED (host action), EXPIRED (optional, if due_at passes)
```

`ELIGIBLE` is deliberately **not** a stored state — it is the 3.1B-2 preview. Assignment
begins at publish.

## 10. OPEN_LINK state machine (unchanged)

```
LINK_CREATED → ANONYMOUS_JOINED → IN_PROGRESS → COMPLETED
                                      ↘ (optional) XP_CLAIMED → identity-linked
```

This is exactly today's behavior including the optional claim. Do not rename or reuse
ASSIGNED states here — `COMPLETED` here carries no assignment semantics.

## 11. Publish-time snapshot recommendation

**Both, but with distinct roles:**

1. **Audience snapshot** (one row per event): the *declaration* — audience type, detail, the
   resolver version, resolved-at timestamp, and the resolved count. Mirrors
   `foundry_event_module`'s immutability contract.
2. **Assignment rows** (one per recipient): the *recipient set* — `membership_id` +
   `user_id` captured **as values at publish time**, plus status.

Snapshot rows are **never recomputed**. A later responsibility or membership change does not
add, remove, or rewrite an existing assignment. Organization isolation is inherited because
recipients are resolved through memberships in one organization. No client-supplied recipient
list is ever accepted — the server resolves from canonical facts only.

## 12. Identity reconciliation contract

**Extend the existing claim seam; never infer identity.**

- An assignment is claimed when an **authenticated** user opens the assigned link and their
  `user_id` matches an assignment row for that event.
- Claiming binds the assignment to a participant row (`participant_id`), which is created at
  that moment if needed.
- **No name matching, no email matching, no inferred ownership. Ever.**
- **No backfill.** The 15 historical participants and 7 unlinked progress rows stay
  anonymous permanently. (5 are already linked via genuine user claims and stay as they are.)

## 13. Privacy and authorization boundaries (measured, preserve exactly)

Already true and must not regress:

- **Hosts cannot read reflection bodies.** `foundryHostHistoryService` is explicit: "Only the
  columns needed to project completion — NO response_text, NO reflection."
- Learners read their own text via `linked_user_id = self`.

For assignment, the additional exposure is **status only** — assigned / opened / completed /
follow-up. That is a legitimate operational need and does **not** expose reflection content.

Non-negotiables carried forward: completion ≠ verified behavior change; self-reported
application must never become verified behavior; assignment status must never become employee
scoring; **leadership responsibility grants nothing** (not Host, not admin, not office scope).

## 14. Compatibility and historical data policy

- All 19 existing events → `OPEN_LINK` by default; no data rewritten.
- New events choose mode explicitly at publish.
- Existing anonymous joining, QR rotation, removal, and close behavior unchanged.
- Historical participant rows are immutable; the module snapshot already guarantees
  reproducibility of what was published.

## 15. Proposed conceptual schema (NOT implemented)

```
foundry_event_participation_mode
  event_id PK/FK → foundry_events
  mode text CHECK ('assigned','open_link')  -- absent ⇒ open_link
  -- or a nullable column on foundry_events; decide in 3.1B-3B

foundry_event_audience_snapshot          -- the immutable declaration
  event_id PK/FK, audience_type, audience_detail,
  resolver_version text, resolved_at timestamptz, resolved_count int

foundry_event_assignments                -- the immutable recipient set
  id PK
  event_id FK → foundry_events
  membership_id_snapshot uuid NOT NULL    -- value, FK-free (3.1A-3 durability pattern)
  user_id_snapshot uuid NOT NULL
  membership_id uuid NULL FK ON DELETE SET NULL
  user_id uuid NULL FK ON DELETE SET NULL
  status text CHECK ('assigned','opened','completed','revoked')
  due_at timestamptz NULL
  participant_id uuid NULL FK → foundry_event_participants  -- set at claim
  assigned_at, opened_at, completed_at, revoked_at
  UNIQUE (event_id, user_id_snapshot)      -- deterministic duplicate prevention
+ append-only assignment audit (mirrors 3.1B-1)
+ RLS client-deny; service-role-only mutation via SECURITY DEFINER RPC,
  search_path = pg_catalog, public
```

`UNIQUE (event_id, user_id_snapshot)` is the answer to duplicate participation for assigned
learners. Durability follows the 3.1A-3 contract (SET NULL live FKs + NOT NULL snapshots) so
offboarding is never blocked.

## 16. Answers to the product questions

| | Question | Recommendation |
|---|---|---|
| A | Assigned participant must log in first? | **No — must be authenticated to CLAIM.** They may open and even complete anonymously; the assignment only closes when claimed. Preserves the room, matches the live claim precedent. |
| B | Open-link participant may authenticate? | **Yes, optionally** — exactly today's XP claim. |
| C | One event, both modes? | **Yes.** Assigned recipients + walk-ins. Assignment is an overlay, not a gate. |
| D | Eligible set frozen at publish? | **Yes.** Snapshot; never recomputed. |
| E | Responsibility changes after publish? | **No effect** on existing assignments. Future events resolve fresh. |
| F | Membership becomes inactive? | Assignment **stays** (history is real); surface it as inactive; exclude from future resolution. |
| G | Revoke? | **Yes** — status → `revoked`, audited, never deleted. Note a bulk-revoke primitive already exists (`join_version` rotation invalidates all join tokens); assignment revoke is the per-member complement, following the `foundry_host_grants` active/revoked shape. |
| H | Late add after publish? | **Yes**, as an explicit Host action creating a new assignment row (audited), never a silent recompute. |
| I | Does opening create a participant row immediately? | **Keep today's behavior** — the row is created on join. Claim links it to the assignment. |
| J | Multiple attempts per member? | One **assignment** per member per event (unique); participant attempts may be >1; assignment references the claimed one. |
| K | Canonical completion? | The completion on the **claimed** participant row. |
| L | Prevent a second anonymous row? | Cannot be prevented for anonymous joins by design; assignment-level uniqueness makes it irrelevant for status. |
| M | Assigned user opens link logged out? | Full anonymous experience + a clear "sign in to record this as your required training" prompt. Never block. |
| N | Wrong account opens an assigned link? | They participate as an ordinary (open) participant; the assignment is **not** claimed. Show a clear mismatch state. Never auto-transfer. |
| O | Historical open sessions after ship? | Display unchanged as OPEN_LINK; never retro-labelled as assigned. |

## 17. Installed-app learner experience (minimum)

Surface inside the existing app shell (no separate learner app):

- **Required now** — card: module title, org/host, due date if set, status chip, deep link.
- **Follow-up due** — only when `followUpDays` is defined.
- **Completed learning** — existing history, unchanged.
- **Empty state**: "No required learning right now." (Must not imply failure.)
- **Login/account-mismatch state**: explain the assignment belongs to a different account;
  offer sign-in; never auto-switch, never transfer.
- Resume = existing progress restore; completion = existing completion + claim.

## 18. Host experience (minimum)

At publish, one explicit choice: **Assigned to organization members** | **Open link session**.

- Assigned: choose audience → **3.1B-2 preview (count + names)** → publish → confirmed
  assignment list → participation/completion funnel (assigned / opened / completed).
- Open link: today's link + QR flow, untouched.

Host sees **status only** — never reflection bodies.

## 19. Risks and failure modes

1. **Scope creep into scoring.** Assignment + completion is one step from "who didn't do it."
   Mitigate with explicit copy and by keeping reflection private.
2. **Login-gating the room by accident.** The room's value is frictionless joining; assignment
   must stay an overlay.
3. **Silent recompute.** Any convenience "refresh assignments" breaks historical truth.
4. **Duplicate identities** for anonymous re-joins — accepted, bounded by assignment
   uniqueness.
5. **Single-organization blind spot.** Multi-org paths remain unexercised in staging; org
   isolation must be enforced structurally, not by tests alone.
7. **New authorization shape (highest risk).** Host-assigns-to-member has no precedent in
   this product — every existing per-user table is self-scoped or engine-written. There is no
   established RLS/policy pattern to copy, so the write path must be service-role-only via a
   SECURITY DEFINER RPC with explicit Host + same-organization checks. Getting this wrong
   would be an authorization defect, not a feature bug.
6. **Native session loss** → assignment appears unclaimed. Keychain restore mitigates.

## 20. Recommended implementation slices (corrected order)

| Slice | Scope | Why this order |
|---|---|---|
| **3.1B-3B** | Participation mode + assignment/audience-snapshot schema (migration only, no UI, no behavior change; existing events default OPEN_LINK) | Foundation; independently verifiable; zero user-visible risk |
| **3.1B-3C** | Publish-time audience snapshot + assignment row creation (server-only, Host chooses mode) | Makes recipient sets real and immutable |
| **3.1B-3D** | Authenticated assignment claim (extends the existing `claim-xp` seam; mismatch + logged-out states) | The identity binding, on a proven path |
| **3.1B-3E** | Installed-app required-learning surface | Learner value; depends on D |
| **3.1B-3F** | Host assignment outcome funnel (status only) | Operational visibility; last, most scoring-adjacent |

Each slice ends with a device gate; none may claim targeting until 3.1B-3C ships.

## 21. Explicit non-goals

No retroactive identity matching · no backfill of anonymous participants · no login-gated
joining · no access enforcement from responsibilities · no employee scoring · no verified
behavior claims · no separate learner app · no multi-org synthetic data · no Certified Leader
routing · no Learning Path generation.

## 22. GO / HOLD

**GO** — with ASSIGNED redefined as **assignment + claim**, starting at **3.1B-3B**
(schema foundation only).
