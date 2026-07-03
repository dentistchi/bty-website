# BTY Daily OS v0.1 — Scope Lock

**Status:** LOCKED SCOPE — implementation planning (Dispatch B) may proceed after commit.
**This is not:** implementation · final product spec · data-integrity v0.2.
**Date locked:** 2026-07-02
**Provenance:** STEP 0 Reality Inventory + Dispatch A + DEBT-1 schema alignment (inner `ba4845ae`, outer ledger `3c7a6651`). Turns verbal Commander locks into repo-resident authority for Dispatch B to stand on.

---

## 1. Purpose

BTY Daily OS v0.1 defines the **first 60 seconds** of the app as a **daily relationship ritual, not a dashboard.**

Core flow:

```
App Open
→ Orb / Logo Wake
→ Critical Gate Check
→ Yesterday Mirror
→ Open Loop Card
→ Relationship Pulse
→ Today Door
→ Center / Arena / Foundry session
→ One Evidence
→ Back to Real Life
```

## 2. Product Definition

BTY Daily OS v0.1 is **not the whole app.** It is the **first 60 seconds.**

The user opens BTY not to see a score, but to enter the day through the question:

> "오늘 나는 어떤 관계를 살아낼 것인가?"

## 3. Relationship Model

Lock:

- **Center = relationship with self**
- **Arena = relationship with others**
- **Foundry = relationship with world / land**

**Relationship Pulse is a projection layer, not truth.**

Truth remains actual evidence:
- Center evidence
- Arena / QR / action evidence
- Foundry / dojo / program evidence

## 4. Entry Model Lock

- `/start` = **Threshold ritual**
- `/today` = **Daily OS surface**
- Today Shell **extends** the existing `/start → /today` flow.
- **No new entry ritual route.**
- **No duplicate threshold surface.**

## 5. Daily Critical Gate Lock

The Daily Gate uses its **own cross-domain ordering.**

Authoritative v0.1 order:

1. `FORCED_RESET` → **Center first**
2. `ACTION_REQUIRED` / open QR → **Open Loop Card**
3. `REEXPOSURE_DUE` → **Arena re-exposure**
4. Yesterday evidence exists → **Yesterday Mirror**
5. Yesterday empty + 14-day evidence exists → **Quiet invitation**
6. New user → **First Day ritual**

**Explicit prohibition:** Do **not** import or reuse arena `statePriorityForRuntime()` for Daily Gate ordering.

**Reason:** Arena priority answers an arena-internal question. The Daily Gate answers a cross-domain day-entry question. (STEP 0 confirmed the two orderings differ: arena ranks ACTION states above FORCED_RESET; the Daily Gate ranks FORCED_RESET first.)

## 6. Evidence and No-Data Lock

**No Data → No Interpretation.**

Allowed:
- "아직 해석할 증거가 없습니다."
- "아직 조용합니다."
- "오늘 하나를 선택할 수 있습니다."

Forbidden:
- "나와의 관계가 낮습니다."
- "이웃과의 관계가 약합니다."
- "균형이 무너졌습니다."
- personality inference
- weakness inference
- raw score exposure
- internal pattern label exposure

## 7. Dedupe Lock

v0.1 dedupe is **forward-only.**

**One `bty_action_contracts.id` = one action lifecycle = one relationship evidence item.**

QR verification:
- **raises** confidence / completion state
- does **not** create a second evidence count

`le_verification_log` rows **must not** be counted as independent relationship evidence items.

**Historical undercount is accepted** for v0.1.

DEBT-2 remains deferred (see §13):
- `le_verification_log.contract_id` backfill
- FK `VALIDATE`
- historical repair

## 8. Confirmed Evidence Source Lock

Use only **confirmed live-backed** aliases.

