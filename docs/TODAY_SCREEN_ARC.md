# TODAY SCREEN ARC — Design Intent Spec

**Status:** STEP 1 — arrival model LOCKED (design intent only, no implementation)
**Repo:** inner (`bty-app`) · **Branch:** inner-main
**Surface:** the `today` tab inside the native app shell (`src/components/app-shell/BtyDailyAppShell.tsx` → `TodaySurface`)
**Scope of this doc:** locks *what Today is* and *how the user arrives*, before any code is written. No app code changes accompany this spec.

> **Location note.** Screen-level UI specs already live in `bty-app/docs/` (see `BTY_ARENA_LOBBY_SCREEN_UI_SPEC.md`, `BTY_ARENA_PLAY_SCREEN_UI_SPEC.md`, `BTY_ARENA_RESOLVE_SCREEN_UI_SPEC.md`). This spec follows that precedent and stays inner-repo only. It is deliberately NOT placed in the repo-root operating-docs `docs/` (that tree is the outer ledger and is out of scope for this arc).

---

## 0. Where we are (STEP 0 recap)

Today is already clean and correctly structured:

- Rendered by `TodaySurface` inside `BtyDailyAppShell.tsx`.
- Reads deterministic, numberless data: `GET /api/me/today-intelligence` (relationship focus + confidence + narrative `userState`) and a narrowed `action_text` from `GET /api/bty/my-page/state`.
- No XP, no score, no rank, no chart, no dashboard language. Self / Others / World is first-class and maps to Center / Arena / Foundry.
- The A→A+ ritual beat exists in the **confirmation** (select → confirm → carry your own promise → settle CTA).

**The one weakness this arc fixes:** the *arrival* is flat. The three relationship options currently read as a compact selector / settings list, so the emotional weight lives only in the confirmation, not in the moment of entering the day. Destination rooms (Center / Arena / Foundry tabs) are still `LockedRoom` placeholders, so Today must **not** navigate into live rooms yet.

---

## 1. Product role (locked)

**Today is the daily relationship entrance.** It answers one question and only one:

> **"오늘 나는 어떤 관계로 들어갈 것인가?"** — *Which relationship will I live today?*

Today is:

- **NOT a dashboard** — it renders no metrics, no aggregates, no status of systems.
- **NOT a task launcher** — it does not list actions to complete or route into work queues.
- **NOT a generic mobile home screen** — it is not a grid of shortcuts or a feed.

Today is a **threshold**: a calm, singular moment where the user chooses the relationship posture they will carry into the day. Everything on the surface serves that one choice.

---

## 2. Arrival model (DECISION LOCKED)

**Evaluated:**
- **(A)** compact selector above a richer Today body
- **(B)** full ritual relationship-door entrance

**DECISION: (B) — ritual doors.** The three paths become **relationship doors**, not selector rows.

Constraints on the v1 realization of (B):

- **In-shell only.** Tapping a door expands / settles it *within the Today surface*. It does **not** navigate.
- **No entry into locked rooms.** Center / Arena / Foundry tabs remain `LockedRoom` until their own arcs land. A door is a *posture chosen for today*, not a portal into a built room.
- The existing derived `relationshipFocus` may **softly suggest** one door, never pre-select or coerce it.

Rationale: the product leaning is (B), and Self/Others/World is already the strongest, cleanest expression of BTY philosophy in the codebase. Making the three the *centre of gravity of arrival* (rather than a list above a body) is what turns Today from "correct" into "a place you want to return to." Choosing (A) would dilute the one question by surrounding it with a body.

---

## 3. Door semantics (locked)

Three doors, fixed order, each a relationship the user can enter *today*. Product-facing language stays **self / others / world**. The founder/theological belief layer informs tone but is **not surfaced in UI copy**.

| Door | Relationship | Meaning (product-facing) | Backing system | Inert route ref (v1: not a link) |
|---|---|---|---|---|
| **Self** | 나와의 관계 | Return to yourself with honesty. | Center | `/{locale}/center` |
| **Others** | 이웃과의 관계 | Move toward someone with courage and care. | Arena | (arena) |
| **Foundry / World** | 세상과의 관계 | Practice, learn, build, serve — steward what is entrusted to you. | Foundry | (foundry) |

Copy discipline:
- Keep each door to a short noun-title + one calm line, in the tone already established in `COPY` (`BtyDailyAppShell.tsx`).
- No verdicts, no imperatives that read as tasks ("do X"), no scores.
- Existing KO/EN copy in `COPY.today.cards` is the baseline; door realization may re-tone but must preserve the self/others/world meaning and stay parallel across the three.

---

## 4. Interaction model (v1, locked)

The v1 flow, expressed as intent (not code):

