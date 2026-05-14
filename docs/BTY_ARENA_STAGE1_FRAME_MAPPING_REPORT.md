# BTY Arena — Stage 1 Figma Frame ID Mapping Report

**Authority:** [`docs/BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md`](BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md) — outer commit `db97c55` (authoritative v1.1). Note: `ba1d375` committed the v1 file under a v1.1 filename in error; `db97c55` fully superseded it with the correct v1.1 content.
**Supersedes:** v1 reference points (`6fc83bf`). Cite v1.1 only from this point forward.
**Status:** Stage 1 mapping. Source surfaces = Claude design tool artifacts (not codebase files). Output = this standalone documentation. **Code untouched.**
**Date:** 2026-05-14.

---

## 0. Read-only code anchors

These are reference-only citations to existing bty-app code. **No edits to any of these files in Stage 1.** They become Stage 2 implementation targets, in the locked order (§4).

| Subject | Path | Purpose |
|---|---|---|
| `ArenaRuntimeStateId` type | `bty-app/src/lib/bty/arena/arenaRuntimeSnapshot.types.ts:9` | Server-gate runtime state literal type (v1.1 §0 source). |
| Client `jsonFlow.state` consumer | `bty-app/src/app/[locale]/bty-arena/BtyArenaRunPageClient.tsx` | Renders PRIMARY_CHOICE_ACTIVE / TRADEOFF_ACTIVE / ACTION_DECISION_ACTIVE. |
| Server runtime banner | `bty-app/src/components/bty-arena/ArenaRuntimeStateBanner.tsx` | Displays `ArenaRuntimeStateId` per server snapshot. |
| Server snapshot authority | `bty-app/src/lib/bty/arena/arenaRuntimeSnapshot.server.ts` | FORCED_RESET_PENDING / NEXT_SCENARIO_READY origin. |
| Runtime destination dispatch | `bty-app/src/lib/bty/arena/arenaRuntimeDestination.ts` | Server-gate → surface routing logic. |
| Arena session hook | `bty-app/src/app/[locale]/bty-arena/hooks/useArenaSession.ts` | `next_runtime_state` consumer. |
| Blocked surface component | `bty-app/src/components/bty-arena/ArenaBlockedSurface.tsx` | HARD LOCKED rendering candidate. |
| Scenario UI state authority | `bty-app/src/data/scenario/index.ts:500` | Client `jsonFlow.state` literal source (v1.1 §0). |

---

## 1. Stage 1 scope confirmation

- The 6 Claude design surfaces enumerated below are **design-tool artifacts**, not files in this repo. No `.html` / `.jsx` / `.tsx` modifications in Stage 1.
- Stage 1 deliverable = **this single documentation file**. Code untouched. AL-2-D-P1 freeze (`src/data/scenario/`, `src/lib/bty/runtime/`, `wrangler.toml`) preserved. 5 HK8 leaks preserved per HK8 closure clause 4.
- `ios-frame.jsx` is NOT in the codebase. It appears in the master table as a planned wrapper with a Stage 2 implementation constraint (§3.7), not a Stage 1 verification target.
- D1 (Lobby ↔ Hub identity) **KEPT DEFERRED** per Commander Q-A + v1.1 §9-D1. Hub-candidate flagged in the table; resolution at Stage 2 Lobby code-time per v1.1 §10 + C-A3.

---

## 2. Master mapping table

7 rows = 6 design surfaces + 1 wrapper row. Columns per Commander Stage 1 dispatch + v1.1 §2 2-column authority model (C-A5 / C-A9).