Allowed sources (STEP 0 live-confirmed unless noted):
- `center_letters`
- `dear_me_letters`
- `center_diagnostics`
- `slip_recovery_tasks`
- `bty_recovery_entries`
- `bty_action_contracts`
- `le_verification_log` — **only** as verification / confidence signal (never an independent evidence count)
- `arena_runs`
- `user_scenario_choice_history`
- `arena_pending_outcomes`
- `user_dojo_attempts`
- `user_program_progress`
- `dojo_submissions` — **LIVE-CONFIRMED (Dispatch B, 2026-07-02, PostgREST OpenAPI, control-verified):** PRESENT with `user_id` + `created_at`. Admissible as a `ground` evidence source for v0.1. (§8's original "confirm → admissible" condition is now satisfied; prior "not-allowed until re-confirmed" phrasing superseded.)

Forbidden dangling names (STEP 0 confirmed ABSENT from live schema — do not reference as evidence tables unless re-confirmed live):
- `center_recovery`
- `artifacts`
- `train`
- `training_*` (as literal evidence table names)

## 9. Orb Boundary Lock

Production `Orb.tsx` is a **sealed primitive.** Today Shell must not modify `Orb.tsx`
internals, its haptic behavior, or inject gate-state visuals into it.

**OrbLiving is promoted for BTY Daily OS v0.1** as a **separate** Today Shell visual
presence primitive. This is a **swap / wrapper** promotion — **not a merge into `Orb.tsx`.**
OrbLiving remains **visual-only and haptic-free**; haptic exclusivity stays with the
existing Orb haptic lock (sole site: `Orb.tsx`).

Allowed:
- Compose **around** Orb / OrbLiving
- Render `OrbLiving` as the Today Shell visual presence (swap / wrapper)
- Use each component's existing prop surface only
- Preserve the haptic lock

Forbidden:
- Inject gate-state visuals into Orb / OrbLiving internals
- Merge `OrbLiving` into `Orb.tsx`
- Modify `Orb.tsx` internals for Today Shell
- Add haptic behavior to `OrbLiving`
- Change haptic exclusivity

`auth/callback/page.client.tsx` remains **HELD** and untouched.

**Mandatory Today-surface re-gate:** the previous `/dev/orb` OrbLiving Sensory Gate PASS
applies to the OrbLiving *primitive* only. Today Shell promotion requires a **new
Today-surface Sensory Gate re-pass** — the surface, size, and surrounding ritual context
differ — on `/ko/today` and `/en/today`. No final Sensory PASS may be claimed before
Commander confirms the Today-surface re-gate.

## 10. AI Placement Lock

**Rules decide. AI expresses.**

Allowed:
- Server-side evidence mirror copy
- `/api/safe-mirror` (or a safe evidence variant)
- locale-aware, score-free, judgment-free output

Forbidden:
- AI deciding gates
- client-side evidence synthesis
- mixing evidence mirror into `/api/chat`
- mixing evidence mirror into `/api/mentor`
- exposing raw scores, exact penalties, or internal labels

## 11. Implementation Surface Boundary

Dispatch B may **plan** (not implement) only:
- daily-gate-check endpoint
- relationship pulse projection
- Today Shell components

**No implementation in this Scope Lock document.**

Likely future surfaces:
- daily-gate-check read-only aggregator
- relationship pulse projection service
- Yesterday Mirror
- Open Loop Card
- Relationship Pulse Summary
- Today Door cards
- Exit Line

## 12. Execution Model Lock

Single executor: **VSCode + Claude Code.**
No Cursor. No C1–C5. No parallel fan-out.

Current sequence:
```
Scope Lock canon write
→ Dispatch B read-only implementation plan
→ Commander scope approval
→ separate implementation dispatch
```

## 13. Deferred Work

Deferred to v0.2 / later tracks:
- `le_verification_log.contract_id` backfill
- FK `VALIDATE`
- historical relationship evidence reconstruction
- advanced `OrbLiving` **merge into `Orb.tsx`**
- deeper Touch-Gravity beyond the v0.1 Today secondary Influence Field (release memory B-3, approach/hover sensing, production-wide touch gravity)
- additional haptic expansion
- high-fidelity particle / touch animation beyond the locked Phase A / B-1.5 visual presence
- full AI drawer implementation
- Foundry artifact system expansion

**Not deferred:** (a) the v0.1 Today Shell **OrbLiving visual swap**; (b) the v0.1 Today
**B-2 secondary Influence Field** — core anchored, a slow/wide/heavy **visual-only,
haptic-free** gather toward touch (per spec §F). Both require `Orb.tsx` sealed and the
Today-surface Sensory Gate to re-pass.

## 14. Final Lock Statement

> BTY Daily OS v0.1 is the first 60 seconds of the app:
> the user opens BTY, is not evaluated, sees only evidence-based truth,
> chooses one relationship to live today, leaves one evidence,
> and returns to real life.