1. **Arrive.** User lands on Today and sees a short greeting/status line and **three living relationship doors** as the emotional centre of the screen.
2. **Soft suggestion.** When `resolveActiveFocus(intel)` returns a focus (i.e. `confidence !== "none"`), one door is *softly* marked as suggested — a quiet lean, never a pre-selection, never a nag.
3. **Tap a door.** The tapped door **expands / settles** in place. This is the moment of "entering a relationship for today," not "selecting a filter." The other two recede quietly (calm, not harsh collapse).
4. **Confirmation inside/beneath the door.** The existing confirmation content appears *within or directly beneath the settled door*: the path line, and — **only if a real open promise exists** — the `PROMISE TO CARRY` label + `action_text` rendered verbatim.
5. **Carry into today.** The CTA confirms **locally** (`confirmed` state), settling to the quiet "Carried into today ✓" state.
6. **Chosen-path state.** After confirmation, the screen rests in a quiet **"chosen path"** state — the day's relationship is visibly *chosen and held*, calm, with no further prompting. (The exact resting composition is an implementation detail for STEP 2; the requirement here is that a distinct, settled post-confirmation state exists.)

Hard limits for v1:
- **No server write.** Selection and confirmation are local (`useState`) only, unless separately approved.
- **No navigation.** No door routes into a room, unless separately approved.
- **No persistence** of the chosen path across reloads in v1 (may be a later arc).

---

## 5. Visual direction (locked intent)

Doors must read as **thresholds**, not controls.

Must **not** look like:
- settings cards / list rows,
- badges or achievement chips,
- game tiles,
- KPI / stat panels.

Must feel like:
- **threshold / entrance / quiet invitation** — each door has enough presence and vertical generosity to read as a *place you step into*, not an option you tick.
- **mobile-native, touchable, premium, calm** — large tap targets, soft motion, restrained gold (`#C9A66B`) accents consistent with the shell's dark surface (`#0B1F3A`).
- enough **emotional pull** that arriving here creates a small pull to return tomorrow.

Motion/tone guidance (non-binding on exact values, binding on spirit):
- Selection is a *settling*, not a click — easing that reads as "entering," short and calm.
- Suggested-door lean is a subtle warmth (ring/glow at low opacity), never a loud highlight.
- Respect `prefers-reduced-motion` (stills, no loops), consistent with the shell.

---

## 6. Boundaries (LOCKED — non-negotiable for this arc)

The following are hard constraints on any STEP 2 implementation:

- **No XP.** No raw XP anywhere on Today.
- **No numbers.** No counts, scores, percentages, streak numerals.
- **No rank / no leaderboard.** No comparison to others.
- **No chart / no dashboard energy.**
- **No haptic.** Today calls no haptic; the Haptic Exclusivity Lock keeps the single live haptic site at `/start` (OrbLiving).
- **No OrbLiving / Orb.tsx / orbHaptic reuse.** Today imports none of them.
- **No new API or data-contract changes.** Today keeps consuming the existing `today-intelligence` brief and the narrowed `action_text`. Field-narrowing discipline (only `open_action_contract.action_text` typed) is preserved.
- **No persistence / no server write** in v1.
- **No navigation into locked rooms** in v1.
- **No `CenterMeCard` changes.** The Me-tab mirror is untouched by this arc.
- **WeeklyOrb untouched.** Weekly Orb v0 is closed at inner `43ba7ea3`; this arc does not read, move, or modify it, and Today does not consume `barIntensity`.

---

## 7. Implementation implication (assessment)

**Small composition change** — *provided v1 stays in-shell.*

Evidence:
- All required data is already wired: `relationshipFocus` (soft suggestion), narrative `userState` (status line), and the open promise (`action_text`) are already fetched in `BtyDailyAppShell.tsx`.
- The change is confined to how `TodaySurface` *renders and arranges* the three options and the confirmation block — a presentation restructure inside one component, not a data, contract, routing, or architecture change.

A **full restructure** is required **only if** a future decision makes Today navigate into live rooms (Center / Arena / Foundry). That is explicitly **out of scope** for v1 and deferred until those rooms exist.

---

## 8. Acceptance criteria (for STEP 2 implementation)

Implementation of this arc is accepted only when ALL hold:

1. **Doors, not list cards.** The three paths visually read as relationship doors / thresholds, not selector rows or settings cards.
2. **Entering, not filtering.** Tapping a path feels like *entering a relationship for today*, expressed by an in-place expand/settle — not like selecting a filter or list item.
3. **Suggestion is subtle.** When a focus is derived, its door is softly suggested — never pre-selected, never coercive; with no derived focus, Today reads neutral (no door pushed).
4. **Calm confirmation ritual.** The confirmation (path line → optional carried promise → local CTA → chosen-path rest state) remains calm and unhurried; promise text renders verbatim and only when a real open promise exists.
5. **No dashboard energy.** No metrics, charts, grids, or stat framing anywhere on the surface.
6. **No score/XP leakage.** No XP, numbers, rank, or leaderboard values reachable or rendered; field-narrowing on `/api/bty/my-page/state` is preserved.
7. **KO + EN.** Both locales render correctly with parallel, calm copy; no truncation or layout break in either.
8. **No clipping.** The surface (including expanded door + confirmation + chosen-path state) never clips above the `CompanionBar` or `AppTabBar`; content scrolls within `main`, and the dock/tab bar remain real, non-floating flex children.

---

## Change log

- **STEP 0** — read-only inventory completed (Today located, mapped, boundary-checked; verdict: relationship-based day selector with flat arrival).
- **STEP 1** — this doc. Arrival model LOCKED to **(B) ritual doors, in-shell, no room navigation for v1**. Implementation assessed as a **small composition change**. No app code changed.