| Figma frame | Runtime state(s) | Trigger Authority | Render Authority | Lock grade | §8 forbidden UI (per v1.1) |
|---|---|---|---|---|---|
| **BTY Arena - Lobby Screen** | `ARENA_SCENARIO_READY` (first entry); `NEXT_SCENARIO_READY` (D1-pending split — see §3.1 + A6 in §5) | server gate | server gate (Lobby) | unlocked | §8-2 (no in-scenario state render); §8-6 (no REEXPOSURE separate surface) |
| **BTY Arena - Play Screen** | `PRIMARY_CHOICE_ACTIVE`, `TRADEOFF_ACTIVE`, `ACTION_DECISION_ACTIVE`, `REEXPOSURE_DUE` (mode flag) | client (`jsonFlow.state`) for in-scenario 3; **server gate** for REEXPOSURE_DUE | client (Play; re-exposure rendered as mode flag) | unlocked | §8-2 (no ACTION_REQUIRED+ render); §8-6 (FD-4: REEXPOSURE_DUE stays as mode flag, not separate surface) |
| **BTY Arena - Resolve Screen** | `ACTION_REQUIRED`, `ACTION_SUBMITTED`, `AWAITING_VERIFICATION` | server gate | server gate (Resolve) | **LOCKED** | §8-3 (no Lock bypass / progression CTA when LOCKED); §8-4 (FD-6: no feedback/score reveal as Resolve primary); §8-8 (no "skip" / "continue anyway" / "next" CTA) |
| **BTY Arena - Foundry Home** | (lifecycle-external — none of the 10 runtime states rendered directly) | n/a | n/a (analysis surface, independent navigation) | n/a primary; **HARD LOCKED secondary block** when `FORCED_RESET_PENDING` is active (per v1.1 §5.4) | §8-2 (no in-scenario interaction); §8-7 (must not be accessible while HARD LOCKED) |
| **BTY Center - Home** | `FORCED_RESET_PENDING` | server gate | server gate (Center; full redirect, not modal) | **HARD LOCKED** | §8-5 (FD-5: no menu/dashboard/safe-room tone); §8-7 (no surface escape while HARD LOCKED); §8-8 (no skip / dismiss CTA) |
| **BTY Arena** (Hub-candidate, D1-open) | `NEXT_SCENARIO_READY` (post-scenario transition) — D1-open: identity may merge into Lobby at Stage 2 | server gate | server gate (Hub-candidate) | unlocked | §8-2 (no in-scenario state render). **D1-open marker:** Hub vs Lobby identity not locked in Stage 1. |
| **ios-frame.jsx** (wrapper, not in codebase — Stage 2 implementation constraint) | n/a (cross-surface wrapper) | n/a | client (planned; wraps the surface that it's used by) | n/a primary — **must respect parent surface's lock grade**; specifically must NOT bypass HARD LOCKED navigation block | §8-7 (HARD LOCKED bypass): wrapper MUST NOT introduce navigation/back/exit that escapes Center during `FORCED_RESET_PENDING`. To be lint-enforced at Stage 2 entry per §6. |

---

## 3. Per-surface detail blocks

### 3.1 BTY Arena - Lobby Screen

- **v1.1 §2 rows:** 10 (`ARENA_SCENARIO_READY`), 9 (`NEXT_SCENARIO_READY`, partial — see A6 split).
- **v1.1 §5.1 identity:** scenario entry point. Renders entry-state CTA only.
- **Authority:** Trigger = server gate (snapshot); Render = server gate (Lobby surface). Both layers same.
- **Lock grade:** unlocked.
- **§8 prohibitions in scope:**
  - §8-2 — must NOT render in-scenario state (PRIMARY_CHOICE_ACTIVE, etc.).
  - §8-6 — must NOT carry REEXPOSURE_DUE rendering (FD-4 keeps it inside Play).
- **D-N relevance:** D1 (Lobby ↔ Hub merge) is Stage 2 Lobby code-time decision per v1.1 §9-D1 + C-A3.
- **A6 temporal split (per v1.1 §5.6):** `ARENA_SCENARIO_READY` is unambiguously Lobby (first entry). `NEXT_SCENARIO_READY` is ambiguous between Lobby and Hub depending on D1 outcome. **In Stage 1 mapping, Lobby owns `ARENA_SCENARIO_READY` definitively; Hub-candidate row owns `NEXT_SCENARIO_READY` provisionally with D1-open marker.** If D1 merges Lobby+Hub at Stage 2, both states collapse into the merged surface; if D1 keeps them separate, the temporal split (`NEXT_SCENARIO_READY` → Hub only) is locked at Stage 2.
- **Required UI elements:** entry CTA (per FD context). No in-scenario chrome.
- **Transitions out (v1.1 §4.3):** `NEXT_SCENARIO_READY → PRIMARY_CHOICE_ACTIVE` on enter.

### 3.2 BTY Arena - Play Screen

- **v1.1 §2 rows:** 1, 2, 3 (in-scenario triad), 7 (REEXPOSURE_DUE as mode flag).
- **v1.1 §5.2 identity:** in-scenario interaction container with 3 modes (primary / tradeoff / action) + 1 re-exposure mode.
- **Authority — 2-layer detail (v1.1 §2 + §7.1):**
  - For rows 1-3: Trigger = client `jsonFlow.state`; Render = client (Play). Single layer (client-only).
  - For row 7 (REEXPOSURE_DUE): **Trigger = server gate** (snapshot determines re-exposure due); **Render = client (Play in re-exposure mode flag)**. This is the only row in v1.1 §2 where Trigger ≠ Render — explicit two-layer mechanism per v1.1 §7 + FD-4.
- **Lock grade:** unlocked.
- **§8 prohibitions in scope:**
  - §8-2 — must NOT render Resolve-domain states (`ACTION_REQUIRED`+).
  - §8-6 (FD-4) — REEXPOSURE_DUE stays as mode flag inside Play, NOT a separate surface or overlay.
- **D-N relevance:** D4 (Re-exposure mode header phrasing) — deferred to Play code-time per v1.1 §9-D4 / §7.3.
- **Required UI elements:** choice cards (mode: primary); tradeoff panel (mode: tradeoff); action decision panel (mode: action); re-exposure header + context abstraction (mode: re-exposure, no spoiler of prior choice per v1.1 §7.3).
- **Transitions out (v1.1 §4.3):** primary → tradeoff → action → `ACTION_REQUIRED` (Resolve handoff). Validation → REEXPOSURE_DUE or FORCED_RESET_PENDING.

### 3.3 BTY Arena - Resolve Screen — Action Gate (FD-6)

- **v1.1 §2 rows:** 4, 5, 6 (action lifecycle triad — all LOCKED).
- **v1.1 §5.3 identity:** **execution gateway**, not feedback screen. FD-6.
- **Authority:** Trigger = server gate; Render = server gate (Resolve). Both layers same.
- **Lock grade:** **LOCKED** throughout (all 3 states).
- **§8 prohibitions in scope:**
  - §8-3 (Lock bypass) — no progression CTA active while LOCKED.
  - §8-4 (FD-6 violation) — Resolve UI must NOT lead with feedback/summary/score-reveal. Action Gate framing first.
  - §8-8 (Skip CTA) — no "skip" / "continue anyway" / "next" wording while LOCKED.
- **D-N relevance:**
  - D3 (micro-feedback allowable range, e.g. XP display) — Resolve code-time per v1.1 §9-D3 / §5.3 "포함 가능: action 완료 후 micro-feedback (LOCKED 해제 시점에 한해)".
  - D6 (Approver scan flow location within Resolve) — Resolve code-time per v1.1 §9-D6.
- **Required UI elements (per v1.1 §5.3):** QR generation, contract bind, action submission affordance, approver evaluation surface, XP issuance trigger. Status messages: "Action required to proceed" / "Awaiting verification" per v1.1 §4.2.
- **Transitions (v1.1 §4.3):** `ACTION_DECISION_ACTIVE → ACTION_REQUIRED` (server binding) → `ACTION_SUBMITTED` (QR + actor) → `AWAITING_VERIFICATION` (actor submit) → (approve branch) → validation → REEXPOSURE_DUE / FORCED_RESET_PENDING.

### 3.4 BTY Arena - Foundry Home

- **v1.1 §2 rows:** none (lifecycle-external).
- **v1.1 §5.4 identity:** analysis surface (pattern, trend, AIR, leadership engine). Independent from runtime state machine.
- **Authority:** n/a primary.
- **Lock grade:** n/a primary. **Secondary: HARD LOCKED block** when `FORCED_RESET_PENDING` is active (per v1.1 §5.4 second clause). The block originates from the FORCED_RESET HARD LOCKED rule, not from Foundry-internal state.
- **§8 prohibitions in scope:**
  - §8-2 — no in-scenario interaction (Play / Resolve domain).
  - §8-7 (HARD LOCKED bypass) — Foundry must be inaccessible while Center holds `FORCED_RESET_PENDING`.
- **D-N relevance:** D2 (Foundry FORCED_RESET access-block UI representation) — Center code-time per v1.1 §9-D2.
- **A7 handling (per Commander dispatch):** primary runtime states = **n/a**. Single secondary entry = **`FORCED_RESET_PENDING` → block access**. Foundry earns a row in the master table to make the secondary block explicit, but does not render any of the 10 runtime states directly.
- **Required UI elements:** analysis displays (pattern signatures, leadership stage, AIR/TII metrics). Outside the runtime-state lifecycle.

### 3.5 BTY Center - Home — interrupt surface (FD-5)

- **v1.1 §2 row:** 8 (`FORCED_RESET_PENDING`).
- **v1.1 §5.5 identity:** **system interrupt surface**, not menu / dashboard / safe room. FD-5 full redirect (not modal).
- **Authority:** Trigger = server gate (per v1.1 §6.1 triggers — AIR <80%, ACTION_REQUIRED 48h overdue, pattern_family no-change accumulation, reinforcement cap TBD); Render = server gate (Center). Both layers same.
- **Lock grade:** **HARD LOCKED** — Center is the only accessible surface; back navigation removed per v1.1 §4.2; back button blocked.
- **§8 prohibitions in scope:**
  - §8-5 (FD-5 violation) — no menu/dashboard tone, no "괜찮아요" / "쉬어가세요" safe-room language per v1.1 §6.2. Center is "system friction", not safe room.
  - §8-7 (HARD LOCKED bypass) — must not provide navigation to other surfaces while active.
  - §8-8 (Skip CTA) — no skip / dismiss / compliance-avoidance CTA per v1.1 §6.2.
- **D-N relevance:**
  - D2 (Foundry block UI) — Center code-time per v1.1 §9-D2.
  - D5 (48h lockout timer UI) — Center code-time per v1.1 §9-D5.
- **Required UI elements (v1.1 §6.3):** reset reason explicit (which pattern / which axis); compliance task explicit (2x weight); completion verification surface; (optional) 48h lockout timer.
- **Transitions (v1.1 §4.3):** `FORCED_RESET_PENDING → NEXT_SCENARIO_READY` on compliance task completion.

### 3.6 BTY Arena (Hub-candidate, D1-open)

- **v1.1 §2 row:** 9 partial (`NEXT_SCENARIO_READY` post-scenario transition).
- **v1.1 §5.6 identity:** scenario inter-transition surface. **Temporal differentiation from Lobby** (first entry vs inter-scenario), per v1.1 §5.6.
- **Authority:** Trigger = server gate; Render = server gate (Hub-candidate). Both layers same.
- **Lock grade:** unlocked.
- **§8 prohibitions in scope:** §8-2 (no in-scenario state render).
- **D-N relevance: D1 — OPEN per Commander Q-A direction (KEEP DEFERRED).** Lobby ↔ Hub merger decision is Stage 2 Lobby code-time per v1.1 §9-D1 + C-A3.
- **D1-open marker:** This row is provisionally named "BTY Arena (Hub-candidate)" rather than locking Hub identity. If Stage 2 merges Lobby+Hub, this row's runtime state (`NEXT_SCENARIO_READY` post-scenario) collapses into the merged Lobby+Hub surface and Lobby owns both `ARENA_SCENARIO_READY` and `NEXT_SCENARIO_READY`. If Stage 2 keeps them separate, Hub is locked with its own surface identity at that point.
- **A6 temporal split (per v1.1 §5.6 + Commander dispatch):** Lobby = first entry (`ARENA_SCENARIO_READY`); Hub = inter-scenario (`NEXT_SCENARIO_READY`). The split is temporal, not authority-level — both server-gated, both unlocked.
- **Required UI elements:** next scenario CTA (per FD context).
- **Transitions (v1.1 §4.3):** `NEXT_SCENARIO_READY → PRIMARY_CHOICE_ACTIVE` on enter.

### 3.7 ios-frame.jsx wrapper (not in codebase — Stage 2 implementation constraint)

- **v1.1 §2 row:** n/a (wrapper, not a surface).
- **Status:** file does NOT exist in `bty-app/` codebase as of 2026-05-14. Recorded here as a planned wrapper that, when authored at Stage 2, will wrap one or more design surfaces.
- **Authority:** n/a (wrapper layer; inherits parent surface's authority).
- **Lock grade:** n/a primary — wrapper MUST respect the parent surface's lock grade. Specifically:
  - When wrapping Center (HARD LOCKED during FORCED_RESET_PENDING): wrapper MUST NOT introduce navigation/back/exit/dismiss controls that bypass the HARD LOCKED constraint.
  - When wrapping Resolve (LOCKED): wrapper MUST NOT introduce "skip" / "continue anyway" / "next" CTAs.
- **§8 prohibitions Stage 2 lint-enforce:** §8-7 (HARD LOCKED bypass) is the load-bearing constraint for this wrapper. Stage 2 implementation MUST include a lint rule or test that asserts the wrapper does not render navigation/back controls when its parent surface is in HARD LOCKED state.
- **This is NOT a Stage 1 verification item.** No file exists to inspect. This row exists to (a) record the constraint up front so it isn't forgotten at Stage 2 entry, and (b) feed the Stage 2 entry checklist (§6).

---

## 4. Stage 2 implementation order — LOCKED

Per Commander dispatch + v1.1 §11 (C-A4 lock, upgraded from "권장" to LOCKED):

```
1. Lobby
2. Resolve
3. Play
4. Center
5. Foundry
6. Hub
```

**Rationale (per v1.1 §11):**
- **Lobby first** — establishes the entry reference point. Determines `ArenaRuntimeStateId` routing baseline.
- **Resolve second** — highest lock-invariant violation risk (FD-6: must not become feedback screen; §8-3/4/8 prohibitions are dense here). Verified early.
- **Play third** — depends on Lobby's entry resolution and Resolve's exit handoff being established; consumes both.
- **Center fourth** — HARD LOCKED behavior is independent infrastructure; coded after Play to keep the in-scenario flow consolidated first.
- **Foundry fifth** — lifecycle-external; depends on Center's HARD LOCKED behavior for the secondary block.
- **Hub last** — D1 resolves at Lobby code-time (Stage 2 step 1); by the time Hub is reached, identity is locked and implementation is straightforward.

The earlier reference order in `BTY_ARENA_FIGMA_CODE_MAPPING.md §13` is **superseded by this LOCKED order** per v1.1 §11.

---

## 5. Ambiguity register — A1 through A9

Status per item, with resolution source cited honestly.

| # | Ambiguity (from prior Stage 1 proposal turn) | Status | Resolution source |
|---|---|---|---|
| **A1** | "BTY Arena" frame identity — Hub or other? | **Handled in this doc** (D1-open marker, not resolved) | Per Commander Q-A direction (KEEP DEFERRED). Mapped as Hub-candidate in §2 + §3.6 with D1-open marker. Final identity decided at Stage 2 Lobby code-time per v1.1 §9-D1 + C-A3. |
| **A2** | HK6 wording inversion impact on Stage 1 surfaces (esp. Center / FORCED_RESET_PENDING)? | **Closed — no impact** | Verified read-only in prior turn: `getMyPageIdentityState.ts` has 0 references to FORCED_RESET / Center; no FORCED_RESET handler references `core_xp` / `core_xp_total`. HK6 is contained to the my-page surface, which is not in Stage 1 frame set. The file remains in the 5 HK8 leak set unchanged; not edited by this task. |
| **A3** | v1 §10 vs §9-D1 D1-timing tension | **Resolved in v1.1** | v1.1 §0 C-A3: unified to v1.1 §9-D1 timing (Stage 2 Lobby code-time). §10 reduced to "D1 flag 표기" only. |
| **A4** | v1 §11 "권장" vs Commander "locked" Stage 2 order | **Resolved in v1.1** | v1.1 §0 C-A4: §11 upgraded to **LOCKED** per Commander confirmation. Order recorded in §4 above. |
| **A5** | REEXPOSURE_DUE Trigger/Render duality not explicit | **Resolved in v1.1** | v1.1 §0 C-A5 + §2 + §7.1: Authority split into Trigger Authority / Render Authority columns. REEXPOSURE_DUE row 7 is the only row where Trigger (server gate) ≠ Render (client Play mode flag). Documented in master table §2 above. |
| **A6** | `NEXT_SCENARIO_READY` Lobby/Hub surface split | **Handled in this doc** | Per Commander dispatch direction + v1.1 §5.6. Temporal split documented in §3.1 (Lobby owns `ARENA_SCENARIO_READY` definitively, `NEXT_SCENARIO_READY` partial pending D1) and §3.6 (Hub-candidate owns `NEXT_SCENARIO_READY` post-scenario provisionally). If D1 merges, both states collapse to merged Lobby+Hub. |
| **A7** | Foundry mapping shape (lifecycle-external but Stage 1 surface) | **Handled in this doc** | Per Commander dispatch direction + v1.1 §5.4. Foundry master table row: primary runtime states = **n/a**, single secondary entry = **`FORCED_RESET_PENDING` → block access** (HARD LOCKED secondary block). Detail in §3.4. |
| **A8** | v1 self-referenced location stale (`bty-app/docs/...` vs actual outer `docs/`) | **Resolved in v1.1** | v1.1 §0 C-A8 + v1.1 line 273: self-location updated to `docs/BTY_ARENA_SEMANTIC_LOCKING_TABLE_v1.1.md` (outer repo). |
| **A9** | Authority column single-vs-multi granularity | **Resolved in v1.1** | Same as A5: 2-column Trigger/Render split per v1.1 §0 C-A5+C-A9 + §2. |

---

## 6. Stage 2 entry checklist

Stage 2 implementation may begin once **all** of the following are satisfied. This checklist is the binding gate for the Cursor dispatch that initiates Stage 2.

- [ ] **Stage 1 mapping doc reviewed + approved by Commander** — this file.
- [ ] **v1.1 §8 prohibitions encoded as lint rules** in Cursor dispatch (per v1.1 §11):
  - [ ] §8-1 Authority violation (client overrides server gate state)
  - [ ] §8-2 Surface invariant violation (Play renders Resolve state, etc.)
  - [ ] §8-3 Lock bypass (progression CTA active while LOCKED)
  - [ ] §8-4 FD-6 violation (Resolve as feedback/score-reveal)
  - [ ] §8-5 FD-5 violation (Center as menu/dashboard)
  - [ ] §8-6 FD-4 violation (REEXPOSURE_DUE separated from Play, or two-layer model violated)
  - [ ] §8-7 HARD LOCKED bypass (Center-escape during FORCED_RESET_PENDING; **includes ios-frame.jsx wrapper constraint per §3.7**)
  - [ ] §8-8 Skip CTA introduced ("skip" / "continue anyway" / "next" during LOCKED)
- [ ] **ios-frame.jsx wrapper Stage 2 implementation constraint** (§3.7): wrapper MUST NOT bypass HARD LOCKED navigation block. Lint-enforced or test-asserted.
- [ ] **D1 (Lobby ↔ Hub) decision authority** confirmed for Stage 2 Lobby code-time — Commander or per-sprint determination per v1.1 §9-D1.
- [ ] **AL-2-D-P1 freeze paths** untouched: `src/data/scenario/`, `src/lib/bty/runtime/`, `wrangler.toml`.
- [ ] **5 HK8 leaks** preserved per HK8 closure clause 4. Stage 2 work must not modify the leak set without separate gate (HK8 clause 5 4-check).
- [ ] **Stage 2 locked order** followed: Lobby → Resolve → Play → Center → Foundry → Hub (§4). Order change requires v1.2 / v2 of the locking table.
- [ ] **Outer `CLAUDE.md` Task Completion Discipline** applied to Stage 2 tasks: `docs/CURSOR_TASK_BOARD.md` + `docs/CURRENT_TASK.md` updated in the same commit / turn as the task itself; `docs/BTY_RELEASE_GATE_CHECK.md` if Stage 2 touches auth/reset/leaderboard/API/deploy.

---

## 7. Provenance footer

- **Authority spec:** v1.1 @ outer `db97c55` (authoritative content). `ba1d375` was a filename-error commit (v1 content under v1.1 name), fully superseded by `db97c55`. Cite v1.1 only — v1 (`6fc83bf`) is superseded per Commander.
- **HK8 invariants:** 5 outer leaks (4M `bty-app/src/features/my-page/logic/computeLeadershipState.ts`, `bty-app/src/lib/bty/center/letterService.ts`, `bty-app/src/lib/bty/identity/getMyPageIdentityState.ts`, `bty-app/src/lib/bty/validator/layer2Semantic.ts` + 1D `bty-app/src/lib/llm.ts`) preserved unchanged by this task.
- **AL-2-D-P1 freeze:** `src/data/scenario/`, `src/lib/bty/runtime/`, `wrangler.toml` untouched.
- **Mutation scope of Stage 1:** this file (new) + `docs/CURSOR_TASK_BOARD.md` (one row add) + `docs/CURRENT_TASK.md` (one row add). Three files, all in outer `docs/`. Single commit.
- **Status:** Stage 1 mapping authored, unpushed pending Commander review (Commander Q-C: author → commit → STOP before push).
